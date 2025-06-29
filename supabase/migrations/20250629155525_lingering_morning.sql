/*
  # Fix Calendar Time Sync Issues

  1. New Functions
    - `check_upcoming_events` - Checks for upcoming events and creates notifications
    - `check_upcoming_reminders` - Checks for upcoming reminders and creates notifications
    - `check_upcoming_tasks` - Checks for tasks due soon and creates notifications

  2. Changes
    - Added notification check interval to notification_settings
    - Added task due notification hours to notification_settings
    - Added event reminder notification minutes to notification_settings
    - Added trigger to automatically create notification settings for new users

  3. Security
    - Ensured RLS is enabled on notification_settings
    - Added policy for users to manage their own notification settings
*/

-- Add notification check interval to notification_settings if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_settings' AND column_name = 'notification_check_interval'
  ) THEN
    ALTER TABLE notification_settings ADD COLUMN notification_check_interval integer DEFAULT 5;
  END IF;
END $$;

-- Add task due notification hours to notification_settings if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_settings' AND column_name = 'task_due_notification_hours'
  ) THEN
    ALTER TABLE notification_settings ADD COLUMN task_due_notification_hours integer DEFAULT 24;
  END IF;
END $$;

-- Add event reminder notification minutes to notification_settings if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_settings' AND column_name = 'event_reminder_notification_minutes'
  ) THEN
    ALTER TABLE notification_settings ADD COLUMN event_reminder_notification_minutes integer DEFAULT 60;
  END IF;
END $$;

-- Create function to check for upcoming tasks
CREATE OR REPLACE FUNCTION check_upcoming_tasks() RETURNS VOID AS $$
DECLARE
  user_record RECORD;
  task_record RECORD;
  now_time TIMESTAMP WITH TIME ZONE := now();
  task_due_time TIMESTAMP WITH TIME ZONE;
  notification_hours INTEGER;
BEGIN
  -- Loop through all users with notification settings
  FOR user_record IN 
    SELECT ns.user_id, ns.task_due_notification_hours
    FROM notification_settings ns
    WHERE ns.task_reminders = true
  LOOP
    notification_hours := COALESCE(user_record.task_due_notification_hours, 24);
    
    -- Check for tasks due soon
    FOR task_record IN
      SELECT t.id, t.title, t.due_date
      FROM tasks t
      WHERE t.created_by = user_record.user_id
        AND t.status NOT IN ('completed', 'cancelled')
        AND t.due_date IS NOT NULL
        AND t.due_date > now_time
        AND t.due_date <= (now_time + (notification_hours || ' hours')::INTERVAL)
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.user_id = user_record.user_id
            AND n.category = 'task'
            AND n.metadata->>'task_id' = t.id::text
            AND n.created_at > (now_time - INTERVAL '1 day')
        )
    LOOP
      task_due_time := task_record.due_date;
      
      -- Create notification
      INSERT INTO notifications (
        user_id, title, message, type, category, read, action_url, metadata
      ) VALUES (
        user_record.user_id,
        'Task Due Soon',
        'Task "' || task_record.title || '" is due in ' || 
          CASE 
            WHEN (task_due_time - now_time) < INTERVAL '1 hour' THEN 
              EXTRACT(MINUTE FROM (task_due_time - now_time)) || ' minutes'
            WHEN (task_due_time - now_time) < INTERVAL '1 day' THEN 
              EXTRACT(HOUR FROM (task_due_time - now_time)) || ' hours'
            ELSE 
              EXTRACT(DAY FROM (task_due_time - now_time)) || ' days'
          END,
        'info',
        'task',
        false,
        '/workspace?task=' || task_record.id,
        jsonb_build_object('task_id', task_record.id)
      );
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create function to check for upcoming events
CREATE OR REPLACE FUNCTION check_upcoming_events() RETURNS VOID AS $$
DECLARE
  user_record RECORD;
  event_record RECORD;
  now_time TIMESTAMP WITH TIME ZONE := now();
  notification_minutes INTEGER;
