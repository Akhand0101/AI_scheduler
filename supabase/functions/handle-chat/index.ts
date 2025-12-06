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
  therapist_selection?: number; // 1, 2, or 3 for selecting from options
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
  aiResponse?: string; // Natural conversational response from AI
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
    const pendingTherapistMatches = body.pendingTherapistMatches || null; // Array of therapist options

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
        inquiry = updatedInquiry;
      }
    }

    // Extract information from user message with enhanced conversational AI
    const extractedData = await extractInfoWithGemini(userMessage, conversationHistory, inquiry, pendingTherapistMatches);
    console.log("Extracted data:", extractedData);

    // Generate natural conversational response
    const aiResponse = await generateConversationalResponse(userMessage, conversationHistory, inquiry, extractedData);
    console.log("AI Response:", aiResponse);

    const inquiryId = await saveInquiry(supabaseClient, extractedData, patientId, inquiry?.id);
    console.log("Inquiry saved/updated with ID:", inquiryId);

    const { data: latestInquiry } = await supabaseClient.from('inquiries').select('*').eq('id', inquiryId).single();

    const scheduleToUse = (extractedData.schedule && extractedData.schedule !== 'not specified') 
        ? extractedData.schedule
        : latestInquiry.requested_schedule;

    // Handle therapist selection if user chose from options
    if (extractedData.therapist_selection && pendingTherapistMatches && Array.isArray(pendingTherapistMatches)) {
      const selectedIndex = extractedData.therapist_selection - 1;
      if (selectedIndex >= 0 && selectedIndex < pendingTherapistMatches.length) {
        const selectedTherapist = pendingTherapistMatches[selectedIndex];
        
        // Update inquiry with selected therapist
        await supabaseClient
          .from('inquiries')
          .update({ matched_therapist_id: selectedTherapist.id, status: 'matched' })
          .eq('id', inquiryId);

        return new Response(JSON.stringify({
          success: true,
          nextAction: 'therapist-selected',
          inquiryId,
          therapistId: selectedTherapist.id,
          message: aiResponse,
          aiResponse: aiResponse
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Handle booking if user confirmed and has matched therapist
    if (latestInquiry?.matched_therapist_id && extractedData.booking_intent === 'yes') {
      if (scheduleToUse) {
        const schedLower = scheduleToUse.toLowerCase();
        console.log("=== PARSING SCHEDULE ===");
        console.log("Input:", scheduleToUse);
        
        let appointmentDate = new Date();
        let hour = 9, minute = 0;
        let timeFound = false;
        
        // STEP 1: Extract TIME
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
        
        if (!timeFound) {
          timeMatch = schedLower.match(/\bat\s+(\d{1,2})(?::(\d{2}))?/);
          if (timeMatch) {
            hour = parseInt(timeMatch[1], 10);
            minute = parseInt(timeMatch[2] || "0", 10);
            if (hour >= 1 && hour <= 7) hour += 12;
            timeFound = true;
            console.log(`✓ Found time after 'at': ${hour}:${minute}`);
          }
        }
        
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
        
        // STEP 3: Extract DAY
        let dayOfMonth = appointmentDate.getDate();
        
        const numberPattern = /(\d{1,2})/g;
        const allNumbers = [...schedLower.matchAll(numberPattern)];
        console.log(`All numbers found: ${allNumbers.map(m => m[1]).join(', ')}`);
        
        const candidateDays = allNumbers
          .map(m => parseInt(m[1], 10))
          .filter(num => {
            if (timeFound && (num === hour || num === (hour > 12 ? hour - 12 : hour) || num === minute)) {
              console.log(`  Skipping ${num} - it's part of the time`);
              return false;
            }
            if (num < 1 || num > 31) {
              console.log(`  Skipping ${num} - out of valid day range`);
              return false;
            }
            return true;
          });
        
        if (candidateDays.length > 0) {
          dayOfMonth = candidateDays[0];
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
        
        const pad = (n: number) => n.toString().padStart(2, '0');
        const startTimeStr = `${appointmentDate.getFullYear()}-${pad(appointmentDate.getMonth() + 1)}-${pad(appointmentDate.getDate())}T${pad(appointmentDate.getHours())}:${pad(appointmentDate.getMinutes())}:00`;
        
        appointmentDate.setHours(appointmentDate.getHours() + 1);
        const endTimeStr = `${appointmentDate.getFullYear()}-${pad(appointmentDate.getMonth() + 1)}-${pad(appointmentDate.getDate())}T${pad(appointmentDate.getHours())}:${pad(appointmentDate.getMinutes())}:00`;

        return new Response(JSON.stringify({
          success: true,
          nextAction: 'book-appointment',
          message: aiResponse,
          inquiryId: latestInquiry.id,
          therapistId: latestInquiry.matched_therapist_id,
          startTime: startTimeStr,
          endTime: endTimeStr,
          timeZone: 'Asia/Kolkata',
          aiResponse: aiResponse
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        return new Response(JSON.stringify({
          success: true,
          nextAction: 'awaiting-info',
          message: aiResponse,
          inquiryId: latestInquiry.id,
          aiResponse: aiResponse
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const response = prepareResponse(latestInquiry, inquiryId, aiResponse);
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

function prepareResponse(inquiry: any, inquiryId: string, aiResponse?: string): ChatResponse {
  const missingInfo: string[] = [];
  if (!inquiry.extracted_specialty) missingInfo.push("problem");
  if (!inquiry.requested_schedule) missingInfo.push("schedule");
  if (!inquiry.insurance_info) missingInfo.push("insurance");

  if (missingInfo.length === 0) {
    return {
      success: true,
      nextAction: "find-therapist",
      inquiryId,
      message: aiResponse || "Thank you! I have all the information I need. Let me find the best therapist matches for you.",
      aiResponse: aiResponse
    };
  }

  return {
    success: true,
    nextAction: "awaiting-info",
    inquiryId,
    message: aiResponse || "I need a bit more information to help you better.",
    aiResponse: aiResponse
  };
}

async function generateConversationalResponse(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
  inquiry: any,
  extractedData: ExtractedData
): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is not set");
  const client = new GoogleGenAI({ apiKey });

  let contextMessages = "";
  if (conversationHistory && conversationHistory.length > 0) {
    const recentHistory = conversationHistory.slice(-6); // Last 3 exchanges
    contextMessages = recentHistory.map((msg) => `${msg.role}: ${msg.content}`).join("\n") + "\n\n";
  }

  // Build context about what we know
  let knownContext = "";
  if (inquiry) {
    if (inquiry.extracted_specialty) knownContext += `The user mentioned dealing with: ${inquiry.extracted_specialty}. `;
    if (inquiry.requested_schedule) knownContext += `They prefer scheduling around: ${inquiry.requested_schedule}. `;
    if (inquiry.insurance_info) knownContext += `Their insurance is: ${inquiry.insurance_info}. `;
  }

  // Determine what we still need
  const missingInfo: string[] = [];
  if (!inquiry?.extracted_specialty && extractedData.problem === 'not specified') missingInfo.push("what they'd like help with");
  if (!inquiry?.requested_schedule && extractedData.schedule === 'not specified') missingInfo.push("their preferred schedule");
  if (!inquiry?.insurance_info && extractedData.insurance === 'not specified') missingInfo.push("their insurance information");

  const prompt = `You are an empathetic, warm, and professional therapy scheduling assistant. Your role is to help people find the right therapist in a conversational, human way.

Conversation so far:
${contextMessages}

What we know about the user: ${knownContext || "Just starting the conversation."}

User's current message: "${userMessage}"

Your task:
1. Respond in a warm, conversational, human way - like a caring friend who understands
2. Show empathy and validate their feelings if they're sharing something difficult
3. If we're missing information (${missingInfo.length > 0 ? missingInfo.join(", ") : "nothing - we have everything"}), gently ask for it in a natural way
4. Keep responses concise but warm (2-3 sentences max)
5. Don't sound robotic or overly formal
6. Use casual, friendly language while remaining professional

${missingInfo.length === 0 ? "Since we have all the information, let them know you're going to find great therapist matches for them." : ""}

Generate ONLY the assistant's response message (no labels, no JSON, just the natural conversational text):`;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { temperature: 0.8, maxOutputTokens: 200 }
    });
    const generatedText = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return generatedText || "I'm here to help you find the right therapist. Could you tell me what brings you here today?";
  } catch (error: any) {
    console.warn("Failed to generate conversational response:", error.message || error);
    // Fallback to basic response
    if (missingInfo.length > 0) {
      return `I'd love to help you find the right therapist. Could you tell me a bit more about ${missingInfo[0]}?`;
    }
    return "Thanks for sharing that with me. Let me find some great therapist options for you.";
  }
}

async function extractInfoWithGemini(
  userMessage: string,
  conversationHistory?: Array<{ role: string; content: string }>,
  inquiry?: any,
  pendingTherapistMatches?: any
): Promise<ExtractedData> {
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

  const therapistSelectionPrompt = pendingTherapistMatches
    ? `The user was presented with therapist options. Check if they're selecting one (e.g., "first one", "number 2", "the second therapist", "option 1"). If so, extract the number (1, 2, or 3) into therapist_selection field.`
    : "";

  // Hardcoded safety check for simple greetings
  const lowerMsg = userMessage.toLowerCase().trim();
  const greetings = ['hi', 'hello', 'hey', 'heyy', 'greetings', 'yo', 'sup', 'good morning', 'good afternoon', 'good evening'];
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
${therapistSelectionPrompt}

Extract the following information:
1. Main problem/symptoms (or mental health concern).
2. Preferred schedule times.
3. Insurance provider.
4. Booking Intent ("yes", "no", "clarification", or "not specified").
${therapistSelectionPrompt ? "5. Therapist Selection (1, 2, or 3 if they're choosing from options, otherwise null)." : ""}

Guidelines: 
- Use "not specified" for ANY missing information that represents a NEW detail not already known.
- If information is already listed in "Known Information", PRESERVE it unless the user explicitly changes it.
- If the user confirms a question (e.g. "yes I do"), infer the answer from context if possible or mark as "not specified" if specific details are still needed.
- Only extract "problem" if the user describes a medical or psychological issue.

Format your output strictly as JSON:
{"problem": "...", "schedule": "...", "insurance": "...", "booking_intent": "..."${therapistSelectionPrompt ? ', "therapist_selection": null or 1-3' : ''}}`;

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
