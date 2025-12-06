// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { GoogleGenAI } from "npm:@google/genai";

// Define types for extracted data and responses
interface ExtractedData {
  problem: string;
  schedule: string;
  insurance: string;
  booking_intent: "yes" | "no" | "clarification" | "not specified";
}

interface ChatResponse {
  success: boolean;
  extractedData?: ExtractedData;
  followUpQuestion?: string;
  nextAction: string;
  inquiryId?: string;
  message: string;
  therapistId?: string;
  startTime?: string;
  endTime?: string;
}

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

console.log("Handle-Chat Function initialized (using @google/genai SDK)");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const body = await req.json();
    const userMessage = body.userMessage || "";
    const patientId = body.patientId || "anon-123";
    const conversationHistory = body.conversationHistory || [];
    const frontendMatchedTherapistId = body.matchedTherapistId || null;

    if (!userMessage) {
      return new Response(JSON.stringify({ success: false, error: "userMessage is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("Processing message:", userMessage);

    let inquiry: any = null;
    const existingInquiryId = await getInquiryId(supabaseClient, patientId);
    if (existingInquiryId) {
      const { data } = await supabaseClient.from('inquiries').select('*').eq('id', existingInquiryId).single();
      inquiry = data;
    }
    console.log("Existing inquiry:", inquiry);

    if (frontendMatchedTherapistId && inquiry && !inquiry.matched_therapist_id) {
      const { data: updatedInquiry, error } = await supabaseClient
        .from('inquiries')
        .update({ matched_therapist_id: frontendMatchedTherapistId, status: 'matched' })
        .eq('id', inquiry.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating inquiry with matched_therapist_id", error);
      } else {
        inquiry = updatedInquiry; // Use the updated inquiry object
      }
    }

    const extractedData = await extractInfoWithGemini(userMessage, conversationHistory, inquiry);
    console.log("Extracted data:", extractedData);

    const inquiryId = await saveInquiry(supabaseClient, extractedData, patientId, inquiry?.id);
    console.log("Inquiry saved/updated with ID:", inquiryId);

    const { data: latestInquiry } = await supabaseClient.from('inquiries').select('*').eq('id', inquiryId).single();

    const scheduleToUse = (extractedData.schedule && extractedData.schedule !== 'not specified') 
        ? extractedData.schedule
        : latestInquiry.requested_schedule;

    if (latestInquiry?.matched_therapist_id && extractedData.booking_intent === 'yes') {
      if (scheduleToUse) {
        const schedLower = scheduleToUse.toLowerCase();
        console.log("=== PARSING SCHEDULE ===");
        console.log("Input:", scheduleToUse);
        
        let appointmentDate = new Date();
        let hour = 9, minute = 0; // Default to 9 AM
        let timeFound = false;
        
        // STEP 1: Extract TIME - be very specific about patterns
        // Pattern 1: Look for "X am" or "X pm" (with or without space)
        let timeMatch = schedLower.match(/(\d{1,2})(?::(\d{2}))?\s*(?:am|pm)/);
        if (timeMatch) {
          hour = parseInt(timeMatch[1], 10);
          minute = parseInt(timeMatch[2] || "0", 10);
          const meridiem = schedLower.includes('pm') ? 'pm' : 'am';
          if (meridiem === 'pm' && hour < 12) hour += 12;
          if (meridiem === 'am' && hour === 12) hour = 0;
          timeFound = true;
          console.log(`✓ Found time with am/pm: ${hour}:${minute}`);
        }
        
        // Pattern 2: Look for "at X" or "at X:XX"
        if (!timeFound) {
          timeMatch = schedLower.match(/\bat\s+(\d{1,2})(?::(\d{2}))?/);
          if (timeMatch) {
            hour = parseInt(timeMatch[1], 10);
            minute = parseInt(timeMatch[2] || "0", 10);
            // If hour is 1-7, assume PM (afternoon appointments)
            if (hour >= 1 && hour <= 7) hour += 12;
            timeFound = true;
            console.log(`✓ Found time after 'at': ${hour}:${minute}`);
          }
        }
        
        // Validate time is reasonable
        if (hour < 6 || hour > 22) {
          console.log(`⚠ Unusual hour ${hour}, resetting to 9 AM`);
          hour = 9;
          minute = 0;
        }
        
        // STEP 2: Extract MONTH
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                           'july', 'august', 'september', 'october', 'november', 'december'];
        let monthIndex = -1;
        
        for (let i = 0; i < monthNames.length; i++) {
          if (schedLower.includes(monthNames[i]) || schedLower.includes(monthNames[i].substring(0, 3))) {
            monthIndex = i;
            console.log(`✓ Found month: ${monthNames[i]} (index ${i})`);
            break;
          }
        }
        
        // STEP 3: Extract DAY - only look for numbers NOT used in time
        let dayOfMonth = appointmentDate.getDate(); // Default to today
        
        // Find all numbers in the string
        const numberPattern = /(\d{1,2})/g;
        const allNumbers = [...schedLower.matchAll(numberPattern)];
        console.log(`All numbers found: ${allNumbers.map(m => m[1]).join(', ')}`);
        
        // Filter out the time-related numbers
        const candidateDays = allNumbers
          .map(m => parseInt(m[1], 10))
          .filter(num => {
            // Exclude if it's the hour or minute we already found
            if (timeFound && (num === hour || num === (hour > 12 ? hour - 12 : hour) || num === minute)) {
              console.log(`  Skipping ${num} - it's part of the time`);
              return false;
            }
            // Only accept valid day numbers
            if (num < 1 || num > 31) {
              console.log(`  Skipping ${num} - out of valid day range`);
              return false;
            }
            return true;
          });
        
        if (candidateDays.length > 0) {
          dayOfMonth = candidateDays[0]; // Use the first valid day candidate
          console.log(`✓ Using day: ${dayOfMonth}`);
        }
        
        // STEP 4: Construct the final date
        if (monthIndex !== -1) {
          appointmentDate = new Date(2025, monthIndex, dayOfMonth);
        } else {
          appointmentDate.setDate(dayOfMonth);
        }
        
        appointmentDate.setHours(hour, minute, 0, 0);
        console.log(`✓ Final datetime: ${appointmentDate.toLocaleString()}`);
        console.log("======================");
        
        // Format for Google Calendar
        const pad = (n: number) => n.toString().padStart(2, '0');
        const startTimeStr = `${appointmentDate.getFullYear()}-${pad(appointmentDate.getMonth() + 1)}-${pad(appointmentDate.getDate())}T${pad(appointmentDate.getHours())}:${pad(appointmentDate.getMinutes())}:00`;
        
        appointmentDate.setHours(appointmentDate.getHours() + 1);
        const endTimeStr = `${appointmentDate.getFullYear()}-${pad(appointmentDate.getMonth() + 1)}-${pad(appointmentDate.getDate())}T${pad(appointmentDate.getHours())}:${pad(appointmentDate.getMinutes())}:00`;

        return new Response(JSON.stringify({
          success: true,
          nextAction: 'book-appointment',
          message: `Perfect, I will now book your appointment for ${scheduleToUse}`,
          inquiryId: latestInquiry.id,
          therapistId: latestInquiry.matched_therapist_id,
          startTime: startTimeStr,
          endTime: endTimeStr,
          timeZone: 'Asia/Kolkata'
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        return new Response(JSON.stringify({
          success: true,
          nextAction: 'awaiting-info',
          message: "Great! What time would you like to schedule the appointment?",
          inquiryId: latestInquiry.id,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const response = prepareResponse(latestInquiry, inquiryId);
    return new Response(JSON.stringify(response), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Error in handle-chat:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

async function getInquiryId(supabase: any, patientId: string): Promise<string | null> {
    if (!patientId) return null;
    const { data, error } = await supabase.from('inquiries').select('id').eq('patient_identifier', patientId).order('created_at', { ascending: false }).limit(1).single();
    if (error || !data) return null;
    return data.id;
}

async function saveInquiry(supabase: any, extractedData: ExtractedData, patientId?: string, existingInquiryId?: string): Promise<string> {
  const inquiryData: { [key: string]: any } = { patient_identifier: patientId || null };
  if (extractedData.problem && extractedData.problem !== 'not specified') inquiryData.extracted_specialty = extractedData.problem;
  if (extractedData.schedule && extractedData.schedule !== 'not specified') inquiryData.requested_schedule = extractedData.schedule;
  if (extractedData.insurance && extractedData.insurance !== 'not specified') inquiryData.insurance_info = extractedData.insurance;

  if (existingInquiryId) {
    const { data, error } = await supabase.from("inquiries").update(inquiryData).eq('id', existingInquiryId).select().single();
    if (error) throw new Error(`Failed to update inquiry: ${error.message}`);
    return data.id;
  } else {
    inquiryData.status = 'pending';
    const { data, error } = await supabase.from("inquiries").insert(inquiryData).select().single();
    if (error) throw new Error(`Failed to save inquiry: ${error.message}`);
    return data.id;
  }
}

function prepareResponse(inquiry: any, inquiryId: string): ChatResponse {
  const missingInfo: string[] = [];
  if (!inquiry.extracted_specialty) missingInfo.push("problem");
  if (!inquiry.requested_schedule) missingInfo.push("schedule");
  if (!inquiry.insurance_info) missingInfo.push("insurance");

  if (missingInfo.length === 0) {
    return {
      success: true,
      nextAction: "find-therapist",
      inquiryId,
      message: "Thank you! I have all the information I need. Let me find the best therapist match for you.",
    };
  }

  const followUpQuestion = generateFollowUpQuestion(missingInfo, inquiry);
  return {
    success: true,
    followUpQuestion,
    nextAction: "awaiting-info",
    inquiryId,
    message: followUpQuestion,
  };
}

function generateFollowUpQuestion(
  missingInfo: string[],
  inquiryData: any
): string {
  const acknowledgedParts: string[] = [];
  if (inquiryData.extracted_specialty) acknowledgedParts.push(`I understand you're dealing with ${inquiryData.extracted_specialty}`);
  if (inquiryData.requested_schedule) acknowledgedParts.push(`and you prefer ${inquiryData.requested_schedule}`);
  const acknowledgment = acknowledgedParts.length > 0 ? acknowledgedParts.join(", ") + ". " : "";

  if (missingInfo.includes("problem")) return `${acknowledgment}Could you tell me more about what you'd like help with? For example, are you dealing with anxiety, depression, stress, relationship issues, or something else?`;
  if (missingInfo.includes("schedule")) return `${acknowledgment}When would you prefer to have your appointments? Please let me know your preferred days and times.`;
  if (missingInfo.includes("insurance")) return `${acknowledgment}Do you have health insurance? If so, which provider? This will help me find therapists that accept your insurance.`;
  
  return `${acknowledgment}I need a bit more information to find the perfect therapist for you.`;
}

async function extractInfoWithGemini(userMessage: string, conversationHistory?: Array<{ role: string; content: string }>, inquiry?: any): Promise<ExtractedData> {
  const apiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is not set");
  const client = new GoogleGenAI({ apiKey });

  let contextMessages = "";
  if (conversationHistory && conversationHistory.length > 0) {
    contextMessages = conversationHistory.map((msg) => `${msg.role}: ${msg.content}`).join("\n") + "\n\n";
  }

  const bookingPrompt = inquiry?.matched_therapist_id
    ? `The user has been matched with a therapist and was asked if they want to book. Analyze their response for booking intent. If they provide a time, extract it into the 'schedule' field.`
    : "";

  // Hardcoded safety check for simple greetings to prevent hallucination
  const lowerMsg = userMessage.toLowerCase().trim();
  const greetings = ['hi', 'hello', 'hey', 'heyy', 'greetings', 'yo', 'sup'];
  if (lowerMsg.length < 20 && greetings.some(g => lowerMsg.includes(g))) {
      return {
          problem: "not specified",
          schedule: "not specified",
          insurance: "not specified",
          booking_intent: "not specified"
      };
  }

  // Construct known info string
  let knownInfo = "Known Information so far:\n";
  if (inquiry) {
      if (inquiry.extracted_specialty) knownInfo += `- Problem: ${inquiry.extracted_specialty}\n`;
      if (inquiry.requested_schedule) knownInfo += `- Schedule: ${inquiry.requested_schedule}\n`;
      if (inquiry.insurance_info) knownInfo += `- Insurance: ${inquiry.insurance_info}\n`;
  }

  const prompt = `You are a healthcare scheduling assistant.
${contextMessages}
${knownInfo}
Current user message: ${userMessage}
${bookingPrompt}

Extract the following information:
1. Main problem/symptoms.
2. Preferred schedule times.
3. Insurance provider.
4. Booking Intent ("yes", "no", "clarification", or "not specified").

Guidelines: 
- Use "not specified" for ANY missing information that represents a NEW detail not already known.
- If information is already listed in "Known Information", PRESERVE it unless the user explicitly changes it.
- If the user confirms a question (e.g. "yes I do"), infer the answer from context if possible or mark as "not specified" if specific details are still needed.
- Only extract "problem" if the user describes a medical or psychological issue.

Format your output strictly as JSON:
{"problem": "...", "schedule": "...", "insurance": "...", "booking_intent": "..."}`;

  const modelsToTry = ['gemini-2.5-flash'];
  for (const modelName of modelsToTry) {
    try {
      console.log(`Attempting Gemini Request using model: ${modelName}`);
      const response = await client.models.generateContent({
        model: modelName,
        contents: prompt,
        config: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 1024 }
      });
      const generatedText = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!generatedText) throw new Error("Empty response from AI SDK");
      console.log(`Success with model: ${modelName}`);
      return JSON.parse(generatedText) as ExtractedData;
    } catch (error: any) {
      console.warn(`Failed with model ${modelName}:`, error.message || error);
    }
  }
  throw new Error("All Gemini models failed.");
}
