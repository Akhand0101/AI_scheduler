#!/bin/bash
# Quick script to set Google secrets for calendar sync

echo "🔐 Setting Google OAuth Secrets for Calendar Sync"
echo ""
echo "First, get your credentials from:"
echo "https://console.cloud.google.com/apis/credentials"
echo ""
read -p "Enter your Google Client ID: " CLIENT_ID
read -p "Enter your Google Client Secret: " CLIENT_SECRET

echo ""
echo "Setting secrets..."
npx supabase secrets set GOOGLE_CLIENT_ID="$CLIENT_ID"
npx supabase secrets set GOOGLE_CLIENT_SECRET="$CLIENT_SECRET"

echo ""
echo "✅ Secrets set! Verifying..."
npx supabase secrets list

echo ""
echo "✅ Done! Now book a test appointment to verify calendar sync."
