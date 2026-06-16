import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  team_id: string;
  partnership_id?: string | null;
  shift_date: string; // YYYY-MM-DD
  shift_type: string; // 'early' | 'late' | 'night' | ...
  notes?: string;
}

const SHIFT_LABEL: Record<string, string> = {
  early: "Early (E)",
  late: "Late (L)",
  night: "Night (N)",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const caller = userData.user;
    const admin = createClient(supabaseUrl, serviceKey);

    const body = (await req.json()) as Body;
    if (!body?.team_id || !body?.shift_date || !body?.shift_type) {
      return new Response(JSON.stringify({ error: "team_id, shift_date and shift_type are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller manages team_id (or admin/planner).
    const [{ data: roleRows }, { data: managedRows }] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", caller.id),
      admin.from("team_members").select("team_id").eq("user_id", caller.id).eq("is_manager", true),
    ]);
    const roles = (roleRows || []).map((r: any) => r.role);
    const isAdmin = roles.includes("admin") || roles.includes("planner");
    const managesTeam = (managedRows || []).some((r: any) => r.team_id === body.team_id);
    if (!isAdmin && !managesTeam) {
      return new Response(JSON.stringify({ error: "Not authorized for this team" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve partnership teams (broadcast scope).
    let scopeTeamIds: string[] = [body.team_id];
    if (body.partnership_id) {
      const { data: part } = await admin
        .from("team_planning_partners")
        .select("team_ids")
        .eq("id", body.partnership_id)
        .maybeSingle();
      if (part?.team_ids?.length) scopeTeamIds = part.team_ids;
    }

    // Upsert one open request (uniqueness enforced for status='open').
    const { data: existing } = await admin
      .from("open_shift_requests")
      .select("id, status")
      .eq("team_id", body.team_id)
      .eq("shift_date", body.shift_date)
      .eq("shift_type", body.shift_type)
      .eq("status", "open")
      .maybeSingle();

    let requestId: string;
    if (existing?.id) {
      requestId = existing.id;
    } else {
      const { data: inserted, error: insErr } = await admin
        .from("open_shift_requests")
        .insert({
          team_id: body.team_id,
          partnership_id: body.partnership_id ?? null,
          shift_date: body.shift_date,
          shift_type: body.shift_type,
          status: "open",
          created_by: caller.id,
          notes: body.notes ?? null,
        })
        .select("id")
        .single();
      if (insErr) {
        return new Response(JSON.stringify({ error: insErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      requestId = inserted!.id;
    }

    // Find members to notify (every member of every scope team, minus caller).
    const { data: members } = await admin
      .from("team_members")
      .select("user_id")
      .in("team_id", scopeTeamIds);
    const memberIds = Array.from(new Set((members || []).map((m: any) => m.user_id))).filter(
      (id) => id !== caller.id,
    );

    const shiftLabel = SHIFT_LABEL[body.shift_type] ?? body.shift_type;
    const title = `Coverage needed: ${shiftLabel}`;
    const message = `${shiftLabel} on ${body.shift_date} needs coverage. Open the schedule to take this shift.`;
    const link = `/schedule?openRequest=${requestId}`;

    if (memberIds.length > 0) {
      const notifRows = memberIds.map((uid) => ({
        user_id: uid,
        type: "coverage_request",
        title,
        message,
        link,
        metadata: {
          open_shift_request_id: requestId,
          team_id: body.team_id,
          partnership_id: body.partnership_id ?? null,
          shift_date: body.shift_date,
          shift_type: body.shift_type,
        },
      }));
      await admin.from("notifications").insert(notifRows);
    }

    // Best-effort email broadcast — only attempted when transactional email exists.
    let emailsSent = 0;
    try {
      const { data: profiles } = await admin
        .from("profiles")
        .select("user_id, email, first_name")
        .in("user_id", memberIds);
      const recipients = (profiles || []).filter((p: any) => p?.email);
      for (const r of recipients) {
        const { error: mailErr } = await admin.functions.invoke("send-transactional-email", {
          body: {
            templateName: "shift-coverage-request",
            recipientEmail: r.email,
            idempotencyKey: `coverage-${requestId}-${r.user_id}`,
            templateData: {
              firstName: r.first_name ?? "there",
              shiftLabel,
              shiftDate: body.shift_date,
              link,
              notes: body.notes ?? "",
            },
          },
        });
        if (!mailErr) emailsSent += 1;
      }
    } catch (_e) {
      // Transactional email not yet scaffolded — skip silently.
    }

    return new Response(
      JSON.stringify({
        success: true,
        open_shift_request_id: requestId,
        notified: memberIds.length,
        emails_sent: emailsSent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});