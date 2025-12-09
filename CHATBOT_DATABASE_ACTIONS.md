# AI Scheduler Bot - Natural Language Understanding

Your chatbot **Kai** now understands natural language statements and can take
actions on your database!

## 🧠 What Kai Can Understand

### 📅 View Appointments

```
"When is my appointment?"
"Show my appointments"
"What's my schedule?"
"Do I have any bookings?"
"Show me my upcoming sessions"
```

### ❌ Cancel Appointments

```
"Cancel my appointment"
"I need to cancel"
"I can't make it to my appointment"
"Please cancel my session"
```

### 🔄 Reschedule Appointments

```
"Move my appointment to tomorrow"
"Reschedule to 3pm"
"Can I change my appointment to next Monday?"
"I need to reschedule"
```

### 👥 Search Therapists

```
"Show me all therapists"
"Find therapists for anxiety"
"Who specializes in depression?"
"I need help with stress"
"Show therapists who accept Aetna"
```

### 📋 Book Appointments

```
"Book with Dr. Smith tomorrow at 2pm"
"I want to schedule an appointment"
"Can I book a session for next Monday?"
```

### 🔍 Get Therapist Info

```
"Tell me about Dr. Smith"
"Who is therapist Jane?"
"What's Dr. Anderson's specialty?"
```

### ⏰ Check Available Slots

```
"What times are available tomorrow?"
"When can I see Dr. Smith?"
"Show available slots for next week"
"What times work on Monday?"
```

---

## 🛠️ How It Works

1. **User sends a message** → Kai analyzes the natural language
2. **Intent Recognition** → Gemini AI identifies what the user wants (book,
   cancel, reschedule, etc.)
3. **Information Extraction** → AI extracts dates, times, therapist names, etc.
4. **Database Action** → Kai calls the appropriate tool to interact with your
   database
5. **Response** → Friendly, empathetic response with results

---

## 📊 New Tools Available

| Tool                     | Description                                |
| ------------------------ | ------------------------------------------ |
| `get_my_appointments`    | Fetches user's upcoming/past appointments  |
| `cancel_appointment`     | Cancels an existing appointment            |
| `reschedule_appointment` | Moves appointment to new time              |
| `get_therapist_info`     | Gets detailed therapist information        |
| `get_available_slots`    | Shows available time slots for a date      |
| `update_patient_info`    | Saves patient problem/schedule/insurance   |
| `search_therapists`      | Searches therapists by specialty/insurance |
| `check_availability`     | Checks if a time slot is free              |
| `book_appointment`       | Books a new appointment                    |

---

## 🔒 Safety Features

- **Confirmation Required** before canceling or rescheduling
- **Working Hours Validation** (9am - 6pm)
- **Double-booking Prevention**
- **Past-date Rejection**

---

## 💬 Example Conversation

**User:** "When is my next appointment?"

**Kai:** "📅 You have 1 upcoming appointment:

📅 Appointment #1 👤 Therapist: DR. JANE SMITH ⏰ Time: Tuesday, Dec 10, 2024 at
2:00 PM 📍 Status: Confirmed

Would you like to reschedule or cancel this appointment?"

---

**User:** "Can you move it to 3pm tomorrow?"

**Kai:** "🔄 I'll reschedule your appointment with Dr. Jane Smith to tomorrow at
3:00 PM. Is that correct?"

---

**User:** "Yes, please"

**Kai:** "✅ Done! Your appointment has been rescheduled.

📅 New Appointment: 👤 Dr. Jane Smith ⏰ Wednesday, Dec 11, 2024 at 3:00 PM

See you then! ❤️"

---

## 🚀 Deployment

Function deployed: `handle-chat`\
Status: ✅ Live

Test it by chatting with your bot!
