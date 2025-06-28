/*
  # Create Meetings Table

  1. New Tables
    - `meetings` - Store Google Meet meeting information
      - `id` (uuid, primary key)
      - `title` (text, meeting title)
      - `description` (text, meeting description)
      - `start_time` (timestamptz, when meeting starts)
      - `end_time` (timestamptz, when meeting ends)
      - `user_email` (text, email of meeting creator)
      - `google_event_id` (text, ID from Google Calendar)
      - `google_meet_link` (text, URL to join meeting)
      - `participants` (text[], list of participant emails)
      - `created_at` (timestamptz, when record was created)
      - `updated_at` (timestamptz, when record was last updated)

  2. Security
    - Enable RLS on meetings table
    - Add policy for users to manage their own meetings
    - Add indexes for performance

  3. Features
    - Store Google Meet links for easy access
    - Track meeting participants
    - Maintain meeting history
*/

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

-- Create policies
CREATE POLICY "Users can manage their own meetings"
  ON meetings
  FOR ALL
  TO public
  USING (user_email = CURRENT_USER);

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

-- Create trigger
CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_meetings_updated_at();