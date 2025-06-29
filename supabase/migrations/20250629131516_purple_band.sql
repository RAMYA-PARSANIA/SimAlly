/*
  # Time Tracking System

  1. New Tables
    - `time_entries` - Stores time tracking entries
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `task_name` (text, not null)
      - `description` (text, not null)
      - `start_time` (timestamptz, not null)
      - `end_time` (timestamptz, nullable)
      - `duration_minutes` (integer, nullable)
      - `billable` (boolean, default true)
      - `hourly_rate` (numeric(8,2), not null)
      - `created_at` (timestamptz, default now())
  
  2. Security
    - Enable RLS on `time_entries` table
    - Add policies for users to manage their own time entries
*/

-- Create time_entries table
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

-- Create policies
CREATE POLICY "Users can manage their own time entries" 
  ON time_entries 
  FOR ALL 
  TO authenticated 
  USING (user_id = auth.uid());

CREATE POLICY "Users can view their own time entries" 
  ON time_entries 
  FOR SELECT 
  TO authenticated 
  USING (user_id = auth.uid());

-- Create index for faster queries
CREATE INDEX idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX idx_time_entries_start_time ON time_entries(start_time);