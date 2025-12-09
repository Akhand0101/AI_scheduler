# 🎯 Quick Test Guide - Context-Aware AI Agent

## ✅ What's Been Fixed & Deployed

1. **API Key Updated:** `AIzaSyDcla-oOlc9u3uyG0Tok_VTZjPgQr0NPSA`
2. **Corrupted Code Fixed:** Removed error logs from TOOLS definition
3. **System Prompt Enhanced:** Now fully context-aware and conversational
4. **Deployed Successfully:** ✅ Live on Supabase

---

## 🧪 Quick Test Messages

Copy and paste these into your chatbot to see the AI in action:

### Test 1: Work Stress (Context Awareness)
```
i have been very busy with work lately
```

**Expected Response:**
- ✅ Empathetic acknowledgment
- ✅ Validates feelings
- ✅ Automatically searches for stress/burnout therapists
- ✅ Offers to help find support

### Test 2: Direct Anxiety
```
I've been feeling really anxious
```

**Expected Response:**
- ✅ Validates feelings
- ✅ Immediately searches for anxiety specialists
- ✅ Presents therapist options
- ✅ No unnecessary questions

### Test 3: Relationship Issues
```
my relationship has been struggling
```

**Expected Response:**
- ✅ Empathetic acknowledgment
- ✅ Searches for relationship/couples therapists
- ✅ Offers relevant support

### Test 4: Casual Conversation
```
how are you doing?
```

**Expected Response:**
- ✅ Natural, warm greeting
- ✅ Asks how user is doing
- ✅ No forced booking attempt

### Test 5: Multi-Turn Context
```
Message 1: "I'm not sure if I need therapy"
Message 2: "I've just been really stressed"  
Message 3: "yeah I think that would help"
```

**Expected Behavior:**
- ✅ AI remembers previous messages
- ✅ Builds on conversation naturally
- ✅ Doesn't repeat questions
- ✅ Searches therapists when appropriate

### Test 6: Insurance Question
```
what insurance do you accept?
```

**Expected Response:**
- ✅ Lists all accepted insurance
- ✅ Asks which one user has
- ✅ Can search therapists by insurance

### Test 7: View Appointments
```
when is my appointment?
```

**Expected Response:**
- ✅ Calls view_my_appointments tool
- ✅ Shows upcoming appointments
- ✅ Or says "no appointments found"

---

## 🎨 What to Look For

### ✅ GOOD Signs (AI is working):
- Empathetic, natural responses
- Understands context without asking obvious questions
- Proactively searches for therapists when user mentions a problem
- Remembers what was said in the conversation
- Feels like talking to a person, not a bot

### ❌ BAD Signs (Fallback mode):
- Generic "Hi! I'm Kai..." greeting when user shares feelings
- Asks for information already provided
- Doesn't search for therapists automatically
- Robotic, pattern-matching responses

---

## 🔍 Debugging

### If AI Isn't Working:

**Check 1: API Rate Limit**
- You might be hitting 429 errors
- Wait a few minutes for rate limit to reset
- Free tier: 15 requests/minute, 1500/day

**Check 2: Supabase Logs**
Go to: https://supabase.com/dashboard/project/qhuqwljmphigdvcwwzgg/functions/handle-chat

Look for:
- ✅ `✅ Using model: gemini-2.0-flash-exp` (AI working)
- ❌ `⚠️ AI conversation failed, falling back...` (Using fallback)

**Check 3: Browser Console**
- Open Developer Tools (F12)
- Check for any fetch errors
- Look for successful responses from `/handle-chat`

---

## 📊 Comparison

### Before (Fallback/Hardcoded):
```
User: "i have been very busy with work lately"
Bot: "Hi! I'm Kai, your appointment assistant 👋
     I can help you:
     • Find a therapist
     • Book appointments..."
```
❌ Generic greeting, no context awareness

### After (AI Agent):
```
User: "i have been very busy with work lately"  
Bot: "Being overwhelmed with work is really tough, especially when 
     it feels constant. Have you been able to talk to anyone about this? 
     I can help you find a therapist who specializes in work-related 
     stress and burnout.
     
     I found 3 therapists who can help with work stress..."
```
✅ Context-aware, empathetic, proactive tool usage

---

## 🎯 Key Features to Test

### 1. Context Understanding
- Say something vague like "I'm stressed"
- AI should understand and search for stress therapists

### 2. Conversation Memory
- Mention insurance in message 1
- Mention problem in message 2  
- AI should remember both when searching

### 3. Proactive Tool Calling
- Say "I have anxiety"
- AI should immediately search, not ask "what do you need?"

### 4. Natural Conversation
- Have a back-and-forth chat
- Should feel natural, not scripted

### 5. Empathy
- Share feelings ("I'm overwhelmed")
- Should get validation and support

---

## 📱 Frontend Check

Make sure your frontend is sending conversation history:

```typescript
// In ChatWindow.tsx or similar
const response = await fetch('/handle-chat', {
  method: 'POST',
  body: JSON.stringify({
    userMessage: message,
    conversationHistory: messages, // ✅ This is critical
    patientId: userId,
    timeZone: 'Asia/Kolkata'
  })
});
```

Without conversation history, the AI won't remember context!

---

## ✨ Success Criteria

Your AI agent is working perfectly when:

✅ **It understands context** - "busy with work" → work stress support  
✅ **It's proactive** - automatically searches therapists  
✅ **It remembers** - doesn't ask the same question twice  
✅ **It's empathetic** - validates feelings authentically  
✅ **It's conversational** - feels natural, not robotic  
✅ **It uses tools intelligently** - calls tools when helpful  
✅ **It guides naturally** - doesn't force booking  

---

## 🚀 Next Steps

1. **Test with the messages above**
2. **Check if responses are context-aware**
3. **Try edge cases** (vague requests, multi-turn conversations)
4. **Monitor Supabase logs** to see AI vs fallback
5. **Share results!**

---

**Your AI agent is deployed and ready to have intelligent, empathetic conversations!** 🎉
