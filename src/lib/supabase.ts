import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    headers: {
      'X-Client-Info': 'simally-webapp',
      'Origin': window.location.origin
    },
  },
});

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
  project_id?: string;
  estimated_hours?: number;
  actual_hours?: number;
  story_points?: number;
  tags?: string[];
  blocked_reason?: string;
  parent_task_id?: string;
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
  is_reminder?: boolean;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  start_date: string;
  end_date: string;
  budget: number;
  spent_budget: number;
  progress_percentage: number;
  project_manager_id: string;
  department_id: string;
  client_name?: string;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  head_id?: string;
  parent_department_id?: string;
  budget?: number;
  created_at: string;
  updated_at: string;
}

export interface TimeTracking {
  id: string;
  user_id: string;
  task_id?: string;
  project_id?: string;
  description: string;
  start_time: string;
  end_time?: string;
  duration_minutes?: number;
  billable: boolean;
  hourly_rate: number;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  category: 'general' | 'task' | 'project' | 'meeting' | 'system';
  read: boolean;
  action_url?: string;
  created_at: string;
}

export interface FileAttachment {
  id: string;
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  file_path: string;
  uploaded_by: string;
  task_id?: string;
  project_id?: string;
  message_id?: string;
  is_public: boolean;
  download_count: number;
  created_at: string;
}

export interface ProjectMilestone {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  due_date: string;
  completed_date?: string;
  status: 'pending' | 'completed' | 'overdue';
  created_by: string;
  created_at: string;
}

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  dependency_type: 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish';
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  parent_comment_id?: string;
  created_at: string;
  updated_at: string;
  user?: Profile;
}

export interface WorkspaceAnalytics {
  id: string;
  metric_name: string;
  metric_value: number;
  dimensions: any;
  date_recorded: string;
  created_at: string;
}

export interface MeetingRecording {
  id: string;
  meeting_room: string;
  title?: string;
  recording_url?: string;
  transcript?: string;
  duration_minutes?: number;
  participants?: string[];
  host_id?: string;
  summary?: string;
  action_items?: string[];
  created_at: string;
}

// Enhanced API functions for workspace functionality
export const workspaceAPI = {
  // Get channels for current user
  async getChannelsForUser(userId: string): Promise<Channel[]> {
    try {
      // Get channels where user is a member
      const { data: memberChannels, error: memberError } = await supabase
        .from('channels')
        .select(`
          *,
          channel_members!inner(user_id, role)
        `)
        .eq('channel_members.user_id', userId);

      if (memberError) {
        console.error('Error fetching member channels:', memberError);
        return [];
      }

      // Get public channels (user might not be a member yet)
      const { data: publicChannels, error: publicError } = await supabase
        .from('channels')
        .select('*')
        .eq('type', 'public');

      if (publicError) {
        console.error('Error fetching public channels:', publicError);
        return memberChannels || [];
      }

      // Combine and deduplicate
      const allChannels = [...(memberChannels || []), ...(publicChannels || [])];
      const uniqueChannels = allChannels.filter((channel, index, self) => 
        index === self.findIndex(c => c.id === channel.id)
      );

      return uniqueChannels;
    } catch (error) {
      console.error('Error in getChannelsForUser:', error);
      return [];
    }
  },

  // Get messages for a channel
  async getMessagesForChannel(channelId: string): Promise<Message[]> {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles(*)
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) {
        console.error('Error fetching messages:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getMessagesForChannel:', error);
      return [];
    }
  },

  // Get tasks for user (created by or assigned to)
  async getUserTasks(userId: string): Promise<Task[]> {
    try {
      // Get tasks created by user
      const { data: createdTasks, error: createdError } = await supabase
        .from('tasks')
        .select(`
          *,
          assignments:task_assignments(
            user_id,
            user:profiles(*)
          ),
          project:projects(name)
        `)
        .eq('created_by', userId);

      if (createdError) {
        console.error('Error fetching created tasks:', createdError);
      }

      // Get tasks assigned to user
      const { data: assignedTaskIds, error: assignedError } = await supabase
        .from('task_assignments')
        .select('task_id')
        .eq('user_id', userId);

      if (assignedError) {
        console.error('Error fetching assigned task IDs:', assignedError);
      }

      let assignedTasks: Task[] = [];
      if (assignedTaskIds && assignedTaskIds.length > 0) {
        const taskIds = assignedTaskIds.map(t => t.task_id);
        const { data: tasks, error: tasksError } = await supabase
          .from('tasks')
          .select(`
            *,
            assignments:task_assignments(
              user_id,
              user:profiles(*)
            ),
            project:projects(name)
          `)
          .in('id', taskIds);

        if (tasksError) {
          console.error('Error fetching assigned tasks:', tasksError);
        } else {
          assignedTasks = tasks || [];
        }
      }

      // Combine and deduplicate
      const allTasks = [...(createdTasks || []), ...assignedTasks];
      const uniqueTasks = allTasks.filter((task, index, self) => 
        index === self.findIndex(t => t.id === task.id)
      );

      return uniqueTasks.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } catch (error) {
      console.error('Error in getUserTasks:', error);
      return [];
    }
  },

  // Get projects for user
  async getUserProjects(userId: string): Promise<Project[]> {
    try {
      // Get projects where user is a member
      const { data: memberProjects, error: memberError } = await supabase
        .from('projects')
        .select(`
          *,
          project_members!inner(user_id, role),
          department:departments(name),
          project_manager:profiles!project_manager_id(full_name)
        `)
        .eq('project_members.user_id', userId);

      if (memberError) {
        console.error('Error fetching member projects:', memberError);
        return [];
      }

      return memberProjects || [];
    } catch (error) {
      console.error('Error in getUserProjects:', error);
      return [];
    }
  },

  // Get time tracking entries for user
  async getUserTimeTracking(userId: string, period?: string): Promise<TimeTracking[]> {
    try {
      let query = supabase
        .from('time_tracking')
        .select(`
          *,
          task:tasks(title),
          project:projects(name)
        `)
        .eq('user_id', userId)
        .order('start_time', { ascending: false });

      // Apply date filter
      if (period) {
        const now = new Date();
        let startDate;
        
        switch (period) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        }
        
        if (startDate) {
          query = query.gte('start_time', startDate.toISOString());
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching time tracking:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUserTimeTracking:', error);
      return [];
    }
  },

  // Get notifications for user
  async getUserNotifications(userId: string): Promise<Notification[]> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching notifications:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUserNotifications:', error);
      return [];
    }
  },

  // Subscribe to real-time updates
  subscribeToChannel(channelId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        callback
      )
      .subscribe();
  },

  subscribeToTasks(userId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`tasks:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
        },
        callback
      )
      .subscribe();
  },

  subscribeToChannels(userId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`channels:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channels',
        },
        callback
      )
      .subscribe();
  },

  subscribeToProjects(userId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`projects:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
        },
        callback
      )
      .subscribe();
  },

  subscribeToNotifications(userId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe();
  },

  subscribeToTimeTracking(userId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`time_tracking:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_tracking',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe();
  }
};