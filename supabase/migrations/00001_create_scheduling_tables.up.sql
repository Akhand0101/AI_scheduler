-- Up Migration: Creates the therapists, inquiries, and appointments tables

-- 1. Create the therapists table
CREATE TABLE public.therapists (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    specialties text[] NOT NULL, -- Array of text for specialties (e.g., ['anxiety', 'depression']) [cite: 62]
    accepted_insurance text[] NOT NULL, -- Array of text for accepted insurance [cite: 62]
    google_calendar_id text NULL, -- The therapist's primary calendar ID, usually their email [cite: 63]
    google_refresh_token text NULL, -- STORE SECURELY: Needed to access their calendar long-term [cite: 64]
    created_at timestamp with time zone DEFAULT now()
);

COMMENT ON TABLE public.therapists IS 'Stores information about available therapists.';

-- 2. Create the inquiries table
CREATE TABLE public.inquiries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_identifier text NULL, -- Placeholder, avoid storing raw PII for prototype [cite: 71]
    problem_description text NOT NULL, -- The patient''s problem described in natural language [cite: 73]
    requested_schedule text NULL, -- Desired schedule times [cite: 74]
    insurance_info text NULL, -- Insurance provider information [cite: 75]
    extracted_specialty text NULL, -- Specialty extracted by the AI [cite: 76]
    matched_therapist_id uuid REFERENCES public.therapists(id) NULL, -- Foreign key to the matched therapist [cite: 77]
    status text DEFAULT 'pending' NOT NULL, -- e.g., 'pending', 'matched', 'scheduled', 'failed' [cite: 79]
    created_at timestamp with time zone DEFAULT now()
);

COMMENT ON TABLE public.inquiries IS 'Tracks patient requests and the results of AI processing.';

-- 3. Create the appointments table
CREATE TABLE public.appointments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_id uuid REFERENCES public.inquiries(id) NOT NULL, -- Links to the original inquiry [cite: 82]
    therapist_id uuid REFERENCES public.therapists(id) NOT NULL, -- Links to the booked therapist [cite: 82]
    patient_identifier text NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    google_calendar_event_id text NULL, -- ID of the event created in Google Calendar [cite: 85]
    status text DEFAULT 'confirmed' NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

COMMENT ON TABLE public.appointments IS 'Records successfully scheduled appointments.';

