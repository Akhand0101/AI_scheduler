# 🎯 Kai Testing Guide - Quick Reference

## Quick Test Commands

### Test from Debug Page

Navigate to: `http://localhost:5173/debug` Click: **Test 'handle-chat'
Function**

### Test from Chat Interface

Navigate to chat interface and try these:

---

## 💬 Test Scenarios

### 1. Insurance Questions

```
"What insurance do you accept?"
"Do you take Blue Cross?"
"I have Medicare"
```

**Expected**: Lists insurance providers or confirms acceptance

---

### 2. Emotional Expression

```
"I'm feeling really anxious"
"I've been depressed lately"
"I'm stressed out"
```

**Expected**: Empathetic response + offers to help find therapist

---

### 3. Therapist Search

```
"Show me all therapists"
"Find therapists for anxiety"
"Who accepts Aetna?"
```

**Expected**: Lists therapists with specialties and insurance

---

### 4. Booking Flow

```
Step 1: "I need help with anxiety"
Step 2: "I have Blue Cross"
Step 3: "Tomorrow afternoon"
Step 4: "3pm works"
Step 5: "Yes, book it"
```

**Expected**: Guides through booking, confirms details, creates appointment

---

### 5. View Appointments

```
"When is my appointment?"
"Show my schedule"
"What appointments do I have?"
```

**Expected**: Lists upcoming appointments with details

---

### 6. Cancel Appointment

```
"Cancel my appointment"
"I need to cancel"
```

**Expected**: Shows appointment details, asks for confirmation

---

### 7. Reschedule

```
"Move my appointment to tomorrow"
"Reschedule to Friday at 2pm"
```

**Expected**: Checks availability, confirms new time

---

### 8. Availability Check

```
"When is Dr. Smith available?"
"What times work tomorrow?"
"Show available slots for Monday"
```

**Expected**: Lists available time slots

---

## 🔍 What to Check

### ✅ Response Quality

- [ ] Warm and friendly tone
- [ ] Clear and concise (2-4 sentences)
- [ ] No markdown asterisks
- [ ] Natural conversation flow
- [ ] Appropriate emojis (not excessive)

### ✅ Functionality

- [ ] Searches therapists correctly
- [ ] Books appointments in database
- [ ] Validates working hours (9 AM - 6 PM)
- [ ] Prevents double-booking
- [ ] Shows appointment details
- [ ] Cancels appointments
- [ ] Reschedules correctly

### ✅ Error Handling

- [ ] Graceful fallback when AI fails
- [ ] Clear error messages
- [ ] No crashes or blank responses
- [ ] Handles missing data well

### ✅ Intent Understanding

- [ ] Recognizes emotional expressions
- [ ] Understands time references (tomorrow, next Monday, etc.)
- [ ] Parses casual queries
- [ ] Identifies action requests

---

## 🐛 Common Issues & Fixes

### Issue: "Connection Failed"

**Fix**: Ensure Supabase is running

```bash
npx supabase start
# OR
npx supabase functions serve
```

### Issue: AI not responding

**Fix**: Check GEMINI_API_KEY is set

- Local: Add to `supabase/.env`
- Remote: `npx supabase secrets set GEMINI_API_KEY=your_key`

### Issue: Blank or generic responses

**Fix**: Check conversation history is being sent correctly from frontend

### Issue: "Tool not found" errors

**Fix**: Redeploy the function

```bash
npx supabase functions deploy handle-chat
```

---

## 📊 Success Metrics

A successful conversation should:

1. **Understand intent** in 1-2 exchanges
2. **Collect info** without overwhelming (one question at a time)
3. **Confirm actions** before executing
4. **Provide clear feedback** after completing actions
5. **Feel human** - warm, empathetic, natural

---

## 🎭 Personality Check

Good Response Examples:

✅ **Empathetic** "❤️ I hear you. Dealing with anxiety can be really
challenging, and it takes courage to reach out."

✅ **Clear** "I found 5 therapists who specialize in anxiety and accept your
insurance."

✅ **Helpful** "Would you like to see available times for tomorrow afternoon?"

✅ **Concise** "All set! Your appointment is booked for tomorrow at 3 PM. 🌟"

---

Bad Response Examples:

❌ **Too robotic** "Your request has been processed. Appointment ID: 12345 has
been created in the system."

❌ **Too wordy** "Thank you so much for reaching out to us today. I really
appreciate you taking the time to share your concerns with me. I want you to
know that we have many different therapists available..."

❌ **Confusing** "**Important:** Please note that _**all appointments**_ must be
scheduled within _working hours_."

❌ **Overwhelming** "To help you, I need: 1) Your insurance, 2) Your
availability, 3) Your condition, 4) Your preferred therapist type, 5) Your
location preference..."

---

## 🚀 Quick Deploy

Redeploy after changes:

```bash
npx supabase functions deploy handle-chat
```

Check deployment logs:

```bash
npx supabase functions logs handle-chat
```

---

**Happy Testing! 🎉**
