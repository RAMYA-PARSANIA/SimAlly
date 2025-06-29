const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

// Environment variables
const VITE_APP_URL = process.env.VITE_APP_URL;
const VITE_API_URL = process.env.VITE_API_URL;
const VITE_AI_API_URL = process.env.VITE_AI_API_URL;
const VITE_MEDIA_API_URL = process.env.VITE_MEDIA_API_URL;
const VITE_WORKSPACE_API_URL = process.env.VITE_WORKSPACE_API_URL;
const FRONTEND_URL = process.env.FRONTEND_URL;

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
      VITE_APP_URL,
      'http://localhost:5173'
    ].filter(Boolean); // Remove any undefined values
    
    if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://localhost')) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
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
app.use(cookieParser());

// Add security headers
app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Store active conversations per user session
const activeConversations = new Map();

// Tavus API configuration
const TAVUS_API_KEY = process.env.TAVUS_API_KEY;

// Game configurations
const GAME_CONFIGS = {
  riddle: {
    persona_id: process.env.RIDDLE_PERSONA_ID,
    replica_id: process.env.RIDDLE_REPLICA_ID,
    conversation_name: "Riddle Master",
    conversational_context: "You are a playful and clever riddle master. Your job is to challenge the user with creative and tricky riddles. Encourage the user to guess, ask for hints, or skip if they're stuck. React in a fun and engaging way to each guess, making the experience lighthearted and enjoyable.",
    custom_greeting: "Welcome, challenger! Ready to test your wits with some riddles? Let's see if you can outsmart me!"
  },
  twentyQuestionsUserAsks: {
    persona_id: process.env.TWENTY_Q_USER_ASKS_PERSONA_ID,
    replica_id: process.env.TWENTY_Q_USER_ASKS_REPLICA_ID,
    conversation_name: "Mystery Keeper",
    conversational_context: "You are the Mystery Keeper in a 20 Questions game. You have thought of something (person, place, or thing) and the user will ask you yes/no questions to guess what it is. You can only answer with 'Yes', 'No', 'Sometimes', or 'I don't know'. Keep track of the question count and let them know when they reach 20 questions. Be encouraging and give hints if they're struggling. Reveal the answer if they guess correctly or run out of questions.",
    custom_greeting: "I'm thinking of something... You have 20 yes-or-no questions to figure out what it is. Ready to start guessing?"
  },
  twentyQuestionsAiAsks: {
    persona_id: process.env.TWENTY_Q_AI_ASKS_PERSONA_ID,
    replica_id: process.env.TWENTY_Q_AI_ASKS_REPLICA_ID,
    conversation_name: "Mind Reader",
    conversational_context: "You are the Mind Reader in a 20 Questions game. The user is thinking of something (person, place, or thing) and you will ask them yes/no questions to guess what it is. Ask strategic questions to narrow down the possibilities. Keep track of your question count and try to guess within 20 questions. Be clever with your questioning strategy and make educated guesses based on their answers.",
    custom_greeting: "Think of any person, place, or thing - I'll try to read your mind! I have 20 yes-or-no questions to figure out what you're thinking. Let's see if I can guess it!"
  },
  mentalHealth: {
    persona_id: process.env.MENTAL_HEALTH_PERSONA_ID,
    replica_id: process.env.MENTAL_HEALTH_REPLICA_ID,
    conversation_name: "Mental Health Professional",
    conversational_context: "You are a compassionate mental health professional. Your role is to provide emotional support, guidance, and coping strategies for common mental health concerns. You should be empathetic, patient, and non-judgmental. Remember to emphasize that you're an AI and not a replacement for a licensed therapist. For serious concerns, encourage seeking professional help. Focus on active listening, validation, and providing evidence-based suggestions for managing stress, anxiety, depression, and other common challenges.",
    custom_greeting: "Hello, I'm here to provide support and guidance for your emotional and mental wellbeing. While I'm not a replacement for a licensed therapist, I can offer a safe space to discuss your concerns and share helpful strategies. How are you feeling today?"
  },
  legalAdvice: {
    persona_id: process.env.LEGAL_ADVICE_PERSONA_ID,
    replica_id: process.env.LEGAL_ADVICE_REPLICA_ID,
    conversation_name: "Legal Advisor",
    conversational_context: "You are a knowledgeable legal advisor specializing in business law. Your role is to provide general legal information and guidance on common business legal matters. You should be clear, precise, and professional. Always emphasize that you're providing general information, not legal advice, and that for specific legal matters, they should consult with a licensed attorney in their jurisdiction. Focus on explaining legal concepts, outlining potential options, and helping users understand basic legal frameworks for business operations, contracts, intellectual property, and compliance issues.",
    custom_greeting: "Welcome. I'm here to provide general legal information for your business questions. While I can help explain legal concepts and outline potential considerations, please remember I'm not providing legal advice, and for specific matters, you should consult with a licensed attorney in your jurisdiction. How can I assist with your business legal questions today?"
  }
};

