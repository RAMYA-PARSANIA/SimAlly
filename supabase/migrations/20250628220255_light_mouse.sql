/*
  # Google Meet Integration Tables

  1. New Tables
    - `google_meet_spaces`
      - `id` (uuid, primary key)
      - `space_id` (text, unique) - Google Meet space ID
      - `meeting_code` (text) - Human-readable meeting code
      - `meeting_uri` (text) - Full Google Meet URL
      - `title` (text) - Meeting title
      - `description` (text) - Meeting description
      - `created_by` (uuid) - User who created the meeting
      - `start_time` (timestamptz) - Scheduled start time
      - `end_time` (timestamptz) - Scheduled end time
      - `status` (text) - active, ended, cancelled
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `google_meet_participants`
      - `id` (uuid, primary key)
      - `space_id` (text) - Reference to google_meet_spaces
      - `user_id` (uuid) - Participant user ID
      - `email` (text) - Participant email
      - `display_name` (text) - Participant display name
      - `joined_at` (timestamptz) - When they joined
      - `left_at` (timestamptz) - When they left (null if still active)
      - `created_at` (timestamptz)

    - `google_meet_recordings`
      - `id` (uuid, primary key)
      - `space_id` (text) - Reference to google_meet_spaces
      - `conference_record_id` (text) - Google Meet conference record ID
      - `recording_id` (text) - Google Meet recording ID
      - `name` (text) - Recording name
      - `drive_destination` (text) - Google Drive file ID
      - `start_time` (timestamptz) - Recording start time
      - `end_time` (timestamptz) - Recording end time
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own meetings
*/

-- Create google_meet_spaces table
CREATE TABLE IF NOT EXISTS google_meet_spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id text UNIQUE NOT NULL,
  meeting_code text,
  meeting_uri text NOT NULL,
  title text NOT NULL,
  description text,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_time timestamptz,
  end_time timestamptz,
  status text DEFAULT 'active' CHECK (status IN ('active', 'ended', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create google_meet_participants table
CREATE TABLE IF NOT EXISTS google_meet_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id text NOT NULL REFERENCES google_meet_spaces(space_id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  email text NOT NULL,
  display_name text,
  joined_at timestamptz,
  left_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create google_meet_recordings table
CREATE TABLE IF NOT EXISTS google_meet_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id text NOT NULL REFERENCES google_meet_spaces(space_id) ON DELETE CASCADE,
  conference_record_id text,
  recording_id text UNIQUE,
  name text,
  drive_destination text,
  start_time timestamptz,
  end_time timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE google_meet_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_meet_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_meet_recordings ENABLE ROW LEVEL SECURITY;

-- Policies for google_meet_spaces
CREATE POLICY "Users can create meeting spaces"
  ON google_meet_spaces
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can view meeting spaces they created or are invited to"
  ON google_meet_spaces
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM google_meet_participants 
      WHERE google_meet_participants.space_id = google_meet_spaces.space_id 
      AND google_meet_participants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own meeting spaces"
  ON google_meet_spaces
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete their own meeting spaces"
  ON google_meet_spaces
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Policies for google_meet_participants
CREATE POLICY "Users can view participants in meetings they're part of"
  ON google_meet_participants
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM google_meet_spaces 
      WHERE google_meet_spaces.space_id = google_meet_participants.space_id 
      AND google_meet_spaces.created_by = auth.uid()
    )
  );

CREATE POLICY "Meeting creators can manage participants"
  ON google_meet_participants
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM google_meet_spaces 
      WHERE google_meet_spaces.space_id = google_meet_participants.space_id 
      AND google_meet_spaces.created_by = auth.uid()
    )
  );

-- Policies for google_meet_recordings
CREATE POLICY "Users can view recordings from meetings they're part of"
  ON google_meet_recordings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM google_meet_spaces 
      WHERE google_meet_spaces.space_id = google_meet_recordings.space_id 
      AND (
        google_meet_spaces.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM google_meet_participants 
          WHERE google_meet_participants.space_id = google_meet_recordings.space_id 
          AND google_meet_participants.user_id = auth.uid()
        )
      )
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_google_meet_spaces_created_by ON google_meet_spaces(created_by);
CREATE INDEX IF NOT EXISTS idx_google_meet_spaces_status ON google_meet_spaces(status);
CREATE INDEX IF NOT EXISTS idx_google_meet_participants_space_id ON google_meet_participants(space_id);
CREATE INDEX IF NOT EXISTS idx_google_meet_participants_user_id ON google_meet_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_google_meet_recordings_space_id ON google_meet_recordings(space_id);

-- Create updated_at trigger for google_meet_spaces
CREATE OR REPLACE FUNCTION update_google_meet_spaces_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_google_meet_spaces_updated_at
  BEFORE UPDATE ON google_meet_spaces
  FOR EACH ROW
  EXECUTE FUNCTION update_google_meet_spaces_updated_at();