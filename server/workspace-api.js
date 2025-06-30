const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const WorkspaceProcessor = require('./workspace-processor');
require('dotenv').config();

const app = express();
const PORT = process.env.WORKSPACE_PORT || 8000;

// Environment variables
const VITE_APP_URL = process.env.VITE_APP_URL;
const VITE_API_URL = process.env.VITE_API_URL;
const VITE_AI_API_URL = process.env.VITE_AI_API_URL;
const VITE_MEDIA_API_URL = process.env.VITE_MEDIA_API_URL;
const VITE_WORKSPACE_API_URL = process.env.VITE_WORKSPACE_API_URL;
const FRONTEND_URL = process.env.FRONTEND_URL;

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

// Initialize workspace processor
const workspaceProcessor = new WorkspaceProcessor();

// Enhanced CORS configuration for production
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      VITE_API_URL,
      VITE_AI_API_URL,
      VITE_MEDIA_API_URL,
      'https://simally.vercel.app',
      VITE_WORKSPACE_API_URL,
      FRONTEND_URL,
      VITE_APP_URL
    ].filter(Boolean); // Remove any undefined values
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      //console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // 24 hours
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Additional middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add security headers
app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Process message for task detection
app.post('/api/workspace/process-message', async (req, res) => {
  try {
    const { message, messageId, channelId, senderId, mentions, userId } = req.body;
    
    const result = await workspaceProcessor.processMessage({
      message,
      messageId,
      channelId,
      senderId,
      mentions,
      userId
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate channel summary
app.post('/api/workspace/summarize-channel', async (req, res) => {
  try {
    const { channelId, userId, timeframe = '24h' } = req.body;
    
    if (!channelId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Channel ID and User ID are required'
      });
    }
    
    const result = await workspaceProcessor.generateChannelSummary(channelId, timeframe);
    res.json(result);
  } catch (error) {
    console.error('Error generating channel summary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create channel with password support
app.post('/api/workspace/channels', async (req, res) => {
  try {
    const { name, description, type, password, userId } = req.body;
    
    if (!name || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Channel name and User ID are required'
      });
    }
    
    // Create channel
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        type: type || 'public',
        created_by: userId,
        metadata: type === 'private' && password ? { password } : {}
      })
      .select()
      .single();
    
    if (channelError) {
      console.error('Error creating channel:', channelError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create channel'
      });
    }
    
    // Add creator as admin member
    const { error: memberError } = await supabase
      .from('channel_members')
      .insert({
        channel_id: channel.id,
        user_id: userId,
        role: 'admin'
      });
    
    if (memberError) {
      console.error('Error adding creator as member:', memberError);
    }
    
    res.json({
      success: true,
      channel
    });
  } catch (error) {
    console.error('Error creating channel:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Join channel with password support
app.post('/api/workspace/channels/:channelId/join', async (req, res) => {
  try {
    const { channelId } = req.params;
    const { userId, password } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    // Get channel details
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('*')
      .eq('id', channelId)
      .single();
    
    if (channelError || !channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }
    
    // Check password for private channels
    if (channel.type === 'private') {
      const channelPassword = channel.metadata?.password;
      if (!channelPassword || channelPassword !== password) {
        return res.status(401).json({
          success: false,
          error: 'Invalid password'
        });
      }
    }
    
    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('channel_members')
      .select('id')
      .eq('channel_id', channelId)
      .eq('user_id', userId)
      .single();
    
    if (existingMember) {
      return res.json({
        success: true,
        message: 'You are already a member of this channel'
      });
    }
    
    // Add user to channel
    const { error: memberError } = await supabase
      .from('channel_members')
      .insert({
        channel_id: channelId,
        user_id: userId,
        role: 'member'
      });
    
    if (memberError) {
      console.error('Error adding member:', memberError);
      return res.status(500).json({
        success: false,
        error: 'Failed to join channel'
      });
    }
    
    res.json({
      success: true,
      message: 'Successfully joined channel'
    });
  } catch (error) {
    console.error('Error joining channel:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Leave channel
app.post('/api/workspace/channels/:channelId/leave', async (req, res) => {
  try {
    const { channelId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    // Check if it's the general channel
    const { data: channel } = await supabase
      .from('channels')
      .select('name')
      .eq('id', channelId)
      .single();
    
    if (channel?.name === 'general') {
      return res.status(400).json({
        success: false,
        error: 'Cannot leave the general channel'
      });
    }
    
    // Remove user from channel
    const { error } = await supabase
      .from('channel_members')
      .delete()
      .eq('channel_id', channelId)
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error leaving channel:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to leave channel'
      });
    }
    
    res.json({
      success: true,
      message: 'Successfully left channel'
    });
  } catch (error) {
    console.error('Error leaving channel:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete channel
app.delete('/api/workspace/channels/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    // Check if user is the creator of the channel
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('created_by, name')
      .eq('id', channelId)
      .single();
    
    if (channelError || !channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }
    
    if (channel.created_by !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only the channel creator can delete this channel'
      });
    }
    
    if (channel.name === 'general') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete the general channel'
      });
    }
    
    // Delete the channel (cascading deletes will handle related data)
    const { error: deleteError } = await supabase
      .from('channels')
      .delete()
      .eq('id', channelId);
    
    if (deleteError) {
      console.error('Error deleting channel:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete channel'
      });
    }
    
    res.json({
      success: true,
      message: 'Channel deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting channel:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete message
app.delete('/api/workspace/messages/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    // Check if user is the sender of the message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('sender_id')
      .eq('id', messageId)
      .single();
    
    if (messageError || !message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }
    
    if (message.sender_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You can only delete your own messages'
      });
    }
    
    // Delete the message
    const { error: deleteError } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId);
    
    if (deleteError) {
      console.error('Error deleting message:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete message'
      });
    }
    
    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Edit message
app.put('/api/workspace/messages/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId, content } = req.body;
    
    if (!userId || !content) {
      return res.status(400).json({
        success: false,
        error: 'User ID and content are required'
      });
    }
    
    // Check if user is the sender of the message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('sender_id, content')
      .eq('id', messageId)
      .single();
    
    if (messageError || !message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }
    
    if (message.sender_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You can only edit your own messages'
      });
    }
    
    // Update the message
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        content: content.trim(),
        edited_at: new Date().toISOString(),
        original_content: message.content
      })
      .eq('id', messageId);
    
    if (updateError) {
      console.error('Error updating message:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to update message'
      });
    }
    
    res.json({
      success: true,
      message: 'Message updated successfully'
    });
  } catch (error) {
    console.error('Error editing message:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete task
app.delete('/api/workspace/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    // Check if user is the creator of the task
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('created_by')
      .eq('id', taskId)
      .single();
    
    if (taskError || !task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }
    
    if (task.created_by !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only the task creator can delete this task'
      });
    }
    
    // Delete the task (cascading deletes will handle assignments)
    const { error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);
    
    if (deleteError) {
      console.error('Error deleting task:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete task'
      });
    }
    
    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get channels with membership info
app.get('/api/workspace/channels/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get all channels with membership information
    const { data: channels, error } = await supabase
      .from('channels')
      .select(`
        *,
        channel_members!left(user_id, role)
      `)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching channels:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch channels'
      });
    }
    
    // Add membership info to each channel
    const channelsWithMembership = channels.map(channel => ({
      ...channel,
      is_member: channel.channel_members.some(member => member.user_id === userId)
    }));
    
    res.json({
      success: true,
      channels: channelsWithMembership
    });
  } catch (error) {
    console.error('Error getting channels:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get projects
app.get('/api/workspace/projects', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        department:departments(name),
        project_manager:profiles!project_manager_id(full_name),
        tasks(id, status),
        milestones:project_milestones(id, status)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching projects:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch projects'
      });
    }

    res.json({
      success: true,
      projects: data || []
    });
  } catch (error) {
    console.error('Error getting projects:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create project
app.post('/api/workspace/projects', async (req, res) => {
  try {
    const { name, description, status, priority, start_date, end_date, budget, department_id, project_manager_id, client_name } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Project name is required'
      });
    }
    
    const { data, error } = await supabase
      .from('projects')
      .insert({
        name,
        description,
        status: status || 'planning',
        priority: priority || 'medium',
        start_date,
        end_date,
        budget,
        department_id,
        project_manager_id,
        client_name
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating project:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create project'
      });
    }
    
    res.json({
      success: true,
      project: data
    });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get time tracking entries
app.get('/api/workspace/time-tracking/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { period } = req.query;
    
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
      console.error('Error fetching time entries:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch time entries'
      });
    }
    
    res.json({
      success: true,
      timeEntries: data || []
    });
  } catch (error) {
    console.error('Error getting time entries:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start time tracking
app.post('/api/workspace/time-tracking/start', async (req, res) => {
  try {
    const { userId, taskId, projectId, description, billable, hourlyRate } = req.body;
    
    if (!userId || !description) {
      return res.status(400).json({
        success: false,
        error: 'User ID and description are required'
      });
    }
    
    // Check if there's already an active timer
    const { data: existingTimer } = await supabase
      .from('time_tracking')
      .select('id')
      .eq('user_id', userId)
      .is('end_time', null)
      .single();
    
    if (existingTimer) {
      return res.status(400).json({
        success: false,
        error: 'You already have an active timer'
      });
    }
    
    const { data, error } = await supabase
      .from('time_tracking')
      .insert({
        user_id: userId,
        task_id: taskId || null,
        project_id: projectId || null,
        description,
        start_time: new Date().toISOString(),
        billable: billable !== undefined ? billable : true,
        hourly_rate: hourlyRate || 75
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error starting timer:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to start timer'
      });
    }
    
    res.json({
      success: true,
      timer: data
    });
  } catch (error) {
    console.error('Error starting timer:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Stop time tracking
app.post('/api/workspace/time-tracking/stop', async (req, res) => {
  try {
    const { userId, timerId } = req.body;
    
    if (!userId || !timerId) {
      return res.status(400).json({
        success: false,
        error: 'User ID and timer ID are required'
      });
    }
    
    // Get the timer
    const { data: timer, error: timerError } = await supabase
      .from('time_tracking')
      .select('*')
      .eq('id', timerId)
      .eq('user_id', userId)
      .single();
    
    if (timerError || !timer) {
      return res.status(404).json({
        success: false,
        error: 'Timer not found'
      });
    }
    
    if (timer.end_time) {
      return res.status(400).json({
        success: false,
        error: 'Timer is already stopped'
      });
    }
    
    const endTime = new Date();
    const startTime = new Date(timer.start_time);
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    
    const { data, error } = await supabase
      .from('time_tracking')
      .update({
        end_time: endTime.toISOString(),
        duration_minutes: durationMinutes
      })
      .eq('id', timerId)
      .select()
      .single();
    
    if (error) {
      console.error('Error stopping timer:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to stop timer'
      });
    }
    
    res.json({
      success: true,
      timer: data
    });
  } catch (error) {
    console.error('Error stopping timer:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get analytics
app.get('/api/workspace/analytics', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('workspace_analytics')
      .select('*')
      .order('date_recorded', { ascending: false });
    
    if (error) {
      console.error('Error fetching analytics:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch analytics'
      });
    }
    
    res.json({
      success: true,
      analytics: data || []
    });
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get departments
app.get('/api/workspace/departments', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error fetching departments:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch departments'
      });
    }
    
    res.json({
      success: true,
      departments: data || []
    });
  } catch (error) {
    console.error('Error getting departments:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get notifications
app.get('/api/workspace/notifications/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching notifications:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch notifications'
      });
    }
    
    res.json({
      success: true,
      notifications: data || []
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Mark notification as read
app.put('/api/workspace/notifications/:notificationId/read', async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error) {
      console.error('Error marking notification as read:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to mark notification as read'
      });
    }
    
    res.json({
      success: true,
      notification: data
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check
app.get('/api/workspace/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'workspace-api',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'SimAlly Workspace API',
    version: '1.0.0'
  });
});

app.listen(PORT, () => {
  //console.log(`Workspace API server running on http://localhost:${PORT}`);
  //console.log(`Health check: http://localhost:${PORT}/api/workspace/health`);
  //console.log(`CORS configured for: ${FRONTEND_URL}`);
});

module.exports = app;
