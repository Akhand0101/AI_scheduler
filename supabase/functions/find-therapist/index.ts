// deno-lint-ignore-file no-explicit-any
// supabase/functions/find-therapist/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FUNCTION_BASE_URL = Deno.env.get("FUNCTION_BASE_URL") ?? "";
// Optional calendar check toggles and Google creds
const CHECK_CALENDAR_AVAILABILITY = (Deno.env.get("CHECK_CALENDAR_AVAILABILITY") ?? "false").toLowerCase() === "true";
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

type RequestBody = {
  inquiryId?: string;
  problem?: string;
  schedule?: any; // { raw: "..." } or structured JSON
  insurance?: string | null;
  limit?: number;
  requireAvailability?: boolean; // override env
};

type Therapist = {
  id: string;
  name: string;
  specialties: any; // jsonb
  accepted_insurance: any; // jsonb
  google_calendar_id?: string | null;
  google_refresh_token?: string | null;
  is_active?: boolean;
  timezone?: string | null;
  bio?: string | null;
};

async function exchangeRefreshForAccessToken(refreshToken: string) {
  // Exchange refresh token for access token (Google OAuth)
  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const j = await tokenResp.json();
  if (j.error) throw new Error(`Google token error: ${JSON.stringify(j)}`);
  return j.access_token as string;
}

async function checkCalendarFreeBusy(accessToken: string, calendarId: string, timeMinISO: string, timeMaxISO: string) {
  // Google Calendar freeBusy query (simplified)
  const url = "https://www.googleapis.com/calendar/v3/freeBusy";
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      timeMin: timeMinISO,
      timeMax: timeMaxISO,
      timeZone: "UTC",
      items: [{ id: calendarId }]
    }),
  });
  const j = await res.json();
  // If busySlots length === 0 => free
  const busy = j?.calendars?.[calendarId]?.busy ?? null;
  if (busy === null) return null; // unknown
  return Array.isArray(busy) && busy.length === 0;
}

function normalizeString(s?: string | null) {
  return typeof s === "string" ? s.trim().toLowerCase() : null;
}

function scoreTherapist(t: Therapist, desiredSpecialty?: string | null, insurance?: string | null, availabilityBoost = 0) {
  // Base score components
  let score = 0;
  if (t.is_active === false) score -= 1000; // exclude inactive strongly

  const specialties = Array.isArray(t.specialties) ? t.specialties.map((x) => String(x).toLowerCase()) : [];
  if (desiredSpecialty) {
    if (specialties.includes(desiredSpecialty.toLowerCase())) score += 50;
    else {
      // partial match: check substring in specialties
      if (specialties.some((s) => s.includes((desiredSpecialty as string).toLowerCase()))) score += 20;
    }
  }

  const insList = Array.isArray(t.accepted_insurance) ? t.accepted_insurance.map((x) => String(x).toLowerCase()) : [];
  if (insurance && insList.includes(insurance.toLowerCase())) score += 30;

  // Slight preference for therapists with calendar connected
  if (t.google_calendar_id) score += 5;

  // availabilityBoost: numeric (e.g., +40 if free)
  score += availabilityBoost;

  // Tie-breaker: prefer lower UUID? (not necessary) — leave score as is
  return score;
}

