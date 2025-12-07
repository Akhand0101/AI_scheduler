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
        const { data: updatedInquiry, error: updateError } = await supabaseClient
          .from('inquiries')
          .update({ matched_therapist_id: selectedTherapist.id, status: 'matched' })
          .eq('id', inquiryId)
          .select()
          .single();

        if (updateError) {
          console.error("Error updating inquiry with selected therapist:", updateError);
        }

        console.log(`✓ Therapist selected: ${selectedTherapist.name} (ID: ${selectedTherapist.id})`);

        // CRITICAL: Return immediately to avoid falling through to prepareResponse
        // which would trigger 'find-therapist' again and cause the loop
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

  const systemInstruction = `You are "Kai", an empathetic and warm therapy booking assistant. Your goal is to help users find the right therapist while making them feel heard and supported.

BOOKING FUNNEL - You need to gently collect these 3 pieces of info:
1. Their problem/concern (anxiety, depression, relationship, etc.)
2. Their availability/schedule preference
3. Their insurance provider

Current Status:
${knownContext || "No information collected yet."}

Missing Info: ${missingInfo.length > 0 ? missingInfo.join(", ") : "All info collected! Ready to find therapist."}

RESPONSE RULES:
1. **Empathy First**: ALWAYS validate the user's feelings or situation before asking for business. If they share a struggle, acknowledge it warmly (e.g., "I'm so sorry you're going through that," or "It sounds like you've been carrying a lot.").
2. **Be Supportive**: Use a caring, non-judgmental tone.
3. **Gentle Guidance**: After validating, gently guide the user to the next step.
4. **One Thing at a Time**: Ask for only ONE missing piece of information at a time to avoid overwhelming them.
5. **Concise but Kind**: Keep responses reasonable in length (3-4 sentences), balancing warmth with efficiency.

Example good response: "I'm really sorry to hear you've been feeling that way. It takes courage to reach out. To help us find the best support for you, do you have a specific insurance provider you'd like to use?"
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

  // Fallback: Generate a helpful response based on what's missing
  console.warn("All Gemini models failed - using fallback response generation");
  return generateFallbackResponse(userMessage, inquiry, extractedData, missingInfo);
}

/**
 * Generate a helpful response when Gemini API is unavailable.
 * This function prioritizes warmth, empathy, and conversational flow.
 */
function generateFallbackResponse(
  userMessage: string,
  inquiry: any,
  extractedData: ExtractedData,
  missingInfo: string[]
): string {
  // Helpers for variety
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  const lowerMsg = userMessage.toLowerCase();
  
  // Determine emotional context from current message OR previous inquiry data
  const emotionalKeywords = ['sad', 'grief', 'depressed', 'pain', 'hurt', 'struggling', 'hard', 'hopeless', 'overwhelmed', 'anxious', 'scared', 'lost', 'alone', 'crying', 'die', 'death', 'loss'];
  const isCurrentlyEmotional = emotionalKeywords.some(k => lowerMsg.includes(k));
  
  // Check if they shared something emotional earlier (stored in inquiry)
  const previousSpecialty = inquiry?.extracted_specialty?.toLowerCase() || '';
  const hasEmotionalHistory = emotionalKeywords.some(k => previousSpecialty.includes(k)) || 
                              previousSpecialty.includes('grief') || 
                              previousSpecialty.includes('depression') ||
                              previousSpecialty.includes('anxiety');
  
  const isEmotionalContext = isCurrentlyEmotional || hasEmotionalHistory;
  
  // If user just greeted, welcome them warmly
  if (lowerMsg.length < 20 && (lowerMsg.includes('hi') || lowerMsg.includes('hello') || lowerMsg.includes('hey'))) {
    return pick([
      "Hi, I'm Kai. 💙 I'm here to help you find a therapist who truly understands what you're going through. There's no rush—take your time. What's been on your mind lately?",
      "Hello, I'm Kai. I'm really glad you reached out. Finding the right support is such an important step. What brings you here today?",
      "Hi there. 🌿 I'm Kai, and I'm here to listen. Reaching out takes courage, and I want to make this as easy as possible for you. What's going on?"
    ]);
  }
  
  // If therapist selection was detected
  if (extractedData.therapist_selection) {
    return pick([
      "Perfect choice! I think they'll be a wonderful fit for you. When would you like to schedule your first session?",
      "Excellent. I have a really good feeling about this match. What time works best for you?",
      "Great choice. Let's get you booked with them. When are you typically available?"
    ]);
  }
  
  // If booking intent detected "yes"
  if (extractedData.booking_intent === 'yes') {
    return pick([
      "I'm so glad you're taking this step. Let me confirm that appointment for you right now. 💙",
      "Wonderful—you're doing something really positive for yourself. I'm securing that time for you.",
      "That's great. I'm finalizing your booking now. You're going to be in good hands."
    ]);
  }
  
  // If all info is collected - acknowledge warmly and transition
  if (missingInfo.length === 0) {
    if (extractedData.insurance && extractedData.insurance !== 'not specified') {
      if (isEmotionalContext) {
        return pick([
          `Thank you for sharing that. I know this hasn't been easy, but you're almost there. Let me find a compassionate therapist who accepts ${extractedData.insurance} and specializes in what you're going through.`,
          `Got it—${extractedData.insurance}. I'm searching for someone who can really support you through this. One moment. 💙`,
          `Perfect. I'm going to find the best match for you—someone who understands and can help. Hang tight.`
        ]);
      }
      return pick([
        `Great, ${extractedData.insurance} works. Let me find the best therapist matches for you right now.`,
        `Thanks! I'm searching for therapists who accept ${extractedData.insurance} and fit your needs.`,
        `Got it. Let me find some great options for you.`
      ]);
    }
    if (extractedData.schedule && extractedData.schedule !== 'not specified') {
      return pick([
        "Perfect, I've noted that. Let me find someone who's available and can really help you.",
        "That works. I'm searching for a therapist who can see you then and support you well.",
        "Great. Let me match you with someone available at that time."
      ]);
    }
    if (isEmotionalContext) {
      return pick([
        "Thank you for trusting me with this. I have everything I need. Let me find someone who can truly support you through what you're experiencing. 💙",
        "I'm going to find you a therapist who specializes in exactly what you're dealing with. You deserve that support.",
        "You've taken a big step today. Let me find the right person to help you on this journey."
      ]);
    }
    return pick([
      "I have everything I need. Let me find the best therapist matches for you.",
      "Perfect! Searching for the right therapist for you now.",
      "Great—let's get you connected with someone who can help."
    ]);
  }
  
  // --- ASKING FOR MISSING INFO (with emotional context awareness) ---

  // Missing: Problem/concern
  if (missingInfo.includes("what they're going through")) {
    return pick([
      "I'm here to listen, no judgment at all. Could you share a little about what's been weighing on you? It helps me find the right kind of support for you.",
      "Take your time. What's been going on that made you want to reach out? I want to make sure I connect you with someone who truly understands.",
      "I'd love to help you find the right fit. Can you tell me a bit about what you're going through—whether it's stress, sadness, relationships, or something else?"
    ]);
  }
  
  // Missing: Schedule - this is where the conversation was dying!
  if (missingInfo.includes("when they're available")) {
    if (isEmotionalContext) {
      return pick([
        "I hear you, and I'm so sorry you're carrying this. 💙 Let's get you connected with someone soon. When would work for you to have a session?",
        "What you're going through sounds really hard. I want to help you find support as quickly as possible. When are you usually free?",
        "I'm glad you're here. Let's find a time that works for you to speak with someone who can help. Any particular days or times that are best?"
      ]);
    }
    return pick([
      "Thanks for sharing that with me. When would be a good time for you to meet with a therapist?",
      "I appreciate you opening up. What days or times generally work best for your schedule?",
      "That's helpful to know. When are you usually available for appointments?"
    ]);
  }
  
  // Missing: Insurance - CRITICAL: This is where the bot sounded dead before
  if (missingInfo.includes("insurance provider")) {
    if (isEmotionalContext) {
      return pick([
        "You're doing great—just one more thing so I can find you the best match. 💙 Do you have insurance you'd like to use, and if so, which provider?",
        "Almost there. I want to make sure whoever I match you with can provide affordable care. Do you plan to use insurance? If so, who's your provider?",
        "We're so close to getting you connected with help. Last question: do you have an insurance provider you'd like to use for therapy? If not, that's totally okay too."
      ]);
    }
    return pick([
      "Great, we're almost done! Do you have insurance you'd like to use? If so, which provider?",
      "Just one more thing—do you plan to use insurance for your sessions? If so, who's your provider?",
      "Thanks! Last question: which insurance provider would you like to use, or would you prefer to pay out of pocket?"
    ]);
  }
  
  // Generic fallback (should rarely hit this)
  if (isEmotionalContext) {
    return "I'm here with you. 💙 To help me find the best therapist for you, could you tell me a little more about what you need?";
  }
  return "I want to make sure I find the right match for you. Could you tell me a bit more about what you're looking for?";
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
  
  // Fallback: Simple pattern matching when all AI models fail
  console.warn("All Gemini models failed - using fallback pattern matching");
  return simpleFallbackExtraction(userMessage, inquiry, pendingTherapistMatches);
}

