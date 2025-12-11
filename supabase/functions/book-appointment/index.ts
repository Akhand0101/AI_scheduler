// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Initialize Supabase
    // We use the Service Role Key to ensure we can read sensitive data (like tokens) regardless of RLS policies for the "Admin" logic
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Parse Request
    const {
      inquiryId,
      therapistId,
      startTime,
      endTime,
      patientName,
      timeZone,
    } = await req.json();

    // --- STRICT VALIDATION ---

    if (!therapistId || !startTime || !endTime) {
      throw new Error(
        "Missing required appointment details: 'therapistId', 'startTime', and 'endTime' are required.",
      );
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    const now = new Date();

    // 2a. Validate Date Parsing
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error(
        "Invalid date format provided. Please use ISO 8601 format.",
      );
    }

    // 2b. Validate Future Dates
    if (start < now) {
      throw new Error(
        "Cannot book appointments in the past. Please choose a future time.",
      );
    }

    // 2c. Validate Duration logic
    if (end <= start) {
      throw new Error("End time must be after start time.");
    }

    // 2d. Validate Working Hours (9 AM - 6 PM) in the target timezone
    const timeZoneToUse = timeZone || "Asia/Kolkata";
    // Format the hour in the requested timezone to check business hours
    const startHourStr = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZoneToUse,
      hour: "numeric",
      hour12: false,
    }).format(start);
    const startHour = parseInt(startHourStr, 10);

    // Business hours: 9:00 to 18:00 (6 PM)
    if (startHour < 9 || startHour >= 18) {
      throw new Error(
        `Appointments can only be booked between 9:00 AM and 6:00 PM (${timeZoneToUse}).`,
      );
    }

    // --- AVAILABILITY CHECK ---

    // 3. Check for Overlaps in Database
    // We check if there is any appointment for this therapist that overlaps
    // Logic: (StartA < EndB) and (EndA > StartB)
    const { data: conflicts, error: conflictError } = await supabase
      .from("appointments")
      .select("id")
      .eq("therapist_id", therapistId)
      // Check for overlap: existing_start < request_end AND existing_end > request_start
      .lt("start_time", endTime)
      .gt("end_time", startTime);

    if (conflictError) {
      console.error("Availability check error:", conflictError);
      throw new Error(`Failed to check availability: ${conflictError.message}`);
    }

    if (conflicts && conflicts.length > 0) {
      throw new Error(
        "This time slot is already booked. Please choose another time.",
      );
    }

    // --- FETCH ADMIN CALENDAR CREDENTIALS ---

    // 4. Find the "Admin" credential.
    // Logic: Find ANY therapist record that has a google_refresh_token.
    // This serves as the 'Admin' calendar for this dummy application.
    const { data: adminTherapist, error: adminError } = await supabase
      .from("therapists")
      .select("google_refresh_token, google_calendar_id")
      .not("google_refresh_token", "is", null)
      .limit(1)
      .single();

    // Variable to store the Google Event ID if sync succeeds
    let googleCalendarEventId: string | null = null;
    let googleCalendarError: string | null = null;

    // 5. Route to Admin Calendar
    if (adminTherapist?.google_refresh_token) {
      console.log(
        `✓ Admin calendar credentials found. Routing booking to this calendar.`,
      );

      try {
        const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
        const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

        if (!clientId || !clientSecret) {
          throw new Error(
            "Server configuration error: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing.",
          );
        }

        // Exchange refresh token for access token
        const tokenResponse = await fetch(
          "https://oauth2.googleapis.com/token",
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              refresh_token: adminTherapist.google_refresh_token,
              grant_type: "refresh_token",
            }),
          },
        );

        const tokenData = await tokenResponse.json();

        if (!tokenData.access_token) {
          console.error("Token refresh failed:", tokenData);
          throw new Error("Failed to authenticate with Admin Calendar.");
        }

        // 6. Create Event on Google Calendar
        // We use the Admin's calendar ID or 'primary'
        const calendarId = adminTherapist.google_calendar_id || "primary";

        const eventBody = {
          summary: `Therapy Session: ${patientName || "Patient"}`,
          description:
            `Internal Therapist ID: ${therapistId}\nInquiry ID: ${inquiryId}\n\n(Routed to Admin Calendar)`,
          start: {
            // startTime is already in UTC ISO format (e.g., 2026-03-02T08:30:00.000Z)
            // So we tell Google it's UTC and it will display correctly in user's calendar timezone
            dateTime: startTime,
            timeZone: "UTC",
          },
          end: {
            dateTime: endTime,
            timeZone: "UTC",
          },
          reminders: {
            useDefault: false,
            overrides: [
              { method: "email", minutes: 60 },
              { method: "popup", minutes: 30 },
            ],
          },
        };

        const calendarResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?sendUpdates=all`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${tokenData.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(eventBody),
          },
        );

        // Handle Calendar API errors
        if (!calendarResponse.ok) {
          const errorText = await calendarResponse.text();
          console.error(`Google Calendar API error: ${errorText}`);
          // We do NOT throw here if we want to allow the DB booking to proceed even if Calendar fails?
          // The prompt asks to "surface clear error messages", but preventing the booking might be too strict if it's just a sync issue.
          // However, usually booking systems fail if sync fails.
          throw new Error(
            `Google Calendar sync failed: ${calendarResponse.statusText}`,
          );
        }

        const eventData = await calendarResponse.json();
        if (eventData.id) {
          googleCalendarEventId = eventData.id;
          console.log(
            `✓ Google Calendar sync successful (Event ID: ${googleCalendarEventId})`,
          );
        }
      } catch (e: any) {
        console.error(`❌ Admin Calendar integration failed:`, e.message);
        googleCalendarError = e.message;
        // Decide: Do we block the booking?
        // "surface clear error messages" implies we should let the user know.
        // But usually, we might want to save the appointment anyway.
        // For "hardening", let's THROW if strict sync is expected, OR return the error.
        // I will return the error but allow the DB save, so we don't lose the booking intent,
        // but the frontend can show a warning.
      }
    } else {
      console.warn(
        "No connected Admin Calendar found (no therapist has a refresh token). Skipping Calendar Sync.",
      );
      googleCalendarError = "System not connected to a calendar.";
    }

    // --- SAVE TO DATABASE ---

    // 7. Save to Supabase 'appointments' table
    // We save it under the ORIGINAL requested therapistId so the app logic remains consistent
    const { data: appointment, error: apptError } = await supabase
      .from("appointments")
      .insert({
        inquiry_id: inquiryId,
        therapist_id: therapistId,
        start_time: startTime,
        end_time: endTime,
        google_calendar_event_id: googleCalendarEventId,
        status: "confirmed",
      })
      .select()
      .single();

    if (apptError) {
      console.error("Database insert error:", apptError);
      throw new Error(`Failed to save appointment: ${apptError.message}`);
    }

    // 8. Update Inquiry Status
    if (inquiryId) {
      await supabase
        .from("inquiries")
        .update({ status: "scheduled" })
        .eq("id", inquiryId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        appointment,
        googleCalendarError,
        message: "Appointment booked successfully!",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Booking error:", error.message);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    );
  }
});
