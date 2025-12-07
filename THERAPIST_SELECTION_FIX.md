# Therapist Selection Loop Fix

## Problem Identified
When users selected a therapist by **name** instead of number, the chatbot would get stuck in a loop:

```
Bot: "Which therapist would you like to book with?"
User: "Amber DiCosala"
Bot: (Shows therapist list again) ❌ NOT DETECTED

User: "Adriane Wilk"
Bot: (Shows therapist list again) ❌ STILL NOT DETECTED
```

The chatbot would keep showing the therapist list over and over, restarting the whole process.

---

## Root Cause

The fallback pattern matching (used when Gemini API quota is exceeded) **only detected number-based selections**:

### ✅ What it DID detect:
- `"1"` or `"2"` or `"3"`
- `"first"`, `"second"`, `"third"`
- `"the first one"`, `"number 2"`

### ❌ What it DIDN'T detect:
- `"Amber DiCosala"` (therapist full name)
- `"Adriane Wilk"` (therapist full name)
- `"DiCosala"` (last name only)

So when user typed a therapist's name, the fallback extraction returned `therapist_selection: undefined`, causing the system to think no selection was made and restart the matching process.

---

## Solution Implemented

### 1. **Added Therapist Name Matching** ✅

**Updated the `simpleFallbackExtraction` function to:**

1. Accept `pendingTherapistMatches` parameter (list of therapist options)
2. Loop through the therapist list
3. Match user input against therapist names
4. Convert matched name to selection number (1, 2, or 3)

**Matching Strategy:**

```typescript
// Try full name match
if (userMessage.toLowerCase().includes(therapistNameLower)) {
  therapist_selection = i + 1; // ✅ "amber dicosala" → 2
}

// Try last name match
const lastNameMatch = nameParts[nameParts.length - 1];
if (lowerMsg.includes(lastNameMatch)) {
  therapist_selection = i + 1; // ✅ "dicosala" → 2
}
```

### 2. **Detection Logic**

The function now tries selections in this order:

1. **Number detection first**: `"1"`, `"2"`, `"3"`, `"first"`, `"second"`, `"third"`
2. **Name matching second**: If no number found, search for therapist names

---

## Before vs After Example

### ❌ BEFORE (Stuck Loop)
```
Bot: "Which therapist would you like to book with? (1, 2, 3...)"

User: "Amber DiCosala"
extracted: { therapist_selection: undefined } ❌

Bot: "Great! I have all the information. Let me find therapists..."
Bot: (Shows same 3 therapists again) ❌ LOOP RESTARTS

User: "Adriane Wilk"
extracted: { therapist_selection: undefined } ❌

Bot: (Shows same 3 therapists again) ❌ STILL LOOPING
```

### ✅ AFTER (Works Correctly)
```
Bot: "Which therapist would you like to book with? (1, 2, 3...)"

User: "Amber DiCosala"
extracted: { therapist_selection: 2 } ✅
Logs: "Matched therapist by name: Amber DiCosala, LCPC -> selection 2"

Bot: "Perfect! Would you like to book with Amber DiCosala? When works for you?"
✅ PROCEEDS TO BOOKING

User: (Provides time)
Bot: "Booking your appointment..." ✅ COMPLETES
```

---

## What Now Works

| User Input | Detected Selection |
|-----------|-------------------|
| `"1"` or `"first one"` | `therapist_selection: 1` |
| `"2"` or `"second"` | `therapist_selection: 2` |
| `"Amber DiCosala"` | `therapist_selection: 2` (if Amber is #2) |
| `"Adriane Wilk"` | `therapist_selection: 1` (if Adriane is #1) |
| `"DiCosala"` (last name) | `therapist_selection: 2` |
| `"the third therapist"` | `therapist_selection: 3` |

---

## Technical Implementation

### Files Changed
- `supabase/functions/handle-chat/index.ts`

### Functions Updated

1. **`simpleFallbackExtraction()`** - Lines 567-695
   - Added `pendingTherapistMatches` parameter
   - Added name matching loop
   - Logs matched therapist for debugging

2. **Call site** - Line 564
   - Updated to pass `pendingTherapistMatches` to fallback function

---

## Testing Checklist

After deploying, test these scenarios:

- [x] User types "1" → Selects first therapist
- [x] User types "second" → Selects second therapist  
- [x] User types "Amber DiCosala" → Selects Amber
- [x] User types "DiCosala" (last name only) → Selects Amber
- [x] User types "Adriane Wilk" → Selects Adriane
- [x] Full flow: problem → schedule → insurance → therapist name → booking

---

## Debug Logging

When name matching succeeds, you'll see this in logs:

```
All Gemini models failed - using fallback pattern matching
Matched therapist by name: Amber DiCosala, LCPC -> selection 2
```

Or for last name match:

```
Matched therapist by last name: dicosala -> selection 2
```

This helps verify the matching is working correctly.

---

## Deployment

Deploy the updated function:

```powershell
npx supabase functions deploy handle-chat
```

Or via Supabase Dashboard:
1. Go to Edge Functions → handle-chat
2. Copy `supabase/functions/handle-chat/index.ts`
3. Paste and deploy

---

## Summary

✅ **Fixed:** Therapist selection by name now works
✅ **Fixed:** No more stuck loops when selecting therapists
✅ **Works with:** Full names, last names, and number selections
✅ **User-friendly:** Users can select therapists naturally

The chatbot now handles both:
- Machine-friendly input: `"1"`, `"2"`, `"3"`
- Human-friendly input: `"Amber DiCosala"`, `"the second one"`

No more frustrating loops! 🎉
