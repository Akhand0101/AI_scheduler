// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2";
import { GoogleGenAI } from "npm:@google/genai";

// Define types for extracted data
interface ExtractedData {
  problem: string;
  schedule: string;
  insurance: string;
}

interface ChatResponse {
  success: boolean;
  extractedData?: ExtractedData;
  followUpQuestion?: string;
  nextAction: string;
  inquiryId?: string;
  message: string;
}

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

console.log("Handle-Chat Function initialized (using @google/genai SDK)");

Deno.serve(async (req) => {
  // Handle CORS preflight requests
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
      }
    );

    // Parse request body
    const body = await req.json();
    const userMessage = body.userMessage || body.messageText;
    const patientId = body.patientId || body.patientIdentifier;
    const conversationHistory = body.conversationHistory;

    if (!userMessage) {
      return new Response(
        JSON.stringify({ success: false, error: "userMessage is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing message:", userMessage);

    // Step A: Call Gemini AI API (Now with SDK + Auto-Retry)
    const extractedData = await extractInfoWithGemini(userMessage, conversationHistory);
    console.log("Extracted data:", extractedData);

    // Step B: Save inquiry to database
    const inquiryId = await saveInquiry(
      supabaseClient,
      userMessage,
      extractedData,
      patientId
    );
    console.log("Inquiry saved with ID:", inquiryId);

    // Step C & D: Determine next action and prepare response
    const response = prepareResponse(extractedData, inquiryId, userMessage);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in handle-chat:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Call Gemini AI API to extract healthcare information
 * FEATURES: Auto-fallback through multiple model names to fix 404 errors
 */
async function extractInfoWithGemini(
  userMessage: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<ExtractedData> {
  const apiKey = Deno.env.get("GEMINI_API_KEY")?.trim();

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  // Initialize the SDK Client
  const client = new GoogleGenAI({ apiKey });

  // Build conversation context
  let contextMessages = "";
  if (conversationHistory && conversationHistory.length > 0) {
    contextMessages = conversationHistory
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");
    contextMessages += "\n\n";
  }

  const prompt = `You are a healthcare scheduling assistant specialized in mental health services.
The user is looking for a therapist or mental health professional.

${contextMessages}Current user message: ${userMessage}

Extract the following information from the conversation:
1. Main problem/symptoms - What mental health issue or concern the user is facing
2. Preferred schedule times - Any specific days, times, or availability mentioned
3. Insurance provider - Any insurance company or payment method mentioned

Guidelines:
- If information is not mentioned, use "not specified"
- Be specific but concise
- For schedule, extract any time preferences, urgency, or flexibility mentioned
- For insurance, look for company names like "Blue Cross", "Aetna", "UnitedHealthcare", etc.

Format your output strictly as JSON:
{
  "problem": "...",
  "schedule": "...",
  "insurance": "..."
}`;

  // 2. SELF-HEALING LOGIC: List of models to try in order
  // REMOVED 'gemini-pro' (1.0) because it often causes 404s on new API versions
  const modelsToTry = [
    'gemini-2.5-flash',       // Standard Free Tiee
  ];

  let lastError: Error | null = null;

  // Loop through models until one works
  for (const modelName of modelsToTry) {
    try {
      console.log(`Attempting Gemini Request using model: ${modelName}`);

      // SDK CALL - Using simple string for contents (supported by new SDK)
      const response = await client.models.generateContent({
        model: modelName,
        contents: prompt, 
        config: {
          responseMimeType: 'application/json', // Force JSON response
          temperature: 0.3,
          maxOutputTokens: 1024,
        }
      });

      // ROBUSTNESS FIX: Access candidates directly to avoid .text() vs .text ambiguity
      const generatedText = response.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!generatedText) {
         throw new Error("Empty response from AI SDK");
      }

      console.log(`Success with model: ${modelName}`);

      // Clean up JSON (SDK usually returns clean JSON with responseMimeType, but safety first)
      let jsonText = generatedText.trim();
      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.replace(/^```json\n/, "").replace(/\n```$/, "");
      } else if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```\n/, "").replace(/\n```$/, "");
      }

      return JSON.parse(jsonText) as ExtractedData;

    } catch (error: any) {
      console.warn(`Failed with model ${modelName}:`, error.message || error);
      lastError = error;
      
      // If 404/429, the loop naturally retries the next model.
    }
  }

  // If we exit the loop, all models failed
  console.error("All Gemini models failed.");
  throw lastError || new Error("Failed to connect to any Gemini model.");
}

