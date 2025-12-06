-- Add demo therapists to the database
-- This migration adds 14 therapists with their credentials, specialties, and session types

INSERT INTO public.therapists (name, specialties, accepted_insurance, bio, is_active, timezone) VALUES
-- Adriane Wilk, LCPC
(
  'Adriane Wilk, LCPC',
  ARRAY['Anxiety', 'Depression', 'Trauma', 'Substance abuse (clients and family members)', 'Life Transitions', 'Chronic Illness'],
  ARRAY['Blue Cross Blue Shield', 'Aetna', 'Cigna', 'UnitedHealthcare', 'Medicare'],
  'Licensed Clinical Professional Counselor. Offers Virtual Sessions and EMDR. Specializing in anxiety, depression, trauma, substance abuse support for clients and family members, life transitions, and chronic illness management.',
  true,
  'America/Chicago'
),

-- Amber DiCosala, LCPC
(
  'Amber DiCosala, LCPC',
  ARRAY['Anxiety', 'Depression', 'Life Transitions', 'College-Aged Students', 'Relationship Stressors'],
  ARRAY['Blue Cross Blue Shield', 'Aetna', 'Cigna', 'UnitedHealthcare'],
  'Licensed Clinical Professional Counselor. Offers In-Office and Virtual Sessions. Works with individual adults and couples, specializing in anxiety, depression, life transitions, college-aged students, and relationship stressors.',
  true,
  'America/Chicago'
),

-- Catherine Watson, LCPC
(
  'Catherine Watson, LCPC',
  ARRAY['Anxiety', 'Depression', 'Low self-esteem/self-worth', 'Life transitions', 'College/Graduate Students', 'Couples/Relationship Issues', 'LGBTQIA+'],
  ARRAY['Blue Cross Blue Shield', 'Aetna', 'Cigna', 'UnitedHealthcare', 'Humana'],
  'Clinical Supervisor, Licensed Clinical Professional Counselor. Offers Virtual Sessions. Specializing in anxiety, depression, low self-esteem/self-worth, life transitions, college/graduate students, couples/relationship issues, and LGBTQIA+ affirming care.',
  true,
  'America/Chicago'
),

-- Chris Dubois, LPC
(
  'Chris Dubois, LPC',
  ARRAY['Anxiety', 'Depression', 'Marital/Relationship Issues', 'Low Self-Esteem/Self-Worth', 'College/Graduate Students', 'LGBTQIA+'],
  ARRAY['Blue Cross Blue Shield', 'Aetna', 'Cigna', 'UnitedHealthcare'],
  'Licensed Professional Counselor. Offers In-Office and Virtual Sessions. Specializing in anxiety, depression, marital/relationship issues, low self-esteem/self-worth, college/graduate students, and LGBTQIA+ affirming care.',
  true,
  'America/Chicago'
),

-- Clara Gay, LSW
(
  'Clara Gay, LSW',
  ARRAY['Teenagers (15+)', 'Anxiety', 'Depression', 'Low Self-Esteem/Self-Worth', 'College Students', 'Life Transitions'],
  ARRAY['Blue Cross Blue Shield', 'Aetna', 'Cigna', 'UnitedHealthcare'],
  'Pre-Licensed Social Worker. Offers In-Office and Virtual Sessions. Specializing in working with teenagers (15+), anxiety, depression, low self-esteem/self-worth, college students, and life transitions.',
  true,
  'America/Chicago'
),

-- Claudia Hernandez, LCPC
(
  'Claudia Hernandez, LCPC',
  ARRAY['Anxiety', 'Depression', 'Trauma', 'Low Self-Esteem/Self-Worth', 'LGBTQIA+', 'college/graduate students'],
  ARRAY['Blue Cross Blue Shield', 'Aetna', 'Cigna', 'UnitedHealthcare', 'Medicaid'],
  'Licensed Clinical Professional Counselor. Offers In-Office and Virtual Sessions, Speaks Spanish. Specializing in anxiety, depression, trauma, low self-esteem/self-worth, LGBTQIA+ affirming care, and college/graduate students.',
  true,
  'America/Chicago'
),

-- Dana Norden, LCSW
(
  'Dana Norden, LCSW',
  ARRAY['Trauma', 'Low Self-Esteem/Self-Worth', 'LGBTQIA+', 'College/Graduate Students', 'Artists', 'Musicians', 'Trade Workers', 'Marital/Pre-Marital/Relationship Issues', 'Family Conflict'],
  ARRAY['Blue Cross Blue Shield', 'Aetna', 'Cigna', 'UnitedHealthcare'],
  'Licensed Clinical Social Worker. Offers In-Office and Virtual Sessions. Specializing in trauma, low self-esteem/self-worth, LGBTQIA+ affirming care, college/graduate students, and working with artists, musicians, trade workers. Also focuses on marital/pre-marital/relationship issues and family conflict.',
  true,
  'America/Chicago'
),

