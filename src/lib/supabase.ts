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
        async (payload) => {
          if (callbacks.onMessage) {
            // Fetch the complete message with sender info
            const { data } = await supabase
              .from('messages')
              .select(`
                *,
                sender:profiles(*)
              `)
              .eq('id', payload.new.id)
              .single();
            
            if (data) {
              callbacks.onMessage(data);
            }
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
        async (payload) => {
          if (callbacks.onTaskCreate) {
            // Fetch complete task with relations
            const { data } = await supabase
              .from('tasks')
              .select(`
                *,
                assignments:task_assignments(
                  user_id,
                  user:profiles(*)
                ),
                creator:profiles!tasks_created_by_fkey(*)
              `)
              .eq('id', payload.new.id)
              .single();
            
            if (data) {
              callbacks.onTaskCreate(data);
            }
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
        async (payload) => {
          if (callbacks.onTaskUpdate) {
            // Fetch complete task with relations
            const { data } = await supabase
              .from('tasks')
              .select(`
                *,
                assignments:task_assignments(
                  user_id,
                  user:profiles(*)
                ),
                creator:profiles!tasks_created_by_fkey(*)
              `)
              .eq('id', payload.new.id)
              .single();
            
            if (data) {
              callbacks.onTaskUpdate(data);
            }
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
    try {
      // First, get all channels the user is a member of
      const { data: memberChannels, error: memberError } = await supabase
        .from('channel_members')
        .select(`
          channel_id,
          channels!inner(*)
        `)
        .eq('user_id', userId);

      if (memberError) {
        console.error('Error fetching member channels:', memberError);
      }

      // Also get all public channels
      const { data: publicChannels, error: publicError } = await supabase
        .from('channels')
        .select('*')
        .eq('type', 'public');

      if (publicError) {
        console.error('Error fetching public channels:', publicError);
      }

      // Combine and deduplicate
      const allChannels = new Map();
      
      // Add member channels
      if (memberChannels) {
        memberChannels.forEach(mc => {
          if (mc.channels) {
            allChannels.set(mc.channels.id, mc.channels);
          }
        });
      }

      // Add public channels
      if (publicChannels) {
        publicChannels.forEach(pc => {
          allChannels.set(pc.id, pc);
        });
      }

      return Array.from(allChannels.values()).sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    } catch (error) {
      console.error('Error in getChannelsForUser:', error);
      return [];
    }
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
    // Use the database function for proper channel creation
    const { data, error } = await supabase.rpc('create_channel_with_membership', {
      channel_name: name,
      channel_description: description,
      channel_type: type,
      creator_id: createdBy
    });

    if (error) throw error;

    // Fetch the created channel
    const { data: channel, error: fetchError } = await supabase
      .from('channels')
      .select('*')
      .eq('id', data)
      .single();

    if (fetchError) throw fetchError;
    return channel;
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
    // Get tasks created by user
    const { data: createdTasks, error: createdError } = await supabase
      .from('tasks')
      .select(`
        *,
        assignments:task_assignments(
          user_id,
          user:profiles(*)
        ),
        creator:profiles!tasks_created_by_fkey(*)
      `)
      .eq('created_by', userId);

    // Get tasks assigned to user
    const { data: assignedTaskIds, error: assignedError } = await supabase
      .from('task_assignments')
      .select('task_id')
      .eq('user_id', userId);

    let assignedTasks = [];
    if (assignedTaskIds && assignedTaskIds.length > 0) {
      const taskIds = assignedTaskIds.map(a => a.task_id);
      const { data: assigned, error: assignedTasksError } = await supabase
        .from('tasks')
        .select(`
          *,
          assignments:task_assignments(
            user_id,
            user:profiles(*)
          ),
          creator:profiles!tasks_created_by_fkey(*)
        `)
        .in('id', taskIds);

      if (!assignedTasksError) {
        assignedTasks = assigned || [];
      }
    }

    // Combine and deduplicate
    const allTasks = new Map();
    
    if (createdTasks) {
      createdTasks.forEach(task => allTasks.set(task.id, task));
    }
    
    assignedTasks.forEach(task => allTasks.set(task.id, task));

    return Array.from(allTasks.values()).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
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