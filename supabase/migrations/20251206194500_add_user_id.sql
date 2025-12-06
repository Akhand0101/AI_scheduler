-- Add user_id column to therapists table to link with auth.users
ALTER TABLE public.therapists 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Add email column for convenience
ALTER TABLE public.therapists 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Create constraint to ensure one therapist per user
ALTER TABLE public.therapists 
ADD CONSTRAINT unique_user_id UNIQUE (user_id);