-- Danielle Kepler, LCPC
(
  'Danielle Kepler, LCPC',
  ARRAY['Anxiety', 'Depression', 'Life Transitions', 'Marital/Pre-Marital/Relationship Issues', 'LGBTQIA+', 'College/Graduate Students', 'Young Professionals'],
  ARRAY['Blue Cross Blue Shield', 'Aetna', 'Cigna', 'UnitedHealthcare', 'Humana'],
  'Practice Owner, Licensed Clinical Professional Counselor, Certified Gottman Therapist. Offers In-Office and Virtual Sessions. Specializing in anxiety, depression, life transitions, marital/pre-marital/relationship issues, LGBTQIA+ affirming care, college/graduate students, and young professionals.',
  true,
  'America/Chicago'
),

-- Jasmine Goins, LCSW
(
  'Jasmine Goins, LCSW',
  ARRAY['Anxiety', 'Depression', 'Life Transitions', 'Grief', 'Low Self-Esteem/Self-Worth', 'College/Graduate Students', 'Young Professionals', 'Older Adults'],
  ARRAY['Blue Cross Blue Shield', 'Aetna', 'Cigna', 'UnitedHealthcare', 'Medicare'],
  'Licensed Clinical Social Worker. Offers In-Office and Virtual Sessions. Specializing in anxiety, depression, life transitions, grief, low self-esteem/self-worth, college/graduate students, young professionals, and older adults.',
  true,
  'America/Chicago'
),

-- Joslyn Mowen, LCPC
(
  'Joslyn Mowen, LCPC',
  ARRAY['Anxiety', 'Depression', 'Life Transitions', 'Grief', 'Low Self-Esteem/Self-Worth', 'College/Graduate/Medical Students', 'Young Professionals', 'Marital/Pre-Marital/Relationship Issues'],
  ARRAY['Blue Cross Blue Shield', 'Aetna', 'Cigna', 'UnitedHealthcare', 'Humana'],
  'Clinical Director, Licensed Clinical Professional Counselor. Offers Virtual Sessions. Specializing in anxiety, depression, life transitions, grief, low self-esteem/self-worth, college/graduate/medical students, young professionals, and marital/pre-marital/relationship issues.',
  true,
  'America/Chicago'
),

-- Kelsey Kamin, LSW
(
  'Kelsey Kamin, LSW',
  ARRAY['Anxiety', 'Depression', 'Life Transitions', 'Low Self-Esteem/Self-Worth', 'College Students', 'Young Professionals', 'Marital/Pre-Marital/Relationship Issues'],
  ARRAY['Blue Cross Blue Shield', 'Aetna', 'Cigna', 'UnitedHealthcare'],
  'Licensed Social Worker. Offers In-Office and Virtual Sessions. Specializing in anxiety, depression, life transitions, low self-esteem/self-worth, college students, young professionals, and marital/pre-marital/relationship issues.',
  true,
  'America/Chicago'
),

-- Rachel Kurt, LCPC
(
  'Rachel Kurt, LCPC',
  ARRAY['Anxiety', 'Depression', 'Life Transitions', 'Grief', 'Low Self-Esteem/Self-Worth', 'College/Graduate/Medical Students', 'Young Professionals', 'Job Stressors'],
  ARRAY['Blue Cross Blue Shield', 'Aetna', 'Cigna', 'UnitedHealthcare'],
  'Licensed Clinical Professional Counselor. Offers In-Office and Virtual Sessions. Specializing in anxiety, depression, life transitions, grief, low self-esteem/self-worth, college/graduate/medical students, young professionals, and job stressors.',
  true,
  'America/Chicago'
),

-- Sydney Walden, LCSW
(
  'Sydney Walden, LCSW',
  ARRAY['Anxiety', 'Loss', 'Trauma', 'Neglect/Codependency', 'LGBTQIA+', 'STEM workers', 'Healthcare', 'Academia'],
  ARRAY['Blue Cross Blue Shield', 'Aetna', 'Cigna', 'UnitedHealthcare', 'Humana'],
  'Clinical Supervisor, Licensed Clinical Social Worker. Offers In-Office and Virtual Sessions, EMDR-Trained. Specializing in anxiety, loss, trauma, neglect/codependency, LGBTQIA+ affirming care, and working with STEM workers, healthcare professionals, and academia.',
  true,
  'America/Chicago'
),

-- Tykisha Bays, LSW, CADC
(
  'Tykisha Bays, LSW, CADC',
  ARRAY['Anxiety', 'Depression', 'Alcohol/Drug Abuse (client and family members)', 'Life Transitions', 'Low Self-Esteem/Self Worth', 'Job Stressors', 'Grief', 'Trauma', 'Pre-Marital/Relationship Issues', 'LGBTQIA+', 'College/Graduate Students', 'Young Professionals', 'Older Adults'],
  ARRAY['Blue Cross Blue Shield', 'Aetna', 'Cigna', 'UnitedHealthcare', 'Medicare', 'Medicaid'],
  'Licensed Social Worker, Certified Drug and Addiction Counselor. Offers In-Office and Virtual Sessions. Specializing in anxiety, depression, alcohol/drug abuse support for clients and family members, life transitions, low self-esteem/self worth, job stressors, grief, trauma, pre-marital/relationship issues, LGBTQIA+ affirming care, college/graduate students, young professionals, and older adults.',
  true,
  'America/Chicago'
);
