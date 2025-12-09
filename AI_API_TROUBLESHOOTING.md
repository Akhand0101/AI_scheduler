# 🔍 AI API Troubleshooting Guide

## Issue: "All AI models failed"

You're seeing this error in the logs:

```
⚠️ AI conversation failed, falling back to rule-based: Error: All AI models failed
```

**Good news**: The chatbot is still working thanks to rule-based fallback! But
let's fix the AI to get the full intelligent experience.

---

## 🔧 Diagnosis Steps

### Step 1: Check if GEMINI_API_KEY is set

**Local Development:**

```bash
# Check if the environment variable exists
echo $env:GEMINI_API_KEY  # PowerShell
echo %GEMINI_API_KEY%     # CMD
```

**Remote (Supabase):**

```bash
# List all secrets
npx supabase secrets list

# Check if GEMINI_API_KEY is there
npx supabase secrets get GEMINI_API_KEY
```

### Step 2: Check the detailed error logs

With the improved error logging, you'll now see:

```
❌ Model gemini-2.0-flash-exp failed (403): {
  "error": {
    "code": 403,
    "message": "API key not valid. Please pass a valid API key.",
    "status": "PERMISSION_DENIED"
  }
}
```

**View logs:**

```bash
npx supabase functions logs handle-chat
```

Common error codes:

- **403 PERMISSION_DENIED** → Invalid API key
- **429 RESOURCE_EXHAUSTED** → Quota exceeded
- **404 NOT_FOUND** → Model doesn't exist (wrong name)
- **400 INVALID_ARGUMENT** → Request format issue

---

## ✅ Solutions

### Solution 1: Set/Update GEMINI_API_KEY

#### Get a Gemini API Key:

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click "Create API Key"
3. Copy the key

#### Set the key locally:

Create `supabase/.env` file:

```bash
GEMINI_API_KEY=your_actual_key_here
```

Then restart Supabase:

```bash
npx supabase stop
npx supabase start
```

#### Set the key remotely (Supabase):

```bash
npx supabase secrets set GEMINI_API_KEY=your_actual_key_here
```

Then redeploy:

```bash
npx supabase functions deploy handle-chat
```

---

### Solution 2: Check API Quota

If you're getting 429 errors:

1. Go to
   [Google Cloud Console](https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas)
2. Check your Gemini API quota
3. If exceeded, either:
   - Wait for quota to reset (usually daily)
   - Request quota increase
   - Or continue using rule-based fallback

---

### Solution 3: Verify Model Names

The chatbot tries these models in order:

1. `gemini-2.0-flash-exp` (Experimental - newest)
2. `gemini-2.0-flash` (Stable)
3. `gemini-1.5-flash` (Fallback)

If you're seeing 404 errors, the models might have changed. Check available
models:

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_API_KEY"
```

---

## 🧪 Testing

### Test the API directly:

```bash
curl -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{"text": "Hello, are you working?"}]
    }]
  }'
```

**Expected response:**

```json
{
    "candidates": [{
        "content": {
            "parts": [{ "text": "Yes, I am working!" }]
        }
    }]
}
```

**Error response (invalid key):**

```json
{
    "error": {
        "code": 403,
        "message": "API key not valid..."
    }
}
```

---

## 📊 Understanding the Fallback

When AI fails, the chatbot uses **rule-based conversation**:

**What works:**

- ✅ Insurance questions
- ✅ Therapist listings
- ✅ Empathetic responses to emotions
- ✅ Booking guidance
- ✅ Basic intent detection

**What's better with AI:**

- 🤖 Natural, context-aware responses
- 🤖 Better understanding of complex queries
- 🤖 More personalized conversations
- 🤖 Handling edge cases

**Bottom line**: The chatbot works without AI, but AI makes it much smarter!

---

## 🔍 Enhanced Error Logging

The code now logs:

- ✅ Which model is being tried
- ✅ HTTP status code (403, 429, etc.)
- ✅ Full error message from API
- ✅ Network errors

Example log output:

```
🔧 Executing tool: search_therapists
❌ Model gemini-2.0-flash-exp failed (403): {"error":{"code":403,"message":"API key not valid"}}
❌ Model gemini-2.0-flash failed (403): {"error":{"code":403,"message":"API key not valid"}}
❌ Model gemini-1.5-flash failed (403): {"error":{"code":403,"message":"API key not valid"}}
📋 All models failed. Last error: gemini-1.5-flash: 403 - {"error":{"code":403,"message":"API key not valid"}}
⚠️ AI conversation failed, falling back to rule-based
```

---

## 🚀 Quick Fix Checklist

1. [ ] Get Gemini API key from
       [Google AI Studio](https://aistudio.google.com/app/apikey)
2. [ ] Set key locally: `supabase/.env`
3. [ ] Set key remotely: `npx supabase secrets set GEMINI_API_KEY=...`
4. [ ] Restart local Supabase: `npx supabase stop && npx supabase start`
5. [ ] Redeploy function: `npx supabase functions deploy handle-chat`
6. [ ] Check logs: `npx supabase functions logs handle-chat`
7. [ ] Test chat: "What insurance do you accept?"

---

## 💡 Pro Tips

**For development:**

- Use `.env` file for API keys (never commit it!)
- Check logs frequently: `npx supabase functions logs handle-chat --follow`
- Test with simple messages first

**For production:**

- Use Supabase secrets for API keys
- Monitor quota usage
- Set up alerts for API failures

**Cost saving:**

- Gemini has generous free tier (15 requests/minute, 1500/day for Flash models)
- Rule-based fallback means users never see errors
- Consider caching frequent queries

---

## 📞 Need Help?

If the issue persists after following this guide:

1. Check the logs: `npx supabase functions logs handle-chat`
2. Look for the detailed error message
3. Verify the API key is valid
4. Ensure you're not rate-limited

The chatbot will continue working with rule-based responses until the AI is
fixed! 🎉
