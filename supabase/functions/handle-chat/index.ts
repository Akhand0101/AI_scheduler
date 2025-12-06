// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";


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

  let contextMessages = "";
  if (conversationHistory && conversationHistory.length > 0) {
    // Basic mapping: user->user, assistant->model
    const recentHistory = conversationHistory.slice(-6); 
    contextMessages = recentHistory.map((msg) => `${msg.role}: ${msg.content}`).join("\n") + "\n\n";
  }

  // Build context about what we know
  let knownContext = "";
  if (inquiry) {
    if (inquiry.extracted_specialty) knownContext += `The user mentioned dealing with: ${inquiry.extracted_specialty}. `;
    if (inquiry.requested_schedule) knownContext += `They prefer scheduling around: ${inquiry.requested_schedule}. `;
    if (inquiry.insurance_info) knownContext += `Their insurance is: ${inquiry.insurance_info}. `;
  }

  const missingInfo: string[] = [];
  if (!inquiry?.extracted_specialty && extractedData.problem === 'not specified') missingInfo.push("what they're going through");
  if (!inquiry?.requested_schedule && extractedData.schedule === 'not specified') missingInfo.push("when they're available");
  if (!inquiry?.insurance_info && extractedData.insurance === 'not specified') missingInfo.push("insurance provider");

  const systemInstruction = `You are "Kai", a focused therapy booking assistant. Your PRIMARY goal is to help users book an appointment with a therapist.

BOOKING FUNNEL - Always guide users toward these 3 pieces of info:
1. Their problem/concern (anxiety, depression, relationship, etc.)
2. Their availability/schedule preference
3. Their insurance provider

Current Status:
${knownContext || "No information collected yet."}

Missing Info: ${missingInfo.length > 0 ? missingInfo.join(", ") : "All info collected! Ready to find therapist."}

RESPONSE RULES:
1. Be warm but DIRECTIVE - acknowledge their message briefly, then guide to booking
2. Ask for ONE missing piece at a time - don't let conversation drift off-topic
3. Keep responses SHORT (2-3 sentences max)
4. If user goes off-topic, gently redirect: "I hear you. To help you get matched quickly, can you tell me [missing info]?"
5. Always remind them this is about booking an appointment with a professional

Example good response: "Thanks for sharing that. To match you with the right therapist, I need to know your insurance provider. Who's your insurance with?"
`;

  const contents = [
    {
      role: "user",
      parts: [{ text: `Conversation History:\n${contextMessages}\n\nUser's Request: ${userMessage}` }]
    }
  ];

  // Using models with best free tier limits (gemini-1.5-flash has 1500 RPD)
  const strategies = [
    { model: "gemini-1.5-flash", version: "v1beta" },        // Best free tier limits
    { model: "gemini-1.5-flash-latest", version: "v1beta" }, // Latest 1.5 flash
    { model: "gemini-flash-latest", version: "v1beta" }      // Generic flash fallback
  ];

  for (const strategy of strategies) {
    try {
      console.log(`[REST] Attempting ${strategy.model} on ${strategy.version}...`);
      const url = `https://generativelanguage.googleapis.com/${strategy.version}/models/${strategy.model}:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: contents,
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 250
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(`[REST] Error from ${strategy.model} (${strategy.version}):`, data.error?.message);
        continue; 
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
      
    } catch (err: any) {
      console.error(`[REST] Failed ${strategy.model}:`, err.message);
    }
  }

  return "I'm hearing you, but I'm having a little trouble connecting. Could you say that again?";
}

async function extractInfoWithGemini(
  userMessage: string,
  conversationHistory?: Array<{ role: string; content: string }>,
  inquiry?: any,
  pendingTherapistMatches?: any
): Promise<ExtractedData> {
  const apiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is not set");

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

  const systemInstruction = `You are a strict data extractor for a therapy booking system.
ONLY extract clear, actionable booking information. Mark vague or off-topic responses as "not specified".

EXTRACTION GOALS:
1. "problem": Specific medical/psychological issue (anxiety, depression, PTSD, relationship issues, etc.)
   - Mark as "not specified" if: general chitchat, vague feelings, or no clear condition mentioned
2. "schedule": Specific date/time preferences (e.g., "Monday 3pm", "weekday afternoons", "December 15")
   - Mark as "not specified" if: vague like "soon" or "whenever"
3. "insurance": Insurance provider name (Aetna, Blue Cross, UnitedHealthcare, etc.)
   - Mark as "not specified" if: just "yes" or unclear
4. "booking_intent": 
   - "yes" = clear confirmation to book
   - "no" = declining to book
   - "clarification" = asking questions about booking
   - "not specified" = anything else
${therapistSelectionPrompt ? '5. "therapist_selection": Extract 1, 2, or 3 if user selects from options (null otherwise)' : ''}

OUTPUT FORMAT: Valid JSON only. Be strict - prefer "not specified" over guessing.`;

  const prompt = `
Known Info:
${knownInfo}

Context:
${contextMessages}

Current Message: "${userMessage}"
${bookingPrompt}
${therapistSelectionPrompt}

Extract JSON:
{"problem": "...", "schedule": "...", "insurance": "...", "booking_intent": "..."${therapistSelectionPrompt ? ', "therapist_selection": null' : ''}}`;

  // Using models with best free tier limits (gemini-1.5-flash has 1500 RPD)
  const strategies = [
    { model: "gemini-1.5-flash", version: "v1beta" },        // Best free tier limits
    { model: "gemini-1.5-flash-latest", version: "v1beta" }, // Latest 1.5 flash
    { model: "gemini-flash-latest", version: "v1beta" }      // Generic flash fallback
  ];

  for (const strategy of strategies) {
    try {
      console.log(`[REST-EXTRACT] Attempting ${strategy.model} on ${strategy.version}...`);
      const url = `https://generativelanguage.googleapis.com/${strategy.version}/models/${strategy.model}:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(`[REST-EXTRACT] Error from ${strategy.model} (${strategy.version}):`, data.error?.message);
        continue;
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        try {
          return JSON.parse(text) as ExtractedData;
        } catch (e) {
             console.error("JSON parse error:", text);
        }
      }
      
    } catch (err: any) {
      console.error(`[REST-EXTRACT] Failed ${strategy.model}:`, err.message);
    }
  }
  
  throw new Error("All Gemini models failed extraction.");
}
