/*
  # Update calendar_events table for reminders

  1. Changes
     - Add `is_reminder` boolean column to calendar_events table
*/

-- Add is_reminder column to calendar_events table
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS is_reminder BOOLEAN DEFAULT false;