BEGIN
  -- Loop through all users with notification settings
  FOR user_record IN 
    SELECT ns.user_id, ns.event_reminder_notification_minutes
    FROM notification_settings ns
    WHERE ns.event_reminders = true
  LOOP
    notification_minutes := COALESCE(user_record.event_reminder_notification_minutes, 60);
    
    -- Check for events starting soon
    FOR event_record IN
      SELECT ce.id, ce.title, ce.start_time
      FROM calendar_events ce
      WHERE ce.user_id = user_record.user_id
        AND ce.is_reminder = false
        AND ce.start_time > now_time
        AND ce.start_time <= (now_time + (notification_minutes || ' minutes')::INTERVAL)
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.user_id = user_record.user_id
            AND n.category = 'meeting'
            AND n.metadata->>'event_id' = ce.id::text
            AND n.created_at > (now_time - INTERVAL '1 hour')
        )
    LOOP
      -- Create notification
      INSERT INTO notifications (
        user_id, title, message, type, category, read, action_url, metadata
      ) VALUES (
        user_record.user_id,
        'Event Starting Soon',
        'Event "' || event_record.title || '" starts in ' || 
          EXTRACT(MINUTE FROM (event_record.start_time - now_time)) || ' minutes',
        'info',
        'meeting',
        false,
        '/workspace?calendar=true',
        jsonb_build_object('event_id', event_record.id)
      );
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create function to check for upcoming reminders
CREATE OR REPLACE FUNCTION check_upcoming_reminders() RETURNS VOID AS $$
DECLARE
  user_record RECORD;
  reminder_record RECORD;
  now_time TIMESTAMP WITH TIME ZONE := now();
  notification_minutes INTEGER;
BEGIN
  -- Loop through all users with notification settings
  FOR user_record IN 
    SELECT ns.user_id, ns.event_reminder_notification_minutes
    FROM notification_settings ns
    WHERE ns.reminder_notifications = true
  LOOP
    notification_minutes := COALESCE(user_record.event_reminder_notification_minutes, 60);
    
    -- Check for reminders due soon
    FOR reminder_record IN
      SELECT ce.id, ce.title, ce.start_time
      FROM calendar_events ce
      WHERE ce.user_id = user_record.user_id
        AND ce.is_reminder = true
        AND ce.start_time > now_time
        AND ce.start_time <= (now_time + (notification_minutes || ' minutes')::INTERVAL)
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.user_id = user_record.user_id
            AND n.category = 'general'
            AND n.metadata->>'reminder_id' = ce.id::text
            AND n.created_at > (now_time - INTERVAL '1 hour')
        )
    LOOP
      -- Create notification
      INSERT INTO notifications (
        user_id, title, message, type, category, read, action_url, metadata
      ) VALUES (
        user_record.user_id,
        'Reminder',
        'Reminder "' || reminder_record.title || '" is due in ' || 
          EXTRACT(MINUTE FROM (reminder_record.start_time - now_time)) || ' minutes',
        'warning',
        'general',
        false,
        '/workspace?calendar=true',
        jsonb_build_object('reminder_id', reminder_record.id)
      );
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create function to check all upcoming items
CREATE OR REPLACE FUNCTION check_all_upcoming_items() RETURNS VOID AS $$
BEGIN
  PERFORM check_upcoming_tasks();
  PERFORM check_upcoming_events();
  PERFORM check_upcoming_reminders();
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically create notification settings for new users
CREATE OR REPLACE FUNCTION create_notification_settings_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_settings (
    user_id, 
    task_reminders, 
    event_reminders, 
    reminder_notifications,
    notification_check_interval,
    task_due_notification_hours,
    event_reminder_notification_minutes
  ) VALUES (
    NEW.id,
    true,
    true,
    true,
    5,
    24,
    60
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'create_notification_settings_trigger'
  ) THEN
    CREATE TRIGGER create_notification_settings_trigger
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION create_notification_settings_for_new_user();
  END IF;
END $$;

-- Ensure RLS is enabled on notification_settings
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- Add policy for users to manage their own notification settings if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notification_settings' AND policyname = 'Users can manage their own notification settings'
  ) THEN
    CREATE POLICY "Users can manage their own notification settings"
    ON notification_settings
    FOR ALL
    TO authenticated
    USING (user_id = uid())
    WITH CHECK (user_id = uid());
  END IF;
END $$;

-- Update existing notification settings with new defaults if columns were just added
UPDATE notification_settings
SET 
  notification_check_interval = COALESCE(notification_check_interval, 5),
  task_due_notification_hours = COALESCE(task_due_notification_hours, 24),
  event_reminder_notification_minutes = COALESCE(event_reminder_notification_minutes, 60);