serve(async (req: { method: string; json: () => Promise<any>; }) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "Only POST allowed" }), { status: 405, headers: { "content-type": "application/json" }});
    }

    const body: RequestBody = await req.json().catch(() => ({}));
    const inquiryId = body.inquiryId;
    let desiredSpecialty = body.problem ?? null; // problem may be used to infer specialty; better if inquiry has extracted_specialty
    let requestedSchedule = body.schedule ?? null;
    let insurance = body.insurance ?? null;
    const limit = body.limit ?? 10;
    const requireAvailability = body.requireAvailability ?? false;

    // If we received an inquiryId, fetch it and prefer its extracted_specialty & insurance
    if (inquiryId) {
      const { data: inquiry, error: inqErr } = await supabase.from("inquiries").select("id, extracted_specialty, requested_schedule, insurance_info, problem_description").eq("id", inquiryId).single();
      if (inqErr) {
        return new Response(JSON.stringify({ ok: false, error: "Inquiry not found", detail: inqErr.message }), { status: 404, headers: { "content-type": "application/json" }});
      }
      desiredSpecialty = desiredSpecialty ?? (inquiry?.extracted_specialty ?? inquiry?.problem_description ?? null);
      requestedSchedule = requestedSchedule ?? inquiry?.requested_schedule ?? null;
      insurance = insurance ?? inquiry?.insurance_info ?? null;
    }

    // Normalize small inputs
    const normalizedSpecialty = normalizeString(desiredSpecialty);
    const normalizedInsurance = normalizeString(insurance);

    // Build base query: only active therapists
    let q = supabase.from("therapists").select("*").eq("is_active", true).limit(100);
    // We will fetch up to 100 candidates then score them in JS
    const { data: therapistsRaw, error: tErr } = await q;
    if (tErr) throw tErr;
    const therapists: Therapist[] = (therapistsRaw ?? []) as Therapist[];

    if (!therapists || therapists.length === 0) {
      if (inquiryId) await supabase.from("inquiries").update({ status: "no-match" }).eq("id", inquiryId);
      return new Response(JSON.stringify({ ok: true, matches: [], chosen: null, message: "No therapists available" }), { headers: { "content-type": "application/json" }});
    }

    // Optional availability window parsing (best-effort)
    // If requestedSchedule contains start_date / end_date or a preferred time string, we can construct a short time window for freebusy check
    let timeMinISO: string | null = null;
    let timeMaxISO: string | null = null;
    try {
      if (requestedSchedule && typeof requestedSchedule === "object") {
        // Expected shape maybe { start_date, end_date, preferred_times }
        const sd = requestedSchedule.start_date ?? null;
        const ed = requestedSchedule.end_date ?? null;
        if (sd && ed) {
          // Use full day range: start at 00:00Z of sd and end at 23:59Z of ed (simple)
          timeMinISO = new Date(`${sd}T00:00:00Z`).toISOString();
          timeMaxISO = new Date(`${ed}T23:59:59Z`).toISOString();
        }
      } else if (requestedSchedule && typeof requestedSchedule === "string") {
        // If schedule is a free-text like "mornings next week", we might not be able to parse — skip
      }
    } catch (e) {
      console.warn("Failed to parse requestedSchedule:", e);
    }

    // Score therapists
    const scored: Array<{ therapist: Therapist; score: number; availability?: boolean | null }> = [];

    for (const t of therapists) {
      let availabilityBoost = 0;
      let availability: boolean | null = null;

      // If we should check calendar availability and we have a window AND therapist has refresh token
      const wantAvailability = (CHECK_CALENDAR_AVAILABILITY || requireAvailability) && timeMinISO && timeMaxISO && (t.google_refresh_token || t.google_calendar_id);
      if (wantAvailability) {
        try {
          if (t.google_refresh_token && GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
            const accessToken = await exchangeRefreshForAccessToken(t.google_refresh_token);
            const calId = t.google_calendar_id ?? "primary";
            const free = await checkCalendarFreeBusy(accessToken, calId, timeMinISO!, timeMaxISO!);
            availability = free; // true means free
            if (free === true) availabilityBoost = 40;
            else if (free === false) availabilityBoost = 0;
          } else {
            // No refresh token available or missing Google creds -> unknown
            availability = null;
          }
        } catch (e) {
          console.warn("Calendar availability check failed for therapist", t.id, String(e));
          availability = null;
        }
      }

      const s = scoreTherapist(t, normalizedSpecialty, normalizedInsurance, availabilityBoost);
      scored.push({ therapist: t, score: s, availability });
    }

    // Sort by score desc
    scored.sort((a, b) => b.score - a.score);

    // Choose top candidate if score positive and not inactive
    const top = scored.find((x) => x.therapist.is_active !== false && x.score > 0) ?? null;

    // If we have an inquiryId and top exists, update inquiry matched_therapist_id and status
    if (inquiryId) {
      if (top) {
        await supabase.from("inquiries").update({ matched_therapist_id: top.therapist.id, status: "matched" }).eq("id", inquiryId);
      } else {
        await supabase.from("inquiries").update({ status: "no-match" }).eq("id", inquiryId);
      }
    }

    // Prepare response (limit number returned)
    const limited = scored.slice(0, Math.max(1, Math.min(limit, scored.length))).map((s) => ({
      therapist: {
        id: s.therapist.id,
        name: s.therapist.name,
        specialties: s.therapist.specialties,
        accepted_insurance: s.therapist.accepted_insurance,
        bio: s.therapist.bio ?? null,
        google_calendar_id: s.therapist.google_calendar_id ?? null,
        timezone: s.therapist.timezone ?? null,
        is_active: s.therapist.is_active ?? true
      },
      score: s.score,
      availability: s.availability ?? null
    }));

    return new Response(JSON.stringify({
      ok: true,
      matches: limited,
      chosen: top ? {
        id: top.therapist.id,
        name: top.therapist.name,
        score: top.score,
        availability: top.availability ?? null
      } : null
    }), { headers: { "content-type": "application/json" }});
  // deno-lint-ignore no-explicit-any
  } catch (err: any) {
    console.error("Unhandled error in find-therapist:", err);
    return new Response(JSON.stringify({ ok: false, error: err?.message ?? String(err) }), { status: 500, headers: { "content-type": "application/json" }});
  }
});
