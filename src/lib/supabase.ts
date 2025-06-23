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
  member_count?: number;
  unread_count?: number;
}

export interface ChannelMember {
  channel_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  user?: Profile;
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
  mentions?: string[];
  edited_at?: string;
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
  creator?: Profile;
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
  task?: Task;
}

// Real-time subscription helpers
export class RealtimeManager {
  private subscriptions: Map<string, any> = new Map();

  subscribeToChannel(channelId: string, callbacks: {
    onMessage?: (message: Message) => void;
    onMemberJoin?: (member: ChannelMember) => void;
    onMemberLeave?: (member: ChannelMember) => void;
  }) {
    const subscription = supabase
      .channel(`channel:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          if (callbacks.onMessage) {
            callbacks.onMessage(payload.new as Message);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'channel_members',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          if (callbacks.onMemberJoin) {
            callbacks.onMemberJoin(payload.new as ChannelMember);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'channel_members',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          if (callbacks.onMemberLeave) {
            callbacks.onMemberLeave(payload.old as ChannelMember);
          }
        }
      )
      .subscribe();

    this.subscriptions.set(`channel:${channelId}`, subscription);
    return subscription;
  }

  subscribeToTasks(userId: string, callbacks: {
    onTaskCreate?: (task: Task) => void;
    onTaskUpdate?: (task: Task) => void;
    onTaskAssign?: (assignment: TaskAssignment) => void;
  }) {
    const subscription = supabase
      .channel(`tasks:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tasks',
        },
        (payload) => {
          if (callbacks.onTaskCreate) {
            callbacks.onTaskCreate(payload.new as Task);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
        },
        (payload) => {
          if (callbacks.onTaskUpdate) {
            callbacks.onTaskUpdate(payload.new as Task);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_assignments',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (callbacks.onTaskAssign) {
            callbacks.onTaskAssign(payload.new as TaskAssignment);
          }
        }
      )
      .subscribe();

    this.subscriptions.set(`tasks:${userId}`, subscription);
    return subscription;
  }

  subscribeToUserChannels(userId: string, callbacks: {
    onChannelCreate?: (channel: Channel) => void;
    onChannelUpdate?: (channel: Channel) => void;
  }) {
    const subscription = supabase
      .channel(`user_channels:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'channels',
        },
        (payload) => {
          if (callbacks.onChannelCreate) {
            callbacks.onChannelCreate(payload.new as Channel);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'channels',
        },
        (payload) => {
          if (callbacks.onChannelUpdate) {
            callbacks.onChannelUpdate(payload.new as Channel);
          }
        }
      )
      .subscribe();

    this.subscriptions.set(`user_channels:${userId}`, subscription);
    return subscription;
  }

  unsubscribe(key: string) {
    const subscription = this.subscriptions.get(key);
    if (subscription) {
      supabase.removeChannel(subscription);
      this.subscriptions.delete(key);
    }
  }

  unsubscribeAll() {
    this.subscriptions.forEach((subscription, key) => {
      supabase.removeChannel(subscription);
    });
    this.subscriptions.clear();
  }
}

// Workspace API helpers
export class WorkspaceAPI {
  static async getChannelsForUser(userId: string): Promise<Channel[]> {
    const { data, error } = await supabase
      .from('channels')
      .select(`
        *,
        channel_members!inner(user_id, role),
        member_count:channel_members(count)
      `)
      .eq('channel_members.user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  static async getChannelMessages(channelId: string, limit = 50): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles(*)
      `)
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  static async sendMessage(channelId: string, senderId: string, content: string, type: Message['type'] = 'text', metadata: any = {}): Promise<Message> {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        channel_id: channelId,
        sender_id: senderId,
        content,
        type,
        metadata
      })
      .select(`
        *,
        sender:profiles(*)
      `)
      .single();

    if (error) throw error;
    return data;
  }

  static async createChannel(name: string, description: string, type: Channel['type'], createdBy: string): Promise<Channel> {
    const { data, error } = await supabase
      .from('channels')
      .insert({
        name,
        description,
        type,
        created_by: createdBy
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async joinChannel(channelId: string, userId: string, role: ChannelMember['role'] = 'member'): Promise<ChannelMember> {
    const { data, error } = await supabase
      .from('channel_members')
      .insert({
        channel_id: channelId,
        user_id: userId,
        role
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getChannelMembers(channelId: string): Promise<ChannelMember[]> {
    const { data, error } = await supabase
      .from('channel_members')
      .select(`
        *,
        user:profiles(*)
      `)
      .eq('channel_id', channelId)
      .order('joined_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  static async getUserTasks(userId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        assignments:task_assignments(
          user_id,
          user:profiles(*)
        ),
        creator:profiles!tasks_created_by_fkey(*)
      `)
      .or(`created_by.eq.${userId},id.in.(${await this.getUserAssignedTaskIds(userId)})`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  private static async getUserAssignedTaskIds(userId: string): Promise<string> {
    const { data } = await supabase
      .from('task_assignments')
      .select('task_id')
      .eq('user_id', userId);
    
    return data?.map(t => t.task_id).join(',') || '';
  }

  static async createTask(title: string, description: string, priority: Task['priority'], dueDate: string | null, createdBy: string, sourceMessageId?: string): Promise<Task> {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title,
        description,
        priority,
        due_date: dueDate,
        created_by: createdBy,
        source_message_id: sourceMessageId
      })
      .select(`
        *,
        assignments:task_assignments(
          user_id,
          user:profiles(*)
        ),
        creator:profiles!tasks_created_by_fkey(*)
      `)
      .single();

    if (error) throw error;
    return data;
  }

  static async updateTaskStatus(taskId: string, status: Task['status']): Promise<Task> {
    const { data, error } = await supabase
      .from('tasks')
      .update({ status })
      .eq('id', taskId)
      .select(`
        *,
        assignments:task_assignments(
          user_id,
          user:profiles(*)
        ),
        creator:profiles!tasks_created_by_fkey(*)
      `)
      .single();

    if (error) throw error;
    return data;
  }

  static async assignTask(taskId: string, userId: string): Promise<TaskAssignment> {
    const { data, error } = await supabase
      .from('task_assignments')
      .insert({
        task_id: taskId,
        user_id: userId
      })
      .select(`
        *,
        user:profiles(*)
      `)
      .single();

    if (error) throw error;
    return data;
  }

  static async createCalendarEvent(title: string, description: string, startTime: string, endTime: string, userId: string, taskId?: string): Promise<CalendarEvent> {
    const { data, error } = await supabase
      .from('calendar_events')
      .insert({
        title,
        description,
        start_time: startTime,
        end_time: endTime,
        user_id: userId,
        task_id: taskId
      })
      .select(`
        *,
        task:tasks(*)
      `)
      .single();

    if (error) throw error;
    return data;
  }

  static async getUserCalendarEvents(userId: string, startDate: string, endDate: string): Promise<CalendarEvent[]> {
    const { data, error } = await supabase
      .from('calendar_events')
      .select(`
        *,
        task:tasks(*)
      `)
      .eq('user_id', userId)
      .gte('start_time', startDate)
      .lte('start_time', endDate)
      .order('start_time', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  static async searchUsers(query: string): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
      .limit(10);

    if (error) throw error;
    return data || [];
  }
}