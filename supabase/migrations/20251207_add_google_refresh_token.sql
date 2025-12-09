-- NOTE: Google refresh tokens should be set via the Admin UI's "Connect Calendar" feature
-- Do NOT hardcode tokens in migration files as they will be blocked by GitHub secret scanning
-- 
-- To set up calendar sync for therapists:
-- 1. Log in to the admin dashboard
-- 2. Navigate to Calendar Settings
-- 3. Click "Connect Google Calendar" to authenticate
-- 4. The token will be securely stored in the database

-- This migration is now a no-op placeholder
-- Tokens are managed through the admin interface

-- Verify the update
SELECT id, name, 
  CASE 
    WHEN google_refresh_token IS NOT NULL THEN 'Token Set' 
    ELSE 'No Token' 
  END as token_status
FROM therapists;