/**
 * Save inquiry to the database
 */
async function saveInquiry(
  supabase: any,
  originalMessage: string,
  extractedData: ExtractedData,
  patientId?: string
): Promise<string> {
  const { data, error } = await supabase
    .from("inquiries")
    .insert({
      patient_identifier: patientId || null,
      problem_description: originalMessage,
      requested_schedule: extractedData.schedule,
      insurance_info: extractedData.insurance,
      extracted_specialty: extractedData.problem,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("Error saving inquiry:", error);
    throw new Error(`Failed to save inquiry: ${error.message}`);
  }

  return data.id;
}

/**
 * Prepare the response based on extracted data
 */
function prepareResponse(
  extractedData: ExtractedData,
  inquiryId: string,
  userMessage: string
): ChatResponse {
  const missingInfo: string[] = [];

  // Check what information is missing
  if (
    !extractedData.problem ||
    extractedData.problem === "not specified" ||
    extractedData.problem.trim() === ""
  ) {
    missingInfo.push("problem");
  }

  if (
    !extractedData.schedule ||
    extractedData.schedule === "not specified" ||
    extractedData.schedule.trim() === ""
  ) {
    missingInfo.push("schedule");
  }

  if (
    !extractedData.insurance ||
    extractedData.insurance === "not specified" ||
    extractedData.insurance.trim() === ""
  ) {
    missingInfo.push("insurance");
  }

  // If we have all the information, proceed to matching
  if (missingInfo.length === 0) {
    return {
      success: true,
      extractedData,
      nextAction: "find-therapist",
      inquiryId,
      message:
        "Thank you! I have all the information I need. Let me find the best therapist match for you.",
    };
  }

  // Otherwise, ask for the missing information
  const followUpQuestion = generateFollowUpQuestion(missingInfo, extractedData);

  return {
    success: true,
    extractedData,
    followUpQuestion,
    nextAction: "awaiting-info",
    inquiryId,
    message: followUpQuestion,
  };
}

/**
 * Generate an intelligent follow-up question for missing information
 */
function generateFollowUpQuestion(
  missingInfo: string[],
  extractedData: ExtractedData
): string {
  // Acknowledge what we got
  const acknowledgedParts: string[] = [];
  if (extractedData.problem && extractedData.problem !== "not specified") {
    acknowledgedParts.push(`I understand you're dealing with ${extractedData.problem}`);
  }
  if (extractedData.schedule && extractedData.schedule !== "not specified") {
    acknowledgedParts.push(`and you prefer ${extractedData.schedule}`);
  }
  if (extractedData.insurance && extractedData.insurance !== "not specified") {
    acknowledgedParts.push(`with ${extractedData.insurance} insurance`);
  }

  let acknowledgment = acknowledgedParts.length > 0 ? acknowledgedParts.join(", ") + ". " : "";

  // Ask for the first missing piece of information
  if (missingInfo.includes("problem")) {
    return `${acknowledgment}Could you tell me more about what you'd like help with? For example, are you dealing with anxiety, depression, stress, relationship issues, or something else?`;
  }

  if (missingInfo.includes("schedule")) {
    return `${acknowledgment}When would you prefer to have your appointments? Please let me know your preferred days and times, or if you have any scheduling constraints.`;
  }

  if (missingInfo.includes("insurance")) {
    return `${acknowledgment}Do you have health insurance? If so, which provider? This will help me find therapists that accept your insurance.`;
  }

  return `${acknowledgment}I need a bit more information to find the perfect therapist for you. Could you provide additional details?`;
}