const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const WorkspaceProcessor = require('./workspace-processor');
require('dotenv').config();

const app = express();
const PORT = process.env.WORKSPACE_PORT || 8002;

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

// Initialize workspace processor
const workspaceProcessor = new WorkspaceProcessor();

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

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

// Generate invite link for channel
app.post('/api/workspace/generate-invite', async (req, res) => {
  try {
    const { channelId, userId, expiresIn = '7d', maxUses = null } = req.body;
    
    if (!channelId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Channel ID and User ID are required'
      });
    }
    
    // Check if user is a member of the channel
    const { data: membership, error: memberError } = await supabase
      .from('channel_members')
      .select('role')
      .eq('channel_id', channelId)
      .eq('user_id', userId)
      .single();
    
    if (memberError || !membership) {
      return res.status(403).json({
        success: false,
        error: 'You are not a member of this channel'
      });
    }
    
    // Calculate expiration date
    const expiresAt = new Date();
    if (expiresIn === '1d') {
      expiresAt.setDate(expiresAt.getDate() + 1);
    } else if (expiresIn === '7d') {
      expiresAt.setDate(expiresAt.getDate() + 7);
    } else if (expiresIn === '30d') {
      expiresAt.setDate(expiresAt.getDate() + 30);
    } else {
      expiresAt.setDate(expiresAt.getDate() + 7); // Default to 7 days
    }
    
    // Create invite
    const { data: invite, error: inviteError } = await supabase
      .from('channel_invites')
      .insert({
        channel_id: channelId,
        created_by: userId,
        expires_at: expiresAt.toISOString(),
        max_uses: maxUses
      })
      .select()
      .single();
    
    if (inviteError) {
      console.error('Error creating invite:', inviteError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create invite'
      });
    }
    
    // Generate invite URL
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const inviteUrl = `${baseUrl}/workspace/invite/${invite.invite_code}`;
    
    res.json({
      success: true,
      invite: {
        id: invite.id,
        code: invite.invite_code,
        url: inviteUrl,
        expires_at: invite.expires_at,
        max_uses: invite.max_uses,
        current_uses: invite.current_uses
      }
    });
  } catch (error) {
    console.error('Error generating invite:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Join channel via invite code
app.post('/api/workspace/join-invite/:inviteCode', async (req, res) => {
  try {
    const { inviteCode } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    // Get invite details
    const { data: invite, error: inviteError } = await supabase
      .from('channel_invites')
      .select(`
        *,
        channel:channels(*)
      `)
      .eq('invite_code', inviteCode)
      .single();
    
    if (inviteError || !invite) {
      return res.status(404).json({
        success: false,
        error: 'Invalid or expired invite'
      });
    }
    
    // Check if invite is still valid
    const now = new Date();
    const expiresAt = new Date(invite.expires_at);
    
    if (expiresAt < now) {
      return res.status(400).json({
        success: false,
        error: 'Invite has expired'
      });
    }
    
    if (invite.max_uses && invite.current_uses >= invite.max_uses) {
      return res.status(400).json({
        success: false,
        error: 'Invite has reached maximum uses'
      });
    }
    
    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('channel_members')
      .select('id')
      .eq('channel_id', invite.channel_id)
      .eq('user_id', userId)
      .single();
    
    if (existingMember) {
      return res.json({
        success: true,
        message: 'You are already a member of this channel',
        channel: invite.channel
      });
    }
    
    // Add user to channel
    const { error: memberError } = await supabase
      .from('channel_members')
      .insert({
        channel_id: invite.channel_id,
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
    
    // Update invite usage count
    await supabase
      .from('channel_invites')
      .update({
        current_uses: invite.current_uses + 1
      })
      .eq('id', invite.id);
    
    res.json({
      success: true,
      message: 'Successfully joined channel',
      channel: invite.channel
    });
  } catch (error) {
    console.error('Error joining via invite:', error);
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

// Health check
app.get('/api/workspace/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'workspace-api',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Workspace API server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/workspace/health`);
});

module.exports = app;