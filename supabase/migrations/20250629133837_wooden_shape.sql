/*
  # Fix Time Entries Table and Policies

  1. New Table (if not exists)
    - `time_entries`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `task_name` (text)
      - `description` (text)
      - `start_time` (timestamptz)
      - `end_time` (timestamptz, nullable)
      - `duration_minutes` (integer, nullable)
      - `billable` (boolean, default true)
      - `hourly_rate` (numeric)
      - `created_at` (timestamptz, default now())
  
  2. Security
    - Enable RLS on `time_entries` table
    - Add policy for authenticated users to manage their own time entries
  
  3. Performance
    - Add indexes for user_id and start_time
*/

-- Create time_entries table if it doesn't exist
CREATE TABLE IF NOT EXISTS time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task_name text NOT NULL,
  description text NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  duration_minutes integer,
  billable boolean DEFAULT true,
  hourly_rate numeric(8,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- Create policy using DO block to check if it exists first
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'time_entries' AND policyname = 'Users can manage their own time entries'
  ) THEN
    CREATE POLICY "Users can manage their own time entries" 
      ON time_entries 
      FOR ALL 
      TO authenticated 
      USING (user_id = auth.uid());
  END IF;
END $$;

-- Create indexes for faster queries if they don't exist
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_start_time ON time_entries(start_time);