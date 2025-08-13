import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const generateRandomPassword = (): string => {
  const length = 12;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  
  // Ensure at least one character from each type
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*";
  
  password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
  password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
  password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  password += symbols.charAt(Math.floor(Math.random() * symbols.length));
  
  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  
  // Shuffle the password
  return password.split('').sort(() => 0.5 - Math.random()).join('');
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, userEmail } = await req.json();

    if (!userId || !userEmail) {
      throw new Error('User ID and email are required');
    }

    // Initialize Supabase Admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Generate random password
    const newPassword = generateRandomPassword();
    console.log('Generated new password for user:', userId);

    // Update user password using admin client
    const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (passwordError) {
      console.error('Error updating password:', passwordError);
      throw passwordError;
    }

    // Update profile to remove password change requirement
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ requires_password_change: false })
      .eq('user_id', userId);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      throw profileError;
    }

    // Initialize Resend if API key is available
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);

      // Send email with new password
      const { error: emailError } = await resend.emails.send({
        from: "EriSync <onboarding@resend.dev>",
        to: [userEmail],
        subject: "Your New EriSync Password",
        html: `
          <h1>Your New Password for EriSync.com</h1>
          <p>You have been assigned a new password for EriSync.com</p>
          <p><strong>Username:</strong> ${userEmail}</p>
          <p><strong>New Password:</strong> <code style="background: #f4f4f4; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${newPassword}</code></p>
          <p>Please log in with these credentials and consider changing your password after logging in.</p>
          <br>
          <p>Best regards,<br>The EriSync Team</p>
        `,
      });

      if (emailError) {
        console.error('Error sending email:', emailError);
        // Don't throw here - password was updated successfully
      } else {
        console.log('Email sent successfully to:', userEmail);
      }
    } else {
      console.log('RESEND_API_KEY not configured, skipping email');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Password updated successfully',
        emailSent: !!resendApiKey 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in send-random-password function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to update password',
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});