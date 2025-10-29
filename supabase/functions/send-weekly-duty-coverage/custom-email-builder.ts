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

interface Screenshot {
  id: string;
  name: string;
  url: string;
  caption: string;
}

interface TemplateData {
  regions: EmailRegionTable[];
  notes: string[];
  screenshots?: Screenshot[];
}

export function buildCustomEmailHtml(
  templateName: string,
  weekNumber: number,
  templateData: TemplateData,
  isPreview: boolean = false
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

  const screenshotsHtml = templateData.screenshots && templateData.screenshots.length > 0 ? `
    <div style="margin-top: 30px;">
      <h3 style="color: #555; font-size: 16px; margin-bottom: 16px;">Screenshots</h3>
      ${templateData.screenshots.map((screenshot) => `
        <div style="margin-bottom: 24px;">
          <img src="${isPreview ? screenshot.url : `cid:${screenshot.id}`}" alt="${escapeHtml(screenshot.name)}" style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #e5e7eb;" />
          ${screenshot.caption ? `<p style="margin-top: 8px; color: #6b7280; font-size: 14px;">${escapeHtml(screenshot.caption)}</p>` : ''}
        </div>
      `).join('')}
    </div>
  ` : '';

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
    ${screenshotsHtml}
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
