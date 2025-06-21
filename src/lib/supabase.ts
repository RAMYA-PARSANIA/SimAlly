import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for our custom auth system
export interface Profile {
  id: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  created_at: string;
  updated_at: string;
}

export interface Channel {
  id: string;
  name: string;
  description?: string;
  type: 'public' | 'private' | 'dm';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  type: 'text' | 'ai_task_creation' | 'ai_summary' | 'system';
  metadata: any;
  created_at: string;
  sender?: Profile;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;
  created_by: string;
  source_message_id?: string;
  created_at: string;
  updated_at: string;
  assignments?: TaskAssignment[];
}

export interface TaskAssignment {
  task_id: string;
  user_id: string;
  assigned_at: string;
  user?: Profile;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  user_id: string;
  task_id?: string;
  created_at: string;
}