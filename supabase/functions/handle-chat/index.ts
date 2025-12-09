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
  return `You are Kai, a warm, caring, and emotionally intelligent assistant for a therapy practice.

YOUR CORE IDENTITY:
You're like a supportive friend who happens to work at a therapy office. You genuinely care about people's wellbeing. Your job is to help people feel heard AND get connected with the right therapist.

EMOTIONAL INTELLIGENCE (Most Important!):

When someone shares something emotional (feeling depressed, anxious, stressed, etc):
1. FIRST - Acknowledge and validate: "I'm really sorry you're going through this..." or "That sounds really difficult..."
2. THEN - Normalize: "A lot of people feel this way, and it takes courage to reach out"
3. FINALLY - Gently offer help: "I'd love to help you find someone to talk to..."

NEVER jump straight to listing therapists when someone shares pain. Always acknowledge first.

EXAMPLE RESPONSES:

Bad (too transactional):
User: "I've been really depressed lately"
Bot: "Here are therapists who specialize in depression: 1. Dr. Smith..."

Good (empathetic):
User: "I've been really depressed lately"
Bot: "I'm really sorry you're going through this. Depression can feel so heavy, and I want you to know that reaching out is a brave first step. 

I'd love to help you find a therapist who specializes in this. Would you like me to show you a few options who might be a good fit?"

CONVERSATIONAL STYLE:

- Be warm and genuine, like a caring friend
- Use contractions naturally: "I'd", "you're", "that's"
- Show you're listening: "I hear you", "That makes sense"
- Don't be robotic or overly formal
- Use empathetic phrases: "I can imagine...", "That sounds tough..."
- Ask permission before moving forward: "Would you like me to...?"

BOOKING FLOW (After emotional connection):

1. Acknowledge feelings → Offer to help find someone
2. User agrees → Show 3-4 thoughtful therapist options with warm introductions
3. User picks one → "Great choice! Let me check when they're available..."
4. Show times → "Does any of these work for you?"
5. Book → Celebrate warmly: "You're all set! I'm really glad you're taking this step."

WHEN LISTING THERAPISTS:

Instead of just listing, introduce them warmly:
"I found a few therapists who could really help with what you're experiencing:

1. **Sarah Chen** - She's wonderful with anxiety and has helped many people feel more grounded. 

2. **David Park** - He specializes in depression and has a very calming, supportive approach.

Any of these resonate with you?"

CURRENT CONTEXT:
Time: ${context.currentTime}
Timezone: ${context.timeZone}  
Patient ID: ${context.patientId}

REMEMBER:
- People reaching out for therapy are often vulnerable
- Your warmth can make the difference between someone booking or giving up
- Efficiency matters, but empathy matters more
- You're not just a booking bot - you're often the first caring voice they encounter`;
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
    // Check if asking about a SPECIFIC therapist's insurance
    const { data: therapistsForInsurance } = await supabaseClient
      .from("therapists")
      .select("id, name, accepted_insurance")
      .eq("is_active", true);

    if (therapistsForInsurance && therapistsForInsurance.length > 0) {
      // Check if user mentioned any therapist name
      const mentionedTherapist = therapistsForInsurance.find((t: any) => {
        const firstName = t.name.split(" ")[0].toLowerCase();
        const lastName = t.name.split(" ").pop()?.toLowerCase() || "";
        return msg.includes(firstName) || msg.includes(lastName) ||
          msg.includes(t.name.toLowerCase());
      });

      if (mentionedTherapist) {
        const insurance = Array.isArray(mentionedTherapist.accepted_insurance)
          ? mentionedTherapist.accepted_insurance.join("\n- ")
          : "Information not available";

        return {
          success: true,
          message:
            `${mentionedTherapist.name} accepts the following insurance providers:

- ${insurance}

Would you like to book an appointment with ${mentionedTherapist.name}? Just say "book with ${
              mentionedTherapist.name.split(" ")[0]
            }" or tell me when you'd like to schedule!`,
          therapistId: mentionedTherapist.id,
          therapistName: mentionedTherapist.name,
        };
      }
    }

    // Generic insurance question (no specific therapist mentioned)
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
    // Customize response based on specific emotion mentioned
    let empathyMessage = "";

    if (
      msg.includes("depress") || msg.includes("sad") || msg.includes("hopeless")
    ) {
      empathyMessage =
        `I'm really sorry you're feeling this way. Depression can feel so heavy and isolating, and I want you to know that reaching out right now took courage.

You don't have to carry this alone. A lot of people have found relief by talking to someone who understands what you're going through.`;
    } else if (
      msg.includes("anxi") || msg.includes("worried") || msg.includes("scared")
    ) {
      empathyMessage =
        `I hear you, and I'm sorry you're dealing with this. Anxiety can be really overwhelming, and it's completely okay to need support.

The good news is that there are therapists who specialize in exactly this, and they've helped many people feel more at peace.`;
    } else if (
      msg.includes("stress") || msg.includes("overwhelm") ||
      msg.includes("burnout") || msg.includes("exhaust")
    ) {
      empathyMessage =
        `That sounds really exhausting. When life feels like too much, it's so important to have someone in your corner.

You're doing the right thing by reaching out. Taking care of yourself isn't selfish – it's necessary.`;
    } else if (msg.includes("grief") || msg.includes("loss")) {
      empathyMessage =
        `I'm so sorry for what you're going through. Grief is one of the hardest things we experience, and there's no right way to feel about it.

Having someone to talk to can really help during this time.`;
    } else if (msg.includes("lonely") || msg.includes("alone")) {
      empathyMessage =
        `Feeling lonely is really painful, and I'm glad you're reaching out. You're not as alone as you might feel right now.

Talking to a therapist can help you work through these feelings and build connection.`;
    } else {
      empathyMessage =
        `I hear you, and I'm really glad you shared that with me. Whatever you're going through, you don't have to face it alone.

It takes real strength to reach out, and I'd love to help you find someone to talk to.`;
    }

    return {
      success: true,
      message: `${empathyMessage}

Would you like me to show you a few therapists who could be a good fit? Just say "yes" and I'll find some options for you. 💙`,
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
  // PRIORITY 8: THERAPIST SELECTION / NAME MENTIONED
  // =====================================================
  // Try to find if user mentioned a therapist name
  const { data: allTherapists } = await supabaseClient
    .from("therapists")
    .select("id, name, specialties")
    .eq("is_active", true);

  if (allTherapists && allTherapists.length > 0) {
    // Check if user mentioned any therapist name (check first name)
    const mentionedTherapist = allTherapists.find((t: any) => {
      const firstName = t.name.split(" ")[0].toLowerCase();
      const lastName = t.name.split(" ").pop()?.toLowerCase() || "";
      return msg.includes(firstName) || msg.includes(lastName) ||
        msg.includes(t.name.toLowerCase());
    });

    if (mentionedTherapist) {
      const specs = Array.isArray(mentionedTherapist.specialties)
        ? mentionedTherapist.specialties.slice(0, 3).join(", ")
        : "various areas";

      return {
        success: true,
        message:
          `Great choice! ${mentionedTherapist.name} specializes in ${specs}.

I'd love to book you with them! When would work for you?

You can say:
- "Tomorrow" or "next Monday"
- A specific date like "December 15"
- "Check availability" to see open slots

What works best for you?`,
        therapistId: mentionedTherapist.id,
        therapistName: mentionedTherapist.name,
        nextAction: "check-availability",
      };
    }
  }

  // =====================================================
  // PRIORITY 9: DATE/TIME MENTIONED (wants to book)
  // =====================================================
  const dateWords = [
    "today",
    "tomorrow",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
    "next week",
    "morning",
    "afternoon",
    "evening",
    "pm",
    "am",
  ];
  const hasDateMention = dateWords.some((d) => msg.includes(d));

  if (hasDateMention) {
    return {
      success: true,
      message: `I'd be happy to help you book for that time!

To find the right slot, I need to know which therapist you'd like to see.

Would you like me to:
- Show all our therapists? (say "show therapists")
- Help you find one based on your needs? (tell me what you're dealing with)

What would you like to do?`,
    };
  }

  // =====================================================
  // PRIORITY 10: YES/CONFIRM RESPONSES
  // =====================================================
  if (
    msg === "yes" || msg === "yeah" || msg === "ok" || msg === "sure" ||
    msg === "please"
  ) {
    return {
      success: true,
      message: `Perfect! Let me help you find a therapist.

What would you like help with? For example:
- Anxiety or stress
- Depression
- Relationship issues
- Life transitions

Or just say "show therapists" to see our full team!`,
    };
  }

  // =====================================================
  // DEFAULT: Friendly fallback with options
  // =====================================================
  return {
    success: true,
    message: `I want to make sure I help you correctly!

Here's what I can do:
- **Show therapists** - Browse our team
- **Show insurance** - See accepted plans
- **Book appointment** - Schedule a session

You can also tell me:
- What you're looking for help with
- A therapist's name if you know who you want to see
- When you'd like to schedule

What would you like to do?`,
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
