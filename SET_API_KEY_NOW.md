# 🔑 URGENT: Set Your Gemini API Key

## The Problem

Your chatbot AI is failing because the GEMINI_API_KEY is invalid or not set:

```
"message": "API key not valid. Please pass a valid API key."
"reason": "API_KEY_INVALID"
```

## ✅ SOLUTION (2 Steps)

### Step 1: Get a Valid Gemini API Key

1. **Go to Google AI Studio**: https://aistudio.google.com/app/apikey
2. **Click "Create API Key"** (or "Get API Key")
3. **Select a Google Cloud project** (or create a new one - it's free!)
4. **Copy the API key** - it will look like: `AIzaSyD...` (long string starting
   with AIza)

⚠️ **IMPORTANT**: Keep this key secret! Don't share it or commit it to git.

---

### Step 2: Set the Secret in Supabase

**Option A: Using Supabase CLI (Recommended)**

Open your terminal and run:

```powershell
npx supabase secrets set GEMINI_API_KEY=AIzaSyD_YOUR_ACTUAL_KEY_HERE
```

Replace `AIzaSyD_YOUR_ACTUAL_KEY_HERE` with your actual API key from Step 1.

**Option B: Using Supabase Dashboard**

1. Go to
   https://supabase.com/dashboard/project/qhuqwljmphigdvcwwzgg/settings/functions
2. Scroll to "Secrets"
3. Click "Add secret"
4. Name: `GEMINI_API_KEY`
5. Value: Your API key from Step 1
6. Click "Save"

---

### Step 3: Verify It Works

After setting the secret, the function should automatically use it on the next
request.

Test by sending a message in your chat:

```
"I'm feeling anxious"
```

**Check the logs:**

```powershell
npx supabase functions logs handle-chat
```

**You should see:**

```
✅ Using model: gemini-2.0-flash-exp
```

Instead of:

```
❌ Model gemini-2.0-flash-exp failed (400): API key not valid
```

---

## 🎯 Quick Command Reference

**Set the secret:**

```powershell
npx supabase secrets set GEMINI_API_KEY=YOUR_KEY_HERE
```

**List all secrets:**

```powershell
npx supabase secrets list
```

**View logs:**

```powershell
npx supabase functions logs handle-chat
```

**Test the API key directly:**

```powershell
curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=YOUR_KEY_HERE" -H "Content-Type: application/json" -d "{\"contents\":[{\"parts\":[{\"text\":\"Hello\"}]}]}"
```

---

## 📝 Notes

- **No redeploy needed**: Once you set the secret, it's automatically available
  to the function
- **Free tier**: Gemini API has a generous free tier (15 req/min, 1500/day)
- **Fallback works**: Your chatbot continues working with rule-based responses
  until the API key is set
- **Multiple environments**: Set the key separately for local (`.env` file) and
  remote (supabase secrets)

---

## 🐛 Still Having Issues?

If you still see errors after setting the key:

1. **Double-check the key** - Make sure you copied it correctly
2. **Wait a minute** - Secrets can take a moment to propagate
3. **Check quota** - Make sure you haven't exceeded the free tier limit
4. **Test directly** - Use the curl command above to verify the key works

---

**After you set the key, your chatbot will be fully AI-powered! 🚀**
