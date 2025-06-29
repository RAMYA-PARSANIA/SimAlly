-- Add is_reminder column to calendar_events table if it doesn't exist
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS is_reminder BOOLEAN DEFAULT false;

-- Create notification_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS notification_settings (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  task_reminders boolean DEFAULT true,
  event_reminders boolean DEFAULT true,
  reminder_notifications boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on notification_settings if not already enabled
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for notification_settings if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notification_settings' 
    AND policyname = 'Users can manage their own notification settings'
  ) THEN
    CREATE POLICY "Users can manage their own notification settings"
      ON notification_settings
      FOR ALL
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END
$$;

-- Create function and trigger for notification_settings if they don't exist
CREATE OR REPLACE FUNCTION update_notification_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_notification_settings_updated_at'
  ) THEN
    CREATE TRIGGER update_notification_settings_updated_at
    BEFORE UPDATE ON notification_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_settings_updated_at();
  END IF;
END
$$;