const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.AI_ASSISTANT_PORT || 8001;

// Environment variables
const VITE_APP_URL = process.env.VITE_APP_URL;
const VITE_API_URL = process.env.VITE_API_URL;
const VITE_AI_API_URL = process.env.VITE_AI_API_URL;
const VITE_MEDIA_API_URL = process.env.VITE_MEDIA_API_URL;
const VITE_WORKSPACE_API_URL = process.env.VITE_WORKSPACE_API_URL;
const FRONTEND_URL = process.env.FRONTEND_URL;

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

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
    
    if (allowedOrigins.indexOf(origin) !== -1) {
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

// Store active AI sessions
const aiSessions = new Map();

// Initialize AI session
app.post('/api/init-session', async (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'User ID is required'
    });
  }
  
  try {
    // Generate a unique session ID
    const sessionId = `${userId}_${Date.now()}`;
    
    // Store session
    aiSessions.set(sessionId, {
      userId,
      createdAt: new Date(),
      lastActivity: new Date(),
      history: []
    });
    
    res.json({
      success: true,
      sessionId
    });
  } catch (error) {
    console.error('Error initializing AI session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize AI session'
    });
  }
});

// Process general chat message
app.post('/api/chat/general', async (req, res) => {
  const { message, userId } = req.body;
  
  if (!message || !userId) {
    return res.status(400).json({
      success: false,
      error: 'Message and user ID are required'
    });
  }
  
  try {
    // Get user info
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    const userName = userProfile?.full_name || 'User';
    
    // Process with Gemini
    const prompt = `
      You are SimAlly, a helpful AI assistant. You're chatting with ${userName}.
      
      User's message: "${message}"
      
      Provide a helpful, friendly, and concise response. Focus on answering the question or providing information directly.
      Keep your response under 200 words unless more detail is necessary.
    `;
    
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    res.json({
      success: true,
      response
    });
  } catch (error) {
    console.error('Error processing general chat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process message'
    });
  }
});

// Process agent message with intent detection
app.post('/api/chat/agent-process', async (req, res) => {
  const { message, userId, context = {} } = req.body;
  
  if (!message || !userId) {
    return res.status(400).json({
      success: false,
      error: 'Message and user ID are required'
    });
  }
  
  try {
    console.log('Processing message:', message, 'for user:', userId);
    
    // Get user info
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    const userName = userProfile?.full_name || 'User';
    
    // Detect intent with Gemini
    const intentPrompt = `
      You are an intent classifier for SimAlly, an AI assistant with Gmail integration capabilities.
      
      User message: "${message}"
      
      Context information:
      - Gmail connected: ${context.gmailConnected ? 'Yes' : 'No'}
      
      Analyze the user's message and determine the most appropriate action.
      
      If the message is about emails (showing, searching, managing emails) AND Gmail is connected, classify as "endpoint_call" with endpoint "gmail_get_emails", "gmail_search_emails", etc.
      
      If the message is about creating a meeting room, classify as "endpoint_call" with endpoint "create_meeting_room".
      
      If the message is about starting a game (riddle, 20 questions), classify as "endpoint_call" with endpoint "start_game_riddle" or "start_game_twenty_questions".
      
      If the message is about creating a task, classify as "endpoint_call" with endpoint "create_task".
      
      If the message is a general question or conversation, classify as "general_chat".
      
      Respond with a JSON object containing:
      {
        "intent": "endpoint_call" or "general_chat",
        "endpoint": "endpoint_name" (only if intent is endpoint_call),
        "parameters": {} (any parameters needed for the endpoint),
        "confidence": 0.0-1.0 (how confident you are in this classification)
      }
      
      Only respond with valid JSON.
    `;
    
    const intentResult = await model.generateContent(intentPrompt);
    const intentResponse = intentResult.response.text();
    
    let intentData;
    try {
      intentData = JSON.parse(intentResponse);
    } catch (parseError) {
      console.error('Failed to parse intent response:', intentResponse);
      intentData = { intent: "general_chat", confidence: 0.5 };
    }
    
    // Process based on intent
    if (intentData.intent === 'endpoint_call' && intentData.confidence > 0.7) {
      // Handle endpoint calls
      const endpoint = intentData.endpoint;
      const parameters = intentData.parameters || {};
      
      // Add userId to parameters
      parameters.userId = userId;
      
      let response, result;
      
      switch (endpoint) {
        case 'gmail_get_emails':
          response = "I'll show your emails. Please wait while I fetch them.";
          result = { endpoint: 'gmail_get_emails', parameters };
          break;
          
        case 'gmail_search_emails':
          response = `Searching your emails for "${parameters.query || 'recent emails'}". Please wait while I fetch the results.`;
          result = { endpoint: 'gmail_search_emails', parameters };
          break;
          
        case 'create_meeting_room':
          response = "I'm creating a meeting room for you. Please wait a moment.";
          result = { endpoint: 'create_meeting_room', parameters };
          break;
          
        case 'start_game_riddle':
          response = "Let's play a riddle game! I'm setting up the game for you.";
          result = { endpoint: 'start_game_riddle', parameters };
          break;
          
        case 'start_game_twenty_questions':
          response = "Let's play 20 Questions! I'm setting up the game for you.";
          result = { endpoint: 'start_game_twenty_questions', parameters };
          break;
          
        case 'create_task':
          response = "I'll create a task for you. Please wait while I process this.";
          result = { endpoint: 'create_task', parameters };
          break;
          
        default:
          // Fall back to general chat for unknown endpoints
          const generalPrompt = `
            You are SimAlly, a helpful AI assistant. You're chatting with ${userName}.
            
            User's message: "${message}"
            
            Provide a helpful, friendly, and concise response. Focus on answering the question or providing information directly.
            Keep your response under 200 words unless more detail is necessary.
          `;
          
          const generalResult = await model.generateContent(generalPrompt);
          response = generalResult.response.text();
          result = null;
      }
      
      res.json({
        success: true,
        agent: {
          intent: intentData.intent,
          endpoint: endpoint,
          response: response,
          result: result
        }
      });
    } else {
      // Handle general chat
      const generalPrompt = `
        You are SimAlly, a helpful AI assistant. You're chatting with ${userName}.
        
        User's message: "${message}"
        
        Provide a helpful, friendly, and concise response. Focus on answering the question or providing information directly.
        Keep your response under 200 words unless more detail is necessary.
      `;
      
      const generalResult = await model.generateContent(generalPrompt);
      const response = generalResult.response.text();
      
      res.json({
        success: true,
        agent: {
          intent: 'general_chat',
          response: response
        }
      });
    }
  } catch (error) {
    console.error('Error processing agent message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process message'
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const endpoints = [
    'chat/general',
    'chat/agent-process',
    'init-session'
  ];
  
  res.json({
    status: 'healthy',
    service: 'ai-assistant',
    endpoints: endpoints.length,
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'SimAlly AI Assistant API',
    version: '1.0.0'
  });
});

app.listen(PORT, () => {
  console.log(`AI Assistant server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`CORS configured for: ${FRONTEND_URL}`);
  console.log(`Enhanced with ${36} available endpoints`);
});