// Import Google API routes
const { router: googleApiRoutes } = require('./google-api');
app.use('/api/google', googleApiRoutes);

// Import Google Docs/Slides API routes
const { router: googleDocsRoutes } = require('./google-docs-api');
app.use('/api/google/docs', googleDocsRoutes);

// Generic conversation creation endpoint
const createConversation = async (gameType, userId) => {
  const config = GAME_CONFIGS[gameType];
  if (!config) {
    throw new Error('Invalid game type');
  }

  const payload = {
    replica_id: config.replica_id,
    persona_id: config.persona_id,
    callback_url: "https://yourwebsite.com/webhook",
    conversation_name: config.conversation_name,
    conversational_context: config.conversational_context,
    custom_greeting: config.custom_greeting,
    properties: {
      max_call_duration: 3600,
      participant_left_timeout: 60,
      participant_absent_timeout: 300,
      enable_recording: true,
      enable_closed_captions: true,
      apply_greenscreen: false,
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
  console.log(`Tavus API response for ${gameType}:`, response.status, data);

  if (response.ok) {
    const conversationId = data.conversation_id;
    const conversationUrl = data.conversation_url;
    
    // Store conversation ID for this user
    activeConversations.set(userId, {
      conversation_id: conversationId,
      game_type: gameType,
      created_at: new Date().toISOString()
    });
    
    return {
      success: true,
      conversation_id: conversationId,
      conversation_url: conversationUrl,
      user_id: userId,
      game_type: gameType
    };
  } else {
    throw new Error(data.error || 'Failed to create conversation');
  }
};

// Create riddle conversation endpoint
app.post('/api/create-riddle-conversation', async (req, res) => {
  try {
    const { user_id } = req.body;
    const userId = user_id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const result = await createConversation('riddle', userId);
    res.json(result);
  } catch (error) {
    console.error('Error creating riddle conversation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create 20 Questions conversation endpoint (User asks questions)
app.post('/api/create-twenty-questions-user-asks', async (req, res) => {
  try {
    const { user_id } = req.body;
    const userId = user_id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const result = await createConversation('twentyQuestionsUserAsks', userId);
    res.json(result);
  } catch (error) {
    console.error('Error creating 20 questions (user asks) conversation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create 20 Questions conversation endpoint (AI asks questions)
app.post('/api/create-twenty-questions-ai-asks', async (req, res) => {
  try {
    const { user_id } = req.body;
    const userId = user_id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const result = await createConversation('twentyQuestionsAiAsks', userId);
    res.json(result);
  } catch (error) {
    console.error('Error creating 20 questions (AI asks) conversation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create Mental Health Support conversation endpoint
app.post('/api/create-mental-health-conversation', async (req, res) => {
  try {
    const { user_id } = req.body;
    const userId = user_id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const result = await createConversation('mentalHealth', userId);
    res.json(result);
  } catch (error) {
    console.error('Error creating mental health conversation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create Legal Advice conversation endpoint
app.post('/api/create-legal-advice-conversation', async (req, res) => {
  try {
    const { user_id } = req.body;
    const userId = user_id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const result = await createConversation('legalAdvice', userId);
    res.json(result);
  } catch (error) {
    console.error('Error creating legal advice conversation:', error);
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
  console.log(`CORS configured for: ${FRONTEND_URL}`);
});