/**
 * Simple fallback extraction when Gemini API is unavailable
 * Uses basic pattern matching instead of AI
 */
function simpleFallbackExtraction(userMessage: string, inquiry?: any, pendingTherapistMatches?: any[]): ExtractedData {
  const lowerMsg = userMessage.toLowerCase();
  
  // Extract problem/condition - including emotional keywords
  let problem = "not specified";
  
  // Map emotional keywords to conditions
  const emotionalMappings: { [key: string]: string } = {
    'sad': 'depression',
    'depressed': 'depression',
    'down': 'depression',
    'hopeless': 'depression',
    'worried': 'anxiety',
    'anxious': 'anxiety',
    'nervous': 'anxiety',
    'stressed': 'stress',
    'overwhelmed': 'stress',
    'panic': 'panic',
    'scared': 'anxiety'
  };
  
  // Check emotional keywords first
  for (const [keyword, condition] of Object.entries(emotionalMappings)) {
    if (lowerMsg.includes(keyword)) {
      problem = condition;
      break;
    }
  }
  
  // Then check for explicit condition names (overrides emotional keywords if found)
  const conditions = ['anxiety', 'depression', 'stress', 'ptsd', 'ocd', 'bipolar', 'trauma', 
                      'relationship', 'grief', 'addiction', 'eating disorder'];
  for (const condition of conditions) {
    if (lowerMsg.includes(condition)) {
      problem = condition;
      break;
    }
  }
  
  // Extract schedule - detect dates, times, months, days
  let schedule = "not specified";
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
                  'january', 'february', 'march', 'april', 'june', 'july', 'august', 'september', 
                  'october', 'november', 'december'];
  const times = ['morning', 'afternoon', 'evening', 'noon', 'midnight', 'night', 'am', 'pm'];
  
  const hasDay = days.some(d => lowerMsg.includes(d));
  const hasMonth = months.some(m => lowerMsg.includes(m));
  const hasTime = times.some(t => {
      // Avoid matching "am" in "I am" or "pm" in words
      if (t === 'am' || t === 'pm') {
          return new RegExp(`\\b\\d+\\s*${t}\\b`).test(lowerMsg);
      }
      return lowerMsg.includes(t);
  });
  const hasDateNumber = /\d{1,2}(st|nd|rd|th)?/.test(lowerMsg); // Matches 17th, 15, 3rd, etc.
  const hasTimeFormat = /\d{1,2}:\d{2}/.test(lowerMsg) || /\d{1,2}\s*(am|pm)/.test(lowerMsg); // 3:30 or 3pm
  
  if (hasDay || hasTime || hasMonth || hasDateNumber || hasTimeFormat) {
    schedule = userMessage; // Use full message if it contains any time/date info
  }
  
  // Extract insurance
  let insurance = "not specified";
  const insuranceProviders = ['aetna', 'blue cross', 'bluecross', 'cigna', 'united', 
                               'humana', 'kaiser', 'anthem'];
  for (const provider of insuranceProviders) {
    if (lowerMsg.includes(provider)) {
      insurance = provider;
      break;
    }
  }
  
  // Detect booking intent
  let booking_intent: "yes" | "no" | "clarification" | "not specified" = "not specified";
  if (inquiry?.matched_therapist_id) {
    if (/\b(yes|sure|ok|okay|book|confirm|schedule)\b/.test(lowerMsg)) {
      booking_intent = "yes";
    } else if (/\b(no|cancel|not|don't)\b/.test(lowerMsg)) {
      booking_intent = "no";
    } else if (/\?/.test(userMessage)) {
      booking_intent = "clarification";
    }
  }
  
  // Detect therapist selection (if pendingTherapistMatches provided)
  let therapist_selection: number | undefined = undefined;
  
  if (inquiry && !inquiry.matched_therapist_id && pendingTherapistMatches && pendingTherapistMatches.length > 0) {
    // Try to extract selection number (1, 2, 3, etc.)
    const numberMatch = lowerMsg.match(/\b([123])\b|first|second|third|one|two|three/);
    if (numberMatch) {
      if (numberMatch[1]) {
        therapist_selection = parseInt(numberMatch[1], 10);
      } else if (lowerMsg.includes('first') || lowerMsg.includes('one')) {
        therapist_selection = 1;
      } else if (lowerMsg.includes('second') || lowerMsg.includes('two')) {
        therapist_selection = 2;
      } else if (lowerMsg.includes('third') || lowerMsg.includes('three')) {
        therapist_selection = 3;
      }
    }
    
    // If no number found, try to match therapist name
    if (!therapist_selection) {
      for (let i = 0; i < pendingTherapistMatches.length; i++) {
        const therapist = pendingTherapistMatches[i];
        const therapistNameLower = therapist.name?.toLowerCase() || '';
        
        // Check if user message contains the therapist's name (or significant part of it)
        if (therapistNameLower && userMessage.toLowerCase().includes(therapistNameLower)) {
          therapist_selection = i + 1; // Convert 0-indexed to 1-indexed
          console.log(`Matched therapist by name: ${therapist.name} -> selection ${therapist_selection}`);
          break;
        }
        
        // Also try matching last name only
        const nameParts = therapistNameLower.split(' ');
        if (nameParts.length > 1 && lowerMsg.includes(nameParts[nameParts.length - 1])) {
          therapist_selection = i + 1;
          console.log(`Matched therapist by last name: ${nameParts[nameParts.length - 1]} -> selection ${therapist_selection}`);
          break;
        }
      }
    }
  }
  
  return { problem, schedule, insurance, booking_intent, therapist_selection };
}
