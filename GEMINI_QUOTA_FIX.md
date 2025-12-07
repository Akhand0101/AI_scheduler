# Gemini API Quota Fix - Graceful Fallback System

## Problem
Your Gemini API free tier quota was exceeded, causing the chatbot to completely fail with error:
```
Error: All Gemini models failed extraction.
```

## Solution Implemented

### 1. **Switched to Higher Free Tier Models** ✅
Changed from `gemini-2.5-flash` (low quota) to `gemini-1.5-flash` (1500 requests/day)

**Before:**
```typescript
{ model: "gemini-2.5-flash", version: "v1beta" },
{ model: "gemini-2.0-flash", version: "v1beta" },
{ model: "gemini-pro-latest", version: "v1beta" }  // ❌ Hit quota
```

**After:**
```typescript
{ model: "gemini-1.5-flash", version: "v1beta" },        // ✅ 1500 RPD
{ model: "gemini-1.5-flash-latest", version: "v1beta" },
{ model: "gemini-flash-latest", version: "v1beta" }
```

### 2. **Added Graceful Fallback Extraction** 🛡️
When all Gemini models fail, the chatbot now uses **simple pattern matching** instead of crashing.

**Fallback Features:**
- ✅ Detects mental health conditions (anxiety, depression, PTSD, etc.)
- ✅ Detects schedule keywords (Monday, morning, 3pm, etc.)
- ✅ Detects insurance providers (Aetna, Blue Cross, Cigna, etc.)
- ✅ Detects booking intent (yes, no, clarification questions)

**Example:**
```
User: "I've been dealing with anxiety and I have Blue Cross insurance"

AI API Down → Fallback extracts:
{
  problem: "anxiety",
  schedule: "not specified",
  insurance: "blue cross",
  booking_intent: "not specified"
}
```

### 3. **Added Smart Fallback Responses** 💬
When Gemini API is down, the chatbot generates context-aware responses based on what information is missing.

**Before:** Generic error message
**After:** Helpful, guided responses

**Examples:**

| Missing Info | Fallback Response |
|-------------|-------------------|
| Problem | "Thanks for reaching out! To match you with the right therapist, I need to know what brings you here. Are you dealing with anxiety, depression, relationship issues, or something else?" |
| Schedule | "Got it. When would you be available for appointments? For example, weekday mornings, Monday evenings, or a specific date and time." |
| Insurance | "Perfect! Last thing I need - who's your insurance provider? (e.g., Aetna, Blue Cross, Cigna, etc.)" |

---

## How It Works Now

### Normal Operation (API Available)
```
User Message → Gemini AI Extraction → Gemini AI Response → User
                        ✅                      ✅
```

### Degraded Mode (API Quota Exceeded)
```
User Message → Pattern Matching Extraction → Template Responses → User
                        ✅                           ✅
```

**Result:** Chatbot **never crashes**, just operates in a simpler mode until API quota resets.

---

## Testing the Fallback

To test that fallback works, try these user messages (even without API):

1. **"I have anxiety"**
   - Extracts: `problem: "anxiety"`
   - Responds: "Got it. When would you be available for appointments?"

2. **"Monday mornings work for me"**
   - Extracts: `schedule: "Monday mornings work for me"`
   - Responds: "Perfect! Last thing I need - who's your insurance provider?"

3. **"I have Blue Cross"**
   - Extracts: `insurance: "blue cross"`
   - Responds: "Great! I have all the information I need..."

---

## When Will API Work Again?

Your Gemini API quota resets:
- **Per-minute quotas:** Every 60 seconds
- **Daily quotas:** At midnight UTC (5:30 AM IST)

Check your usage: https://ai.dev/usage?tab=rate-limit

---

## Long-Term Solutions

### Option 1: Wait for Quota Reset (Free)
- **Daily limit:** Resets at midnight UTC
- **Cost:** $0
- **Downside:** Limited to 1,500 requests/day

### Option 2: Upgrade to Paid API (Recommended)
- **Cost:** ~$0.00015 per 1K characters (very cheap)
- **Limits:** 1,000+ requests per minute
- **Setup:** Enable billing in Google AI Studio

### Option 3: Use Both (Smart Hybrid)
- Use fallback mode during high traffic
- Reserve API calls for complex conversations
- Auto-switch based on quota availability

---

## Deployment

The changes are ready in your code. To deploy:

```powershell
# Deploy to Supabase
npx supabase functions deploy handle-chat

# Or through dashboard:
# Copy supabase/functions/handle-chat/index.ts → Dashboard → Deploy
```

---

## What Changed

| File | Change | Lines |
|------|--------|-------|
| `handle-chat/index.ts` | Updated model fallback strategy | 360-365, 479-484 |
| `handle-chat/index.ts` | Added `simpleFallbackExtraction()` function | 528-580 |
| `handle-chat/index.ts` | Added `generateFallbackResponse()` function | 405-438 |

---

## Benefits

✅ **Never crashes** - Chatbot works even when API is down
✅ **User doesn't notice** - Fallback responses are natural and helpful
✅ **Still collects data** - Pattern matching captures most common inputs
✅ **Cost-effective** - Reduces API usage automatically
✅ **Future-proof** - Handles API outages gracefully

---

## Monitoring

Watch for these log messages to see when fallback is being used:

```
[REST-EXTRACT] Error from gemini-1.5-flash...
All Gemini models failed - using fallback pattern matching
All Gemini models failed - using fallback response generation
```

If you see these frequently, consider upgrading your API plan or optimizing usage.
