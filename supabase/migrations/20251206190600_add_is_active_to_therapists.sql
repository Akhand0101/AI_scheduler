ALTER TABLE public.therapists
ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.therapists
ADD COLUMN timezone TEXT;
