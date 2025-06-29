/*
  # Add notification settings

  1. New Tables
    - `notification_settings` - Stores user preferences for notifications
      - `user_id` (uuid, primary key, references profiles.id)
      - `task_reminders` (boolean, default true)
      - `event_reminders` (boolean, default true)
      - `reminder_notifications` (boolean, default true)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())
  
  2. Security
    - Enable RLS on `notification_settings` table
    - Add policy for users to manage their own notification settings
    - Add policy for users to view their own notification settings
*/

-- Create notification_settings table
CREATE TABLE IF NOT EXISTS notification_settings (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  task_reminders boolean DEFAULT true,
  event_reminders boolean DEFAULT true,
  reminder_notifications boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own notification settings"
  ON notification_settings
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create trigger to update updated_at column
CREATE OR REPLACE FUNCTION update_notification_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notification_settings_updated_at
BEFORE UPDATE ON notification_settings
FOR EACH ROW
EXECUTE FUNCTION update_notification_settings_updated_at();