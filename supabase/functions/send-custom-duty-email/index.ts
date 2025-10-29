import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CustomEmailRequest {
  template_id: string;
  preview?: boolean;
}

interface EmailTableCell {
  id: string;
  content: string;
  backgroundColor: 'white' | 'green' | 'yellow' | 'red' | 'orange';
}

interface EmailTableRow {
  id: string;
  cells: EmailTableCell[];
}

interface EmailRegionTable {
  id: string;
  title: string;
  rows: EmailTableRow[];
}

interface TemplateData {
  regions: EmailRegionTable[];
  notes: string[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { template_id, preview } = await req.json() as CustomEmailRequest;

    if (!template_id) {
      throw new Error('Template ID is required');
    }

    // Fetch template from database
    const { data: template, error: fetchError } = await supabase
      .from('custom_duty_email_templates')
      .select('*')
      .eq('id', template_id)
      .single();

    if (fetchError) throw fetchError;
    if (!template) throw new Error('Template not found');

    // Build HTML from template data
    const html = buildCustomEmailHtml(
      template.template_name,
      template.week_number,
      template.template_data as TemplateData
    );

    // If preview mode, just return the HTML
    if (preview) {
      return new Response(JSON.stringify({ html }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Validate distribution list
    if (!template.distribution_list || template.distribution_list.length === 0) {
      throw new Error('No recipients in distribution list');
    }

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: "Duty Coverage <onboarding@resend.dev>",
      to: template.distribution_list,
      subject: `${template.template_name} - KW ${template.week_number}`,
      html: html,
    });

    console.log('Email sent successfully:', emailResponse);

    // Log to weekly_email_history
    const { error: logError } = await supabase
      .from('weekly_email_history')
      .insert([{
        template_id: template_id,
        week_number: template.week_number,
        year: template.year,
        sent_by: template.created_by,
        recipient_count: template.distribution_list.length,
        status: 'success',
      }]);

    if (logError) {
      console.error('Failed to log email history:', logError);
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: `Email sent to ${template.distribution_list.length} recipient(s)`,
      email_id: emailResponse.id 
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error: any) {
    console.error('Error in send-custom-duty-email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      }
    );
  }
};

function buildCustomEmailHtml(
  templateName: string,
  weekNumber: number,
  templateData: TemplateData
): string {
  const colorMap = {
    white: '#ffffff',
    green: '#90EE90',
    yellow: '#FFD700',
    red: '#FF6B6B',
    orange: '#FFA500',
  };

  const regionsHtml = templateData.regions.map(region => `
    <h2 style="color: #555; margin-top: 30px; margin-bottom: 15px; font-size: 18px;">
      ${escapeHtml(region.title)}
    </h2>
    <table class="region-table" style="margin-bottom: 30px; border-collapse: collapse; width: 100%;">
      ${region.rows.map(row => `
        <tr>
          ${row.cells.map(cell => `
            <td style="
              border: 1px solid #333; 
              padding: 8px; 
              text-align: center;
              font-size: 11px;
              min-height: 40px;
              vertical-align: top;
              background-color: ${colorMap[cell.backgroundColor]};
            ">
              ${escapeHtml(cell.content).replace(/\n/g, '<br>')}
            </td>
          `).join('')}
        </tr>
      `).join('')}
    </table>
  `).join('');

  const notesHtml = templateData.notes && templateData.notes.length > 0 ? `
    <div class="notes" style="margin-top: 30px;">
      <h3 style="color: #555; font-size: 16px;">Notes</h3>
      <ul style="list-style: disc; margin-left: 20px;">
        ${templateData.notes.map(note => `
          <li style="margin-bottom: 5px;">${escapeHtml(note)}</li>
        `).join('')}
      </ul>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(templateName)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; }
    h1 { color: #333; margin-bottom: 30px; }
    @media (max-width: 768px) {
      .region-table { font-size: 9px; }
      .region-table td { padding: 4px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${escapeHtml(templateName)} - KW ${weekNumber}</h1>
    ${regionsHtml}
    ${notesHtml}
  </div>
</body>
</html>
  `.trim();
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

serve(handler);
