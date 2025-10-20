import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Replace with your Lovable project domain
const ALLOWED_ORIGIN = "https://ec7ff24a-66f9-44d2-a941-6025cf65938a.lovableproject.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};

// Generate secure random password
function generateSecurePassword(): string {
  const length = 16;
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";
  let password = "";

  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  const allChars = uppercase + lowercase + numbers + symbols;
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

serve(async (req) => {
  // ✅ Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log("OPTIONS request handled");
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { email, initials, role, countryCode, teamId, sendEmail } = await req.json();

    if (!email || !initials || !role) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // ✅ Check if email already exists
    const { data: existingUser } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("email", email.toLowerCase())
      .maybeSingle();
    if (existingUser) {
      return new Response(JSON.stringify({ error: "Email already exists" }), {
        status: 409,
        headers: corsHeaders,
      });
    }

    const tempPassword = generateSecurePassword();

    // ✅ Create user in Supabase Auth
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { initials },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const createdUser = userData.user;

    // ✅ Insert profile
    await supabaseAdmin.from("profiles").insert({
      user_id: createdUser.id,
      email,
      initials,
      country_code: countryCode || "US",
      requires_password_change: true,
    });

    // ✅ Assign role
    await supabaseAdmin.from("user_roles").insert({ user_id: createdUser.id, role });

    // ✅ Assign team if provided
    if (teamId && teamId !== "no-team") {
      await supabaseAdmin
        .from("team_members")
        .insert({ user_id: createdUser.id, team_id: teamId, is_manager: role === "manager" });
    }

    // ✅ Send email if requested
    if (sendEmail) {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
          body: JSON.stringify({
            from: "Schedule System <onboarding@resend.dev>",
            to: [email],
            subject: "Welcome to Schedule System",
            html: `<h1>Welcome!</h1><p>Your temporary password: <strong>${tempPassword}</strong></p>`,
          }),
        });
      }
    }

    return new Response(JSON.stringify({ success: true, message: "User created successfully" }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
