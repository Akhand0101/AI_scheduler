-- 1. Therapists Table (Stores doctor info & credentials)
create table therapists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  specialties text[] not null, -- Array of strings for matching
  accepted_insurance text[] not null, -- Array of strings
  bio text, -- Optional: for AI matching context
  google_calendar_id text, -- Their email or specific calendar ID
  google_refresh_token text, -- Encrypted token for booking (Critical)
  created_at timestamp with time zone default now()
);

-- 2. Inquiries Table (Stores the chat state & AI extraction)
create table inquiries (
  id uuid primary key default gen_random_uuid(),
  patient_identifier text, -- Optional: hash of phone/email
  problem_description text,
  requested_schedule text,
  insurance_info text,
  extracted_specialty text, -- Populated by Gemini
  matched_therapist_id uuid references therapists(id),
  status text default 'pending', -- 'pending', 'matched', 'scheduled'
  created_at timestamp with time zone default now()
);

-- 3. Appointments Table (Stores finalized bookings)
create table appointments (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid references inquiries(id),
  therapist_id uuid references therapists(id),
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  google_calendar_event_id text,
  status text default 'confirmed',
  created_at timestamp with time zone default now()
);