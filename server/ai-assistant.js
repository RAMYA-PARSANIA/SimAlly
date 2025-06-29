const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.AI_ASSISTANT_PORT || 8000;

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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

// Add security headers
app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Store active AI sessions
const activeSessions = new Map();

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
    const sessionId = `ai_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store session with user context
    activeSessions.set(sessionId, {
      userId,
      created_at: new Date().toISOString(),
      last_activity: new Date().toISOString(),
      context: {}
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

// Process chat message with agent detection
app.post('/api/chat/agent-process', async (req, res) => {
  const { message, userId, context = {} } = req.body;
  
  if (!message || !userId) {
    return res.status(400).json({
      success: false,
      error: 'Message and user ID are required'
    });
  }
  
  try {
    console.log(`Processing message: "${message}" for user: ${userId}`);
    
    // Determine if this is a request for a specific endpoint
    const agentResponse = await determineAgentAction(message, userId, context);
    
    console.log('AI Response:', JSON.stringify(agentResponse, null, 2));
    
    res.json({
      success: true,
      agent: agentResponse
    });
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process message'
    });
  }
});

// General chat endpoint (no agent detection)
app.post('/api/chat/general', async (req, res) => {
  const { message, userId } = req.body;
  
  if (!message) {
    return res.status(400).json({
      success: false,
      error: 'Message is required'
    });
  }
  
  try {
    const result = await model.generateContent(message);
    const response = result.response.text();
    
    res.json({
      success: true,
      response
    });
  } catch (error) {
    console.error('Error generating response:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate response'
    });
  }
});

// Determine agent action based on message
async function determineAgentAction(message, userId, context = {}) {
  // First, check for specific endpoint requests
  
  // Gmail-related requests
  if (context.gmailConnected && (
    message.toLowerCase().includes('show my emails') ||
    message.toLowerCase().includes('show unread emails') ||
    message.toLowerCase().includes('check my inbox') ||
    message.toLowerCase().includes('unread messages')
  )) {
    return {
      type: 'endpoint_call',
      endpoint: 'gmail_unread',
      parameters: { userId },
      response: 'Showing your unread emails.'
    };
  }
  
  if (context.gmailConnected && (
    message.toLowerCase().includes('search emails') ||
    message.toLowerCase().includes('find emails') ||
    message.toLowerCase().includes('search for emails')
  )) {
    // Extract search query
    const queryMatch = message.match(/search (?:for |my )?emails (?:about |with |containing |related to )?"([^"]+)"/i) ||
                      message.match(/search (?:for |my )?emails (?:about |with |containing |related to )?([a-z0-9\s]+)/i) ||
                      message.match(/find (?:my )?emails (?:about |with |containing |related to )?"([^"]+)"/i) ||
                      message.match(/find (?:my )?emails (?:about |with |containing |related to )?([a-z0-9\s]+)/i);
    
    const query = queryMatch ? queryMatch[1].trim() : '';
    
    return {
      type: 'endpoint_call',
      endpoint: 'gmail_search',
      parameters: { userId, query },
      response: `Searching your emails for "${query}".`
    };
  }
  
  // Task-related requests
  if (
    message.toLowerCase().includes('show my tasks') ||
    message.toLowerCase().includes('list tasks') ||
    message.toLowerCase().includes('show tasks')
  ) {
    return {
      type: 'endpoint_call',
      endpoint: 'tasks_list',
      parameters: { userId },
      response: 'Here are your tasks:'
    };
  }
  
  // Meeting-related requests
  if (
    message.toLowerCase().includes('create a meeting') ||
    message.toLowerCase().includes('schedule a meeting') ||
    message.toLowerCase().includes('set up a meeting')
  ) {
    // Extract meeting details
    const titleMatch = message.match(/meeting (?:about |for |on )?"([^"]+)"/i) ||
                      message.match(/meeting (?:about |for |on )?([a-z0-9\s]+)/i);
    
    const timeMatch = message.match(/at (\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i) ||
                     message.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
    
    const dateMatch = message.match(/on ([a-z]+day)/i) ||
                     message.match(/on (tomorrow)/i) ||
                     message.match(/on (today)/i);
    
    const title = titleMatch ? titleMatch[1].trim() : 'New Meeting';
    const time = timeMatch ? timeMatch[1].trim() : '';
    const date = dateMatch ? dateMatch[1].trim() : '';
    
    return {
      type: 'endpoint_call',
      endpoint: 'create_meeting',
      parameters: { userId, title, time, date },
      response: `Creating a meeting${title ? ' about "' + title + '"' : ''}${time ? ' at ' + time : ''}${date ? ' on ' + date : ''}.`
    };
  }
  
  // Game-related requests
  if (
    message.toLowerCase().includes('play a game') ||
    message.toLowerCase().includes('start a game') ||
    message.toLowerCase().includes('play riddle') ||
    message.toLowerCase().includes('play 20 questions')
  ) {
    let gameType = 'riddle';
    
    if (message.toLowerCase().includes('20 questions') || message.toLowerCase().includes('twenty questions')) {
      gameType = 'twenty_questions';
    }
    
    return {
      type: 'endpoint_call',
      endpoint: 'start_game',
      parameters: { userId, gameType },
      response: `Starting a ${gameType === 'riddle' ? 'riddle' : '20 questions'} game for you.`
    };
  }
  
  // Document generation requests
  if (
    message.toLowerCase().includes('create a document') ||
    message.toLowerCase().includes('generate a document') ||
    message.toLowerCase().includes('make a document') ||
    message.toLowerCase().includes('write a document')
  ) {
    // Extract document details
    const promptMatch = message.match(/document (?:about |for |on )?"([^"]+)"/i) ||
                       message.match(/document (?:about |for |on )?([a-z0-9\s]+)/i);
    
    const prompt = promptMatch ? promptMatch[1].trim() : '';
    
    return {
      type: 'endpoint_call',
      endpoint: 'create_document',
      parameters: { userId, prompt },
      response: `Creating a document about "${prompt}".`
    };
  }
  
  // Presentation generation requests
  if (
    message.toLowerCase().includes('create a presentation') ||
    message.toLowerCase().includes('generate a presentation') ||
    message.toLowerCase().includes('make slides') ||
    message.toLowerCase().includes('create slides')
  ) {
    // Extract presentation details
    const promptMatch = message.match(/presentation (?:about |for |on )?"([^"]+)"/i) ||
                       message.match(/presentation (?:about |for |on )?([a-z0-9\s]+)/i) ||
                       message.match(/slides (?:about |for |on )?"([^"]+)"/i) ||
                       message.match(/slides (?:about |for |on )?([a-z0-9\s]+)/i);
    
    const prompt = promptMatch ? promptMatch[1].trim() : '';
    
    return {
      type: 'endpoint_call',
      endpoint: 'create_presentation',
      parameters: { userId, prompt },
      response: `Creating a presentation about "${prompt}".`
    };
  }
  
  // If no specific endpoint is detected, use general chat
  const result = await model.generateContent(`
    You are SimAlly, a professional AI assistant. Respond to this message:
    "${message}"
    
    Keep your response helpful, concise, and professional.
    If the user is asking about email, calendar, or document features, mention that they need to connect their Google account if it's not already connected.
    Current Google connection status: ${context.gmailConnected ? 'Connected' : 'Not connected'}
  `);
  
  return {
    type: 'general_chat',
    response: result.response.text()
  };
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    active_sessions: activeSessions.size,
    framework: 'Express.js'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'SimAlly AI Assistant API',
    framework: 'Express.js'
  });
});

app.listen(PORT, () => {
  console.log(`AI Assistant server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`CORS configured for: ${FRONTEND_URL}`);
});