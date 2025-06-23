const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
const WorkspaceProcessor = require('./workspace-processor');
require('dotenv').config();

const app = express();
const PORT = process.env.AI_ASSISTANT_PORT || 8001;

// Initialize services
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);
const workspaceProcessor = new WorkspaceProcessor();

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Chat processing endpoint
app.post('/api/chat/process-message', async (req, res) => {
  try {
    const result = await workspaceProcessor.processMessage(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Agent processing endpoint
app.post('/api/chat/agent-process', async (req, res) => {
  try {
    const { message, userId, context } = req.body;
    
    // Simple agent logic for now
    const agent = {
      intent: 'general',
      response: `I understand you said: "${message}". I'm here to help with your workspace needs!`,
      actions: []
    };

    // Check for task-related keywords
    const taskKeywords = ['task', 'todo', 'assign', 'deadline', 'due'];
    if (taskKeywords.some(keyword => message.toLowerCase().includes(keyword))) {
      agent.intent = 'task_management';
      agent.response = 'I can help you create and manage tasks. Try mentioning someone with @ to assign tasks!';
    }

    res.json({ success: true, agent });
  } catch (error) {
    console.error('Error processing agent request:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'AI Assistant',
    timestamp: new Date().toISOString()
  });
});

// Test endpoint to create sample data
app.post('/api/test/create-sample-data', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    // Create a test channel
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .insert({
        name: 'test-channel',
        description: 'A test channel for development',
        type: 'public',
        created_by: userId
      })
      .select()
      .single();

    if (channelError) {
      console.error('Error creating channel:', channelError);
      return res.status(500).json({ error: 'Failed to create channel' });
    }

    // Add user to channel
    await supabase
      .from('channel_members')
      .insert({
        channel_id: channel.id,
        user_id: userId,
        role: 'admin'
      });

    // Create a test task
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        title: 'Test Task',
        description: 'This is a test task for development',
        priority: 'medium',
        created_by: userId
      })
      .select()
      .single();

    if (taskError) {
      console.error('Error creating task:', taskError);
    }

    res.json({ 
      success: true, 
      channel: channel,
      task: task
    });
  } catch (error) {
    console.error('Error creating sample data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`AI Assistant server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;