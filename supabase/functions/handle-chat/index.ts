import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ═══════════════════════════════════════════════════════════════════════════
// 🤖 KAI - YOUR FRIENDLY APPOINTMENT BOOKING ASSISTANT
// ═══════════════════════════════════════════════════════════════════════════
// Kai is a warm, empathetic, and intelligent assistant that helps users:
// - Find the right therapist
// - Book, view, cancel, and reschedule appointments
// - Answer questions about insurance, availability, and therapist details
// - Have natural, human-like conversations
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// 📋 TOOL DEFINITIONS - What Kai can do
// ─────────────────────────────────────────────────────────────────────────────

const TOOLS = {
  function_declarations: [
    {
      name: "search_therapists",
      description:
        "Search for therapists by specialty, insurance, or general query. Use when user asks 'find me a therapist', 'who can help with X', 'show therapists', etc.",
      parameters: {
        type: "OBJECT",
        properties: {
          specialty: {
            type: "STRING",
            description:
              "Specialty area (anxiety, depression, PTSD, trauma, relationship issues, etc.)",
          },
          insurance: {
            type: "STRING",
            description: "Insurance provider name",
          },
          query: {
            type: "STRING",
            description: "General search query",
          },
        },
      },
    },
    {
      name: "get_therapist_details",
      description:
        "Get detailed information about a specific therapist. Use when user asks about a particular therapist by name.",
      parameters: {
        type: "OBJECT",
        properties: {
          therapistName: {
            type: "STRING",
            description: "Name of the therapist",
          },
          therapistId: {
            type: "STRING",
            description: "ID of the therapist (if known)",
          },
        },
      },
    },
    {
      name: "check_available_slots",
      description:
        "Check what time slots are available for a therapist on a specific date. Use when user asks 'when is X available', 'what times work', etc.",
      parameters: {
        type: "OBJECT",
        properties: {
          therapistId: { type: "STRING", description: "ID of the therapist" },
          date: {
            type: "STRING",
            description:
              "Date to check (today, tomorrow, YYYY-MM-DD, next Monday, etc.)",
          },
        },
        required: ["therapistId", "date"],
      },
    },
    {
      name: "book_appointment",
      description:
        "Book an appointment. ONLY use after confirming user wants to book and slot is available.",
      parameters: {
        type: "OBJECT",
        properties: {
          therapistId: { type: "STRING", description: "ID of the therapist" },
          startTime: { type: "STRING", description: "ISO 8601 start time" },
          endTime: { type: "STRING", description: "ISO 8601 end time" },
          problem: { type: "STRING", description: "Reason for visit" },
        },
        required: ["therapistId", "startTime", "endTime"],
      },
    },
    {
      name: "view_my_appointments",
      description:
        "View user's appointments. Use when user asks 'when is my appointment', 'show my bookings', 'my schedule', etc.",
      parameters: {
        type: "OBJECT",
        properties: {
          status: {
            type: "STRING",
            description:
              "Filter: 'upcoming', 'past', or 'all'. Default: upcoming",
          },
        },
      },
    },
    {
      name: "cancel_appointment",
      description:
        "Cancel an appointment. Use when user says 'cancel my appointment'.",
      parameters: {
        type: "OBJECT",
        properties: {
          appointmentId: {
            type: "STRING",
            description: "ID of appointment to cancel",
          },
        },
        required: ["appointmentId"],
      },
    },
    {
      name: "reschedule_appointment",
      description:
        "Reschedule an existing appointment to a new time. Use when user says 'move my appointment', 'reschedule to'.",
      parameters: {
        type: "OBJECT",
        properties: {
          appointmentId: {
            type: "STRING",
            description: "ID of appointment to reschedule",
          },
          newStartTime: {
            type: "STRING",
            description: "New ISO 8601 start time",
          },
          newEndTime: { type: "STRING", description: "New ISO 8601 end time" },
        },
        required: ["appointmentId", "newStartTime", "newEndTime"],
      },
    },
    {
      name: "list_accepted_insurance",
      description:
        "List all insurance providers we accept. Use when user asks 'what insurance do you accept' or 'do you take X insurance'.",
      parameters: { type: "OBJECT", properties: {} },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// KAI'S PERSONALITY & SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(context: {
  patientId: string;
  timeZone: string;
  currentTime: string;
}): string {
  return `You are Kai, a warm, empathetic appointment booking assistant for a therapy practice.

YOUR PRIMARY GOAL:
Get users successfully booked with a therapist as efficiently as possible while being supportive.

YOUR PERSONALITY:
- EMPATHETIC: Acknowledge feelings, but move toward solutions
- EFFICIENT: Always progressing toward booking
- PROACTIVE: Use tools immediately when you have enough information  
- CLEAR: Give specific options, not vague questions
- WARM: Be caring but concise

BOOKING WORKFLOW (Your North Star):

Step 1: Understand (1 message)
- User shares what they're dealing with
- Acknowledge briefly, validate feelings
- Immediately search for therapists

Step 2: Present Options (1 message)
- Show 3-5 therapist options with specialties
- Make it easy to choose

Step 3: Check Availability (1 message)  
- Once they pick a therapist, check available slots
- Present specific times

Step 4: Book (1 message)
- Get confirmation
- Book the appointment
- Confirm!

Target: 4-5 messages to complete booking

HOW TO EXECUTE:

When user shares a problem:
- DON'T ask "tell me more" - just search for therapists
- DO say "I hear you. Let me find therapists who specialize in that..."
- Immediately call search_therapists

When they pick a therapist:
- DON'T ask "what days work"
- DO immediately check availability  
- Call check_available_slots and show times

When they pick a time:
- DON'T ask more questions
- DO confirm and book immediately
- Call book_appointment

TOOL USAGE:

1. search_therapists: Use when user mentions their problem
2. check_available_slots: Use when they pick a therapist
3. book_appointment: Use after they confirm time  
4. view_my_appointments: When they ask about their schedule

FORMATTING:

When listing insurance:
- Use bullet points
- List: Blue Cross Blue Shield, Aetna, Cigna, UnitedHealthcare, Humana, Kaiser Permanente, Medicare, Medicaid
- End with "Which one do you have?"

When listing therapists:
- Use numbered list (1, 2, 3)
- Show name and 2-3 specialties
- End with "Who sounds like a good fit?"

TONE:
- Sound like a helpful friend, not formal
- Use contractions: "I've", "you're", "let's"
- Skip "certainly" and "absolutely" - just be natural
- Keep responses short: 2-3 sentences

CURRENT CONTEXT:
Time: ${context.currentTime}
Timezone: ${context.timeZone}  
Patient ID: ${context.patientId}

KNOWLEDGE:
- Insurance: Aetna, Blue Cross Blue Shield, Cigna, UnitedHealthcare, Humana, Kaiser Permanente, Medicare, Medicaid
- Working Hours: 9 AM - 5 PM
- We have 14 therapists

GOLDEN RULES:

1. LISTEN then SEARCH then SHOW options
2. They PICK then CHECK availability then OFFER times
3. They CHOOSE then CONFIRM then BOOK
4. BE BRIEF: 2-3 sentences
5. BE PROACTIVE: Use tools immediately
6. BE GOAL-ORIENTED: Every message moves toward booking

Remember: You're a booking assistant. Be warm but focused on getting them booked with a therapist.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🚀 MAIN HANDLER
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  console.log("🤖 Kai Assistant Loaded - v2.0 (Database Schema Compatible)");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    );

    // Parse request
    const body = await req.json();
    const {
      userMessage,
      conversationHistory = [],
      patientId = "anon-" + Date.now(),
      timeZone = "Asia/Kolkata",
    } = body;

    if (!userMessage) {
      return jsonResponse(
        { success: false, error: "Message is required" },
        400,
      );
    }

    console.log(`📨 Message from ${patientId}: "${userMessage}"`);

    // Get or create inquiry record
    const inquiry = await getOrCreateInquiry(supabaseClient, patientId);

    // Build context
    const context = {
      patientId,
      timeZone,
      currentTime: new Date().toLocaleString("en-US", { timeZone }),
    };

    // Attempt AI conversation with fallback
    const result = await handleConversation({
      supabaseClient,
      userMessage,
      conversationHistory,
      context,
      inquiry,
      authHeader: req.headers.get("Authorization")!,
    });

    return jsonResponse(result);
  } catch (error: any) {
    console.error("❌ Fatal Error:", error);
    return jsonResponse(
      {
        success: false,
        error: "Something went wrong. Please try again.",
        message:
          "❤️ Sorry, I encountered an error. Could you try rephrasing that?",
      },
      500,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 🧠 CONVERSATION HANDLER - The brain of the operation
// ─────────────────────────────────────────────────────────────────────────────

async function handleConversation({
  supabaseClient,
  userMessage,
  conversationHistory,
  context,
  inquiry,
  authHeader,
}: any) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");

  // Try AI-powered conversation first
  if (apiKey) {
    try {
      return await aiConversation({
        supabaseClient,
        userMessage,
        conversationHistory,
        context,
        inquiry,
        authHeader,
        apiKey,
      });
    } catch (error) {
      console.warn(
        "⚠️ AI conversation failed, falling back to rule-based:",
        error,
      );
    }
  }

  // Fallback to rule-based conversation
  return await ruleBasedConversation({
    supabaseClient,
    userMessage,
    context,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 🤖 AI-POWERED CONVERSATION (Using Gemini)
// ─────────────────────────────────────────────────────────────────────────────

async function aiConversation({
  supabaseClient,
  userMessage,
  conversationHistory,
  context,
  inquiry,
  authHeader,
  apiKey,
}: any) {
  const systemPrompt = buildSystemPrompt(context);

  // Build conversation contents
  const contents: any[] = conversationHistory.map((msg: any) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));
  contents.push({ role: "user", parts: [{ text: userMessage }] });

  // FREE TIER OPTIMIZED: Use gemini-2.0-flash-001 which is available on v1beta
  // See: https://ai.google.dev/gemini-api/docs/models/gemini
  const PRIMARY_MODEL = "gemini-2.5-flash";

  let finalResponse = "";
  let bookingResult: any = null;
  let appointmentData: any = null;

  // FREE TIER OPTIMIZED: Reduced to 2 turns max (1 for tool call, 1 for response)
  // This prevents burning quota on complex multi-turn conversations
  const MAX_TURNS = 2;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    try {
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${PRIMARY_MODEL}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          tools: [TOOLS],
          generationConfig: {
            temperature: 0.5, // Lower = more deterministic, fewer tokens
            topP: 0.8,
            topK: 20,
            maxOutputTokens: 500, // Limit response size to save tokens
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error (${response.status}):`, errorText);

        // ANY error = immediate fallback (save quota!)
        throw new Error(`API error: ${response.status}`);
      }

      const responseData = await response.json();
      console.log(`✅ API call ${turn + 1} successful`);

      const candidate = responseData.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      // Check for function calls
      const functionCalls = parts.filter((p: any) => p.functionCall);
      const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text)
        .join("");

      if (functionCalls.length > 0) {
        // Execute tools (this doesn't use API quota)
        console.log(`🔧 Executing ${functionCalls.length} tool(s)`);
        contents.push({ role: "model", parts });

        const toolResponses = [];
        for (const fc of functionCalls) {
          const { name, args } = fc.functionCall;
          let result: any = { error: "Unknown tool" };

          try {
            result = await executeTool(name, args, {
              supabaseClient,
              context,
              inquiry,
              authHeader,
            });

            // Track booking results
            if (name === "book_appointment" && result.success) {
              bookingResult = result;
              appointmentData = result.appointment;
            }
          } catch (error: any) {
            console.error(`Tool ${name} error:`, error);
            result = { error: error.message };
          }

          toolResponses.push({
            functionResponse: {
              name,
              response: { content: result },
            },
          });
        }

        contents.push({ role: "function", parts: toolResponses });
        // Continue to next turn to get AI's response to tool results
      } else {
        // Got final text response - we're done!
        finalResponse = textParts;
        break;
      }
    } catch (error: any) {
      console.warn(`⚠️ Turn ${turn + 1} failed:`, error.message);
      // Immediately fall back to rule-based (don't waste more quota!)
      throw error;
    }
  }

  return {
    success: true,
    message: finalResponse || "I'm here to help! What would you like to do?",
    aiResponse: finalResponse,
    nextAction: bookingResult ? "booked" : "awaiting-info",
    inquiryId: inquiry.id,
    appointment: appointmentData,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔧 TOOL EXECUTOR - Routes to the right handler
// ─────────────────────────────────────────────────────────────────────────────

async function executeTool(name: string, args: any, deps: any) {
  console.log(`🔧 Tool: ${name}`, args);

  switch (name) {
    case "search_therapists":
      return await toolSearchTherapists(deps.supabaseClient, args);

    case "get_therapist_details":
      return await toolGetTherapistDetails(deps.supabaseClient, args);

    case "check_available_slots":
      return await toolCheckAvailableSlots(
        deps.supabaseClient,
        args,
        deps.context.timeZone,
      );

    case "book_appointment":
      return await toolBookAppointment(
        deps.supabaseClient,
        args,
        deps.inquiry,
        deps.authHeader,
      );

    case "view_my_appointments":
      return await toolViewMyAppointments(
        deps.supabaseClient,
        deps.context.patientId,
        args,
        deps.context.timeZone,
      );

    case "cancel_appointment":
      return await toolCancelAppointment(
        deps.supabaseClient,
        args,
        deps.authHeader,
      );

    case "reschedule_appointment":
      return await toolRescheduleAppointment(
        deps.supabaseClient,
        args,
        deps.context.timeZone,
      );

    case "list_accepted_insurance":
      return toolListInsurance();

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🛠️ TOOL IMPLEMENTATIONS - Database Schema Compatible
// ─────────────────────────────────────────────────────────────────────────────

async function toolSearchTherapists(supabase: any, args: any) {
  const { specialty, insurance, query } = args;

  // Start with all active therapists
  let therapists: any[] = [];

  const { data, error } = await supabase
    .from("therapists")
    .select("id, name, bio, specialties, accepted_insurance")
    .eq("is_active", true);

  if (error) {
    console.error("DB error:", error);
    return { error: "Couldn't fetch therapists" };
  }

  therapists = data || [];
  const allTherapists = [...therapists]; // Keep a copy of all therapists

  // Filter by specialty
  if (specialty) {
    const spec = specialty.toLowerCase();
    therapists = therapists.filter((t: any) =>
      t.specialties &&
      JSON.stringify(t.specialties).toLowerCase().includes(spec)
    );
  }

  // Filter by insurance
  if (insurance) {
    const ins = insurance.toLowerCase();
    therapists = therapists.filter((t: any) =>
      t.accepted_insurance &&
      JSON.stringify(t.accepted_insurance).toLowerCase().includes(ins)
    );
  }

  // Filter by general query
  if (query) {
    const q = query.toLowerCase();
    therapists = therapists.filter((t: any) =>
      (t.name && t.name.toLowerCase().includes(q)) ||
      (t.bio && t.bio.toLowerCase().includes(q)) ||
      (t.specialties && JSON.stringify(t.specialties).toLowerCase().includes(q))
    );
  }

  // If filters yielded no results, return all therapists instead of empty
  // This ensures users always get therapist options
  if (therapists.length === 0 && allTherapists.length > 0) {
    console.log("⚠️ No exact matches found, returning all therapists");
    therapists = allTherapists;
  }

  return {
    count: therapists.length,
    therapists: therapists.slice(0, 10).map((t: any) => ({
      id: t.id,
      name: t.name,
      bio: t.bio?.substring(0, 150) + "...",
      specialties: t.specialties,
      insurance: t.accepted_insurance,
    })),
  };
}

async function toolGetTherapistDetails(supabase: any, args: any) {
  const { therapistId, therapistName } = args;

  let query = supabase
    .from("therapists")
    .select("id, name, bio, specialties, accepted_insurance, is_active");

  if (therapistId) {
    query = query.eq("id", therapistId);
  } else if (therapistName) {
    query = query.ilike("name", `%${therapistName}%`);
  } else {
    return { error: "Need therapist ID or name" };
  }

  const { data, error } = await query.single();

  if (error || !data) {
    return { found: false, message: "Therapist not found" };
  }

  return {
    found: true,
    therapist: {
      id: data.id,
      name: data.name,
      bio: data.bio,
      specialties: data.specialties,
      acceptedInsurance: data.accepted_insurance,
    },
  };
}

async function toolCheckAvailableSlots(
  supabase: any,
  args: any,
  timeZone: string,
) {
  const { therapistId, date } = args;

  console.log("=== CHECK AVAILABILITY ===");
  console.log("Therapist ID:", therapistId);
  console.log("Date:", date);

  // Parse date
  let targetDate = parseFlexibleDate(date);

  // Get appointments for that day
  const dayStart = new Date(targetDate);
  dayStart.setHours(9, 0, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(17, 0, 0, 0); // Changed to 5 PM to match working hours

  const { data: appointments } = await supabase
    .from("appointments")
    .select("start_time, end_time")
    .eq("therapist_id", therapistId)
    .gte("start_time", dayStart.toISOString())
    .lte("end_time", dayEnd.toISOString());

  // Generate hourly slots from 9 AM to 5 PM (last slot at 4 PM for 1-hour session ending at 5 PM)
  const slots: any[] = [];
  for (let hour = 9; hour < 17; hour++) {
    const slotStart = new Date(targetDate);
    slotStart.setHours(hour, 0, 0, 0);
    const slotEnd = new Date(targetDate);
    slotEnd.setHours(hour + 1, 0, 0, 0);

    const isBooked = (appointments || []).some((apt: any) => {
      const aptStart = new Date(apt.start_time);
      const aptEnd = new Date(apt.end_time);
      return slotStart < aptEnd && slotEnd > aptStart;
    });

    const isPast = slotStart < new Date();

    if (!isBooked && !isPast) {
      slots.push({
        startTime: slotStart.toISOString(),
        endTime: slotEnd.toISOString(),
        displayTime: slotStart.toLocaleTimeString("en-US", {
          timeZone,
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
      });
    }
  }

  console.log("Found slots:", slots.length);

  return {
    therapistId: therapistId, // Include for easy booking
    date: targetDate.toLocaleDateString("en-US", {
      timeZone,
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
    availableSlots: slots,
    count: slots.length,
    message: slots.length > 0
      ? `Found ${slots.length} available slots`
      : "No slots available that day",
  };
}

async function toolBookAppointment(
  supabase: any,
  args: any,
  inquiry: any,
  authHeader: string,
) {
  const { therapistId, startTime, endTime, problem } = args;

  // DETAILED LOGGING FOR DEBUGGING
  console.log("=== BOOKING ATTEMPT ===");
  console.log("Args received:", JSON.stringify(args));
  console.log("Therapist ID:", therapistId);
  console.log("Start Time:", startTime);
  console.log("End Time:", endTime);
  console.log("Inquiry:", inquiry?.id);

  // Validate required fields
  if (!therapistId) {
    console.error("ERROR: Missing therapistId");
    return { success: false, error: "Missing therapist ID" };
  }
  if (!startTime) {
    console.error("ERROR: Missing startTime");
    return { success: false, error: "Missing start time" };
  }
  if (!endTime) {
    console.error("ERROR: Missing endTime - will calculate");
    // Calculate end time if not provided (1 hour default)
  }
  if (!inquiry?.id) {
    console.error("ERROR: Missing inquiry");
    return { success: false, error: "Missing inquiry - session error" };
  }

  // Validate time
  const start = new Date(startTime);
  const now = new Date();

  console.log("Parsed start time:", start.toISOString());
  console.log("Current time:", now.toISOString());

  if (isNaN(start.getTime())) {
    console.error("ERROR: Invalid start time format");
    return { success: false, error: "Invalid time format" };
  }

  if (start < now) {
    console.error("ERROR: Time is in the past");
    return { success: false, error: "Can't book appointments in the past" };
  }

  // Calculate end time if not provided
  const end = endTime
    ? new Date(endTime)
    : new Date(start.getTime() + 60 * 60 * 1000);
  const endTimeStr = endTime || end.toISOString();

  // Check availability (double-booking prevention)
  console.log("Checking for conflicts...");
  const { data: conflicts, error: conflictError } = await supabase
    .from("appointments")
    .select("id")
    .eq("therapist_id", therapistId)
    .lt("start_time", endTimeStr)
    .gt("end_time", startTime);

  if (conflictError) {
    console.error("Conflict check error:", conflictError);
  }

  if (conflicts && conflicts.length > 0) {
    console.error("ERROR: Time slot has conflicts:", conflicts);
    return { success: false, error: "Time slot is already booked" };
  }

  console.log("No conflicts found, proceeding to book...");

  // Create appointment
  const insertData = {
    inquiry_id: inquiry.id,
    therapist_id: therapistId,
    start_time: startTime,
    end_time: endTimeStr,
    status: "scheduled",
  };
  console.log("Inserting:", JSON.stringify(insertData));

  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert(insertData)
    .select(`
      id,
      start_time,
      end_time,
      therapists (id, name)
    `)
    .single();

  if (error) {
    console.error("=== BOOKING FAILED ===");
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
    console.error("Error details:", error.details);
    console.error("Full error:", JSON.stringify(error));
    return { success: false, error: `Failed to book: ${error.message}` };
  }

  console.log("=== BOOKING SUCCESS ===");
  console.log("Appointment created:", appointment?.id);

  // Update inquiry (DB schema: problem_description, extracted_specialty, matched_therapist_id, status)
  if (problem) {
    await supabase
      .from("inquiries")
      .update({
        extracted_specialty: problem,
        problem_description: problem,
        matched_therapist_id: therapistId,
        status: "scheduled",
      })
      .eq("id", inquiry.id);
  }

  return {
    success: true,
    message: "Appointment booked successfully!",
    appointment: {
      id: appointment.id,
      therapistName: appointment.therapists?.name,
      startTime: appointment.start_time,
      endTime: appointment.end_time,
    },
  };
}

async function toolViewMyAppointments(
  supabase: any,
  patientId: string,
  args: any,
  timeZone: string,
) {
  const status = args.status || "upcoming";
  const now = new Date().toISOString();

  // Get inquiries for this patient
  const { data: inquiries } = await supabase
    .from("inquiries")
    .select("id")
    .eq("patient_identifier", patientId);

  if (!inquiries || inquiries.length === 0) {
    return { count: 0, appointments: [], message: "No appointments found" };
  }

  const inquiryIds = inquiries.map((i: any) => i.id);

  // Query appointments
  let query = supabase
    .from("appointments")
    .select(`
      id,
      start_time,
      end_time,
      status,
      therapists (id, name, specialties)
    `)
    .in("inquiry_id", inquiryIds)
    .order("start_time", { ascending: true });

  if (status === "upcoming") {
    query = query.gte("start_time", now);
  } else if (status === "past") {
    query = query.lt("start_time", now);
  }

  const { data: appointments } = await query;

  const formatted = (appointments || []).map((apt: any, i: number) => ({
    number: i + 1,
    id: apt.id,
    therapistName: apt.therapists?.name || "Unknown",
    therapistId: apt.therapists?.id,
    startTime: new Date(apt.start_time).toLocaleString("en-US", { timeZone }),
    endTime: new Date(apt.end_time).toLocaleString("en-US", { timeZone }),
    startTimeISO: apt.start_time,
    status: apt.status,
  }));

  return {
    count: formatted.length,
    appointments: formatted,
    message: formatted.length > 0
      ? `You have ${formatted.length} ${status} appointment(s)`
      : `No ${status} appointments`,
  };
}

async function toolCancelAppointment(
  supabase: any,
  args: any,
  authHeader: string,
) {
  const { appointmentId } = args;

  if (!appointmentId) {
    return {
      success: false,
      error: "Please specify which appointment to cancel",
    };
  }

  // Fetch appointment
  const { data: appointment, error: fetchError } = await supabase
    .from("appointments")
    .select("id, start_time, therapists (name)")
    .eq("id", appointmentId)
    .single();

  if (fetchError || !appointment) {
    return { success: false, error: "Appointment not found" };
  }

  // Cancel it
  const { error: cancelError } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointmentId);

  if (cancelError) {
    return { success: false, error: "Failed to cancel appointment" };
  }

  return {
    success: true,
    message:
      `Appointment with ${appointment.therapists?.name} has been cancelled`,
    cancelled: {
      id: appointment.id,
      therapistName: appointment.therapists?.name,
      wasScheduledFor: appointment.start_time,
    },
  };
}

async function toolRescheduleAppointment(
  supabase: any,
  args: any,
  timeZone: string,
) {
  const { appointmentId, newStartTime, newEndTime } = args;

  if (!appointmentId) {
    return {
      success: false,
      error: "Please specify which appointment to reschedule",
    };
  }

  if (!newStartTime || !newEndTime) {
    return { success: false, error: "Please provide the new date and time" };
  }

  // Validate new time
  const newStart = new Date(newStartTime);
  const now = new Date();

  if (newStart < now) {
    return { success: false, error: "Can't reschedule to the past" };
  }

  const hour = newStart.getHours();
  if (hour < 9 || hour >= 18) {
    return { success: false, error: "Outside working hours (9 AM - 6 PM)" };
  }

  // Fetch appointment
  const { data: appointment, error: fetchError } = await supabase
    .from("appointments")
    .select("id, therapist_id, start_time, therapists (name)")
    .eq("id", appointmentId)
    .single();

  if (fetchError || !appointment) {
    return { success: false, error: "Appointment not found" };
  }

  // Check for conflicts
  const { data: conflicts } = await supabase
    .from("appointments")
    .select("id")
    .eq("therapist_id", appointment.therapist_id)
    .neq("id", appointmentId)
    .lt("start_time", newEndTime)
    .gt("end_time", newStartTime);

  if (conflicts && conflicts.length > 0) {
    return { success: false, error: "That time slot is already booked" };
  }

  // Update appointment
  const { error: updateError } = await supabase
    .from("appointments")
    .update({
      start_time: newStartTime,
      end_time: newEndTime,
    })
    .eq("id", appointmentId);

  if (updateError) {
    return { success: false, error: "Failed to reschedule" };
  }

  return {
    success: true,
    message: `Appointment rescheduled successfully`,
    rescheduled: {
      id: appointment.id,
      therapistName: appointment.therapists?.name,
      oldTime: new Date(appointment.start_time).toLocaleString("en-US", {
        timeZone,
      }),
      newTime: new Date(newStartTime).toLocaleString("en-US", { timeZone }),
    },
  };
}

function toolListInsurance() {
  return {
    insuranceProviders: [
      "Aetna",
      "Blue Cross Blue Shield",
      "Cigna",
      "UnitedHealthcare",
      "Humana",
      "Kaiser Permanente",
      "Medicare",
      "Medicaid",
    ],
    message: "We accept 8 major insurance providers",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE-BASED CONVERSATION (Fallback when AI is unavailable)
// ─────────────────────────────────────────────────────────────────────────────

async function ruleBasedConversation({
  supabaseClient,
  userMessage,
  context,
}: any) {
  const msg = userMessage.toLowerCase();

  // =====================================================
  // PRIORITY 1: CRISIS/SUICIDE DETECTION - Always check first!
  // =====================================================
  const crisisKeywords = [
    "suicide",
    "suicidal",
    "kill myself",
    "end my life",
    "want to die",
    "don't want to live",
    "hurt myself",
    "self harm",
    "self-harm",
    "no reason to live",
    "better off dead",
    "ending it all",
  ];

  const isCrisis = crisisKeywords.some((k) => msg.includes(k));

  if (isCrisis) {
    return {
      success: true,
      message:
        `I'm really glad you reached out. What you're feeling is serious, and you deserve immediate support.

PLEASE REACH OUT NOW:

- India: iCall - 9152987821
- India: Vandrevala Foundation - 1860-2662-345
- India: AASRA - 91-22-27546669
- US: National Suicide Prevention Lifeline - 988
- International: findahelpline.com

If you're in immediate danger, please call your local emergency number (112 in India, 911 in US).

You matter, and help is available right now. Would you like me to help you find a therapist for ongoing support once you're feeling safer?`,
    };
  }

  // =====================================================
  // PRIORITY 2: INSURANCE QUESTIONS
  // =====================================================
  if (
    msg.includes("insurance") || msg.includes("accept") ||
    msg.includes("cover") || msg.includes("payment")
  ) {
    return {
      success: true,
      message: `We accept these insurance providers:

- Blue Cross Blue Shield
- Aetna
- Cigna  
- UnitedHealthcare
- Humana
- Kaiser Permanente
- Medicare
- Medicaid

Which insurance do you have? I can help find therapists who accept it!

Or type "show therapists" to see all our therapists.`,
    };
  }

  // =====================================================
  // PRIORITY 3: THERAPIST LIST
  // =====================================================
  // Only trigger for therapist list if NOT asking about insurance
  const isInsuranceRelated = msg.includes("insurance");
  if (
    !isInsuranceRelated && (
      msg.includes("therapist") || msg.includes("show all") ||
      msg.includes("list") || msg.includes("doctor")
    )
  ) {
    const { data: therapists } = await supabaseClient
      .from("therapists")
      .select("id, name, specialties, accepted_insurance")
      .eq("is_active", true)
      .limit(10);

    if (!therapists || therapists.length === 0) {
      return {
        success: true,
        message:
          "I couldn't find any therapists right now. Please try again in a moment.",
      };
    }

    let response = "Here are our available therapists:\n\n";
    therapists.forEach((t: any, i: number) => {
      const specs = Array.isArray(t.specialties)
        ? t.specialties.slice(0, 3).join(", ")
        : "General";
      response += `${i + 1}. ${t.name}\n   Specialties: ${specs}\n\n`;
    });
    response +=
      "Which therapist interests you? Or tell me what you need help with!";

    return { success: true, message: response };
  }

  // =====================================================
  // PRIORITY 4: MENTAL HEALTH EDUCATION
  // =====================================================
  if (
    msg.includes("what is") || msg.includes("explain") ||
    msg.includes("mental health") ||
    msg.includes("about anxiety") || msg.includes("about depression") ||
    msg.includes("about therapy")
  ) {
    if (msg.includes("anxiety")) {
      return {
        success: true,
        message:
          `Anxiety is your body's natural stress response. It's normal to feel anxious sometimes, but when anxiety becomes overwhelming or constant, therapy can help.

Common signs:
- Excessive worry
- Racing thoughts
- Physical symptoms (racing heart, sweating)
- Difficulty sleeping
- Avoiding situations

Many of our therapists specialize in anxiety treatment. Would you like me to find one for you?`,
      };
    }

    if (msg.includes("depression")) {
      return {
        success: true,
        message:
          `Depression is more than just feeling sad - it's a treatable condition that affects how you feel, think, and handle daily activities.

Common signs:
- Persistent sadness or emptiness
- Loss of interest in activities you used to enjoy
- Changes in sleep or appetite
- Difficulty concentrating
- Feelings of worthlessness

Therapy is very effective for depression. Would you like me to find a therapist who specializes in this?`,
      };
    }

    if (msg.includes("therapy") || msg.includes("counseling")) {
      return {
        success: true,
        message:
          `Therapy (or counseling) is a safe space to talk with a trained professional about what you're going through.

What happens in therapy:
- You share your thoughts and feelings
- The therapist helps you understand patterns
- Together you develop coping strategies
- Sessions are confidential
- Typically 45-60 minutes weekly

Types we offer:
- Individual therapy (1-on-1)
- Couples therapy
- Trauma-focused therapy (EMDR)

Would you like to see our therapists and book a session?`,
      };
    }

    // General mental health
    return {
      success: true,
      message:
        `Mental health is just as important as physical health. It includes your emotional, psychological, and social well-being.

Common conditions we treat:
- Anxiety and panic
- Depression
- Trauma and PTSD
- Relationship issues
- Work stress and burnout
- Grief and loss
- Life transitions

Taking care of your mental health is a sign of strength. Would you like me to help you find a therapist?`,
    };
  }

  // =====================================================
  // PRIORITY 5: BOOKING INTENT
  // =====================================================
  if (
    msg.includes("book") || msg.includes("appointment") ||
    msg.includes("schedule") || msg.includes("see someone")
  ) {
    return {
      success: true,
      message: `I'd love to help you book an appointment!

To find the right therapist, tell me:
1. What you're seeking help with (anxiety, depression, stress, etc.)
2. Your insurance provider (optional)

Or you can:
- Type "show therapists" to browse all
- Type "show insurance" to see accepted plans

What would you like to do?`,
    };
  }

  // =====================================================
  // PRIORITY 6: EMOTIONAL SUPPORT (Not booking yet)
  // =====================================================
  const emotionalWords = [
    "anxious",
    "anxiety",
    "depressed",
    "depression",
    "sad",
    "stressed",
    "overwhelmed",
    "struggling",
    "grief",
    "loss",
    "tired",
    "exhausted",
    "burnout",
    "lonely",
    "scared",
    "worried",
    "hopeless",
  ];

  const hasEmotionalContent = emotionalWords.some((e) => msg.includes(e));

  if (hasEmotionalContent) {
    return {
      success: true,
      message:
        `I hear you, and I'm glad you're reaching out. What you're feeling is valid.

Talking to a professional can really help. Our therapists specialize in:
- Anxiety and stress
- Depression
- Burnout and overwhelm
- Grief and loss
- Life challenges

Would you like me to find a therapist who can help with what you're experiencing?

Just say "yes" or "show therapists" to see our team.`,
    };
  }

  // =====================================================
  // PRIORITY 7: HELP/MENU REQUEST
  // =====================================================
  if (
    msg.includes("help") || msg.includes("menu") || msg.includes("options") ||
    msg.includes("what can you do")
  ) {
    return {
      success: true,
      message:
        `I'm Kai, your therapy appointment assistant. Here's what I can help with:

1. "Show therapists" - Browse our team
2. "Show insurance" - See accepted insurance
3. "Book appointment" - Schedule a session
4. "What is anxiety?" - Learn about mental health
5. "What is therapy?" - Understand how therapy works

If you're in crisis and need immediate help, just tell me and I'll provide emergency resources.

What would you like to do?`,
    };
  }

  // =====================================================
  // DEFAULT: Friendly fallback with options
  // =====================================================
  return {
    success: true,
    message: `Hi! I'm Kai, your appointment assistant.

I can help you with:
- Find a therapist (say "show therapists")
- Learn about insurance we accept (say "show insurance")  
- Book an appointment (say "book appointment")
- Understand mental health topics (say "what is anxiety?" or "what is therapy?")
- Get crisis support if you need it

What would you like to do today?`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 🛠️ UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

async function getOrCreateInquiry(supabase: any, patientId: string) {
  // Try to find existing inquiry
  const { data: existing } = await supabase
    .from("inquiries")
    .select("*")
    .eq("patient_identifier", patientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    return existing;
  }

  // Create new inquiry
  const { data: newInquiry, error } = await supabase
    .from("inquiries")
    .insert({
      patient_identifier: patientId,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating inquiry:", error);
    throw new Error("Failed to create inquiry");
  }

  return newInquiry;
}

function parseFlexibleDate(dateStr: string): Date {
  const str = dateStr.toLowerCase();
  const date = new Date();

  if (str === "today") {
    return date;
  }

  if (str === "tomorrow") {
    date.setDate(date.getDate() + 1);
    return date;
  }

  if (str.includes("next week")) {
    date.setDate(date.getDate() + 7);
    return date;
  }

  if (str.includes("monday")) {
    const daysUntilMonday = (8 - date.getDay()) % 7 || 7;
    date.setDate(date.getDate() + daysUntilMonday);
    return date;
  }

  if (str.includes("tuesday")) {
    const daysUntilTuesday = (9 - date.getDay()) % 7 || 7;
    date.setDate(date.getDate() + daysUntilTuesday);
    return date;
  }

  // Try ISO date
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  // Default to tomorrow
  date.setDate(date.getDate() + 1);
  return date;
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
