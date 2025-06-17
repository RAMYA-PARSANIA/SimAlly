const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Store active conversations per user session
const activeConversations = new Map();

// Tavus API configuration
const TAVUS_API_KEY = process.env.TAVUS_API_KEY;
const PERSONA_ID = process.env.PERSONA_ID;
const REPLICA_ID = process.env.REPLICA_ID;

// Create riddle conversation endpoint
app.post('/api/create-riddle-conversation', async (req, res) => {
  try {
    const { user_id } = req.body;
    const userId = user_id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const payload = {
      replica_id: REPLICA_ID,
      persona_id: PERSONA_ID,
      callback_url: "https://yourwebsite.com/webhook",
      conversation_name: "Game Buddy",
      conversational_context: "You are a playful and clever riddle master. Your job is to challenge the user with creative and tricky riddles. Encourage the user to guess, ask for hints, or skip if they're stuck. React in a fun and engaging way to each guess, making the experience lighthearted and enjoyable.",
      custom_greeting: "Welcome, challenger! Ready to test your wits with some riddles? Let's see if you can outsmart me!",
      properties: {
        max_call_duration: 3600,
        participant_left_timeout: 60,
        participant_absent_timeout: 300,
        enable_recording: true,
        enable_closed_captions: true,
        apply_greenscreen: true,
        language: "english",
        recording_s3_bucket_name: "conversation-recordings",
        recording_s3_bucket_region: "us-east-1",
        aws_assume_role_arn: ""
      }
    };

    const response = await fetch('https://tavusapi.com/v2/conversations', {
      method: 'POST',
      headers: {
        'x-api-key': TAVUS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('Tavus API response:', response.status, data);

    if (response.ok) {
      const conversationId = data.conversation_id;
      const conversationUrl = data.conversation_url;
      
      // Store conversation ID for this user
      activeConversations.set(userId, {
        conversation_id: conversationId,
        created_at: new Date().toISOString()
      });
      
      res.json({
        success: true,
        conversation_id: conversationId,
        conversation_url: conversationUrl,
        user_id: userId
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to create conversation',
        details: data
      });
    }
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// End conversation endpoint
app.post('/api/end-conversation', async (req, res) => {
  try {
    const { user_id } = req.body;
    
    if (!user_id || !activeConversations.has(user_id)) {
      return res.status(404).json({
        success: false,
        error: 'No active conversation found for user'
      });
    }
    
    const conversationData = activeConversations.get(user_id);
    const conversationId = conversationData.conversation_id;
    
    const headers = {
      'x-api-key': TAVUS_API_KEY,
      'Content-Type': 'application/json'
    };
    
    // End the conversation
    console.log('Ending conversation:', conversationId);
    const endResponse = await fetch(`https://tavusapi.com/v2/conversations/${conversationId}/end`, {
      method: 'POST',
      headers
    });
    
    // Delete the conversation
    console.log('Deleting conversation:', conversationId);
    const deleteResponse = await fetch(`https://tavusapi.com/v2/conversations/${conversationId}`, {
      method: 'DELETE',
      headers
    });
    
    // Remove from active conversations
    activeConversations.delete(user_id);
    
    res.json({
      success: true,
      message: 'Conversation ended and deleted successfully'
    });
    
  } catch (error) {
    console.error('Error ending conversation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    active_conversations: activeConversations.size,
    framework: 'Express.js'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'SimAlly Game Backend API',
    framework: 'Express.js'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});