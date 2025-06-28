-- Create meetings table
CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  user_email text NOT NULL,
  google_event_id text NOT NULL,
  google_meet_link text NOT NULL,
  participants text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- Create policy only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'meetings' 
    AND policyname = 'Users can manage their own meetings'
  ) THEN
    CREATE POLICY "Users can manage their own meetings"
      ON meetings
      FOR ALL
      TO public
      USING (user_email IN (SELECT username FROM profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_meetings_user_email ON meetings(user_email);
CREATE INDEX IF NOT EXISTS idx_meetings_google_event_id ON meetings(google_event_id);
CREATE INDEX IF NOT EXISTS idx_meetings_start_time ON meetings(start_time);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_meetings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_meetings_updated_at'
    AND tgrelid = 'meetings'::regclass
  ) THEN
    CREATE TRIGGER update_meetings_updated_at
      BEFORE UPDATE ON meetings
      FOR EACH ROW
      EXECUTE FUNCTION update_meetings_updated_at();
  END IF;
END $$;