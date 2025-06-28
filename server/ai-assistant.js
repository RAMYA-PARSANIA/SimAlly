const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
const cookieParser = require('cookie-parser');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.AI_ASSISTANT_PORT || 8000;

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

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
      'http://localhost:5173',
      'http://localhost:4173'
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
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    // Generate a secure session ID
    const sessionId = `ai_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    // Store session with user context
    aiSessions.set(sessionId, {
      userId,
      createdAt: new Date(),
      lastActivity: new Date(),
      context: []
    });
    
    // Set session cookie
    res.cookie('ai_session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax'
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

// Process general chat messages
app.post('/api/chat/general', async (req, res) => {
  try {
    const { message, userId } = req.body;
    const sessionId = req.cookies.ai_session_id;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }
    
    // Get or create session
    let session = aiSessions.get(sessionId);
    if (!session && userId) {
      // Create a new session if none exists
      const newSessionId = `ai_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      session = {
        userId,
        createdAt: new Date(),
        lastActivity: new Date(),
        context: []
      };
      aiSessions.set(newSessionId, session);
      
      // Set session cookie
      res.cookie('ai_session_id', newSessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax'
      });
    }
    
    // Update session activity
    if (session) {
      session.lastActivity = new Date();
    }
    
    // Process with Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `
      You are SimAlly, a helpful AI assistant. You provide concise, accurate, and helpful responses.
      
      User message: ${message}
      
      Respond in a friendly, professional manner. Keep your response focused and to the point.
    `;
    
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    res.json({
      success: true,
      response
    });
  } catch (error) {
    console.error('Error processing chat message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process message'
    });
  }
});

// Process agent-based chat messages with endpoint detection
app.post('/api/chat/agent-process', async (req, res) => {
  try {
    const { message, userId, context } = req.body;
    const sessionId = req.cookies.ai_session_id;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }
    
    // Get or create session
    let session = aiSessions.get(sessionId);
    if (!session && userId) {
      // Create a new session if none exists
      const newSessionId = `ai_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      session = {
        userId,
        createdAt: new Date(),
        lastActivity: new Date(),
        context: []
      };
      aiSessions.set(newSessionId, session);
      
      // Set session cookie
      res.cookie('ai_session_id', newSessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax'
      });
    }
    
    // Update session activity
    if (session) {
      session.lastActivity = new Date();
    }
    
    // First, determine if this is an endpoint call or general chat
    const intentModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const intentPrompt = `
      You are an intent classifier for an AI assistant. Your job is to determine if the user's message requires calling a specific API endpoint or if it's a general chat message.
      
      User message: "${message}"
      
      Context: ${JSON.stringify(context || {})}
      
      Available endpoints:
      - gmail_list_messages: List Gmail messages (requires Gmail connection)
      - gmail_search_messages: Search Gmail messages (requires Gmail connection)
      - gmail_get_message: Get a specific Gmail message (requires Gmail connection)
      - task_create: Create a new task
      - task_list: List tasks
      - task_update: Update a task
      - calendar_create_event: Create a calendar event
      - calendar_list_events: List calendar events
      - document_generate: Generate a document based on a prompt
      - meeting_create: Create a meeting room
      - game_start_riddle: Start a riddle game
      - game_start_twenty_questions: Start a 20 questions game
      
      Respond with JSON in this format:
      {
        "intent": "endpoint_call" or "general_chat",
        "endpoint": "endpoint_name" or null,
        "parameters": {object with any parameters needed} or null,
        "confidence": 0.0 to 1.0
      }
      
      Only respond with valid JSON. No other text.
    `;
    
    const intentResult = await intentModel.generateContent(intentPrompt);
    const intentText = intentResult.response.text();
    
    let intentData;
    try {
      intentData = JSON.parse(intentText);
    } catch (error) {
      console.error('Error parsing intent JSON:', error);
      intentData = { intent: "general_chat", confidence: 0.8 };
    }
    
    // Process based on intent
    if (intentData.intent === "endpoint_call" && intentData.confidence > 0.7) {
      // Handle endpoint call
      const endpoint = intentData.endpoint;
      const parameters = intentData.parameters || {};
      
      let result = null;
      let response = "";
      
      // Gmail endpoints
      if (endpoint.startsWith('gmail_') && context?.gmailConnected) {
        if (endpoint === 'gmail_list_messages') {
          result = await handleGmailListMessages(userId, parameters.maxResults || 10);
          response = `📧 Found ${result.emails?.length || 0} emails in your inbox.`;
        } else if (endpoint === 'gmail_search_messages') {
          result = await handleGmailSearchMessages(userId, parameters.query || '');
          response = `📧 Found ${result.emails?.length || 0} emails matching your search.`;
        }
      } else if (endpoint.startsWith('gmail_') && !context?.gmailConnected) {
        response = "To access your Gmail, you need to connect your Google account first. Please go to the Dashboard and click 'Connect Google'.";
      }
      
      // Task endpoints
      if (endpoint === 'task_create') {
        result = await handleTaskCreate(userId, parameters);
        response = `✅ Task "${parameters.title}" created successfully.`;
      } else if (endpoint === 'task_list') {
        result = await handleTaskList(userId, parameters);
        response = `📋 Found ${result.tasks?.length || 0} tasks.`;
      }
      
      // Calendar endpoints
      if (endpoint === 'calendar_create_event') {
        result = await handleCalendarCreateEvent(userId, parameters);
        response = `📅 Event "${parameters.title}" created successfully.`;
      } else if (endpoint === 'calendar_list_events') {
        result = await handleCalendarListEvents(userId, parameters);
        response = `📅 Found ${result.events?.length || 0} upcoming events.`;
      }
      
      // Document generation
      if (endpoint === 'document_generate') {
        result = await handleDocumentGenerate(parameters.prompt || message);
        response = `📄 Document generated successfully.`;
      }
      
      // Meeting creation
      if (endpoint === 'meeting_create') {
        result = await handleMeetingCreate(userId, parameters);
        response = `🎥 Meeting room created successfully.`;
      }
      
      // Game endpoints
      if (endpoint === 'game_start_riddle') {
        result = await handleGameStartRiddle(userId);
        response = `🎮 Riddle game started! Click the link to begin playing.`;
      } else if (endpoint === 'game_start_twenty_questions') {
        result = await handleGameStartTwentyQuestions(userId, parameters.mode || 'user-asks');
        response = `🎮 20 Questions game started! Click the link to begin playing.`;
      }
      
      res.json({
        success: true,
        agent: {
          intent: intentData.intent,
          endpoint,
          response,
          result
        }
      });
    } else {
      // Handle general chat
      const chatModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const chatPrompt = `
        You are SimAlly, a helpful AI assistant. You provide concise, accurate, and helpful responses.
        
        User message: ${message}
        
        Context: ${JSON.stringify(context || {})}
        
        Respond in a friendly, professional manner. Keep your response focused and to the point.
      `;
      
      const chatResult = await chatModel.generateContent(chatPrompt);
      const response = chatResult.response.text();
      
      res.json({
        success: true,
        agent: {
          intent: "general_chat",
          response
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

// Gmail API endpoints
app.get('/api/gmail/status', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    // Check if user has Gmail tokens via Google API
    const response = await fetch(`${VITE_API_URL}/api/google/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.cookie || ''
      },
      credentials: 'include'
    });
    
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: 'Failed to check Gmail status'
      });
    }
    
    const data = await response.json();
    
    res.json({
      connected: data.connected,
      email: data.email,
      token: data.token,
      expiresAt: data.expiresAt
    });
  } catch (error) {
    console.error('Error checking Gmail status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check Gmail status'
    });
  }
});

// Gmail API endpoints
app.get('/api/gmail/auth-url', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    // Forward request to Google API
    const response = await fetch(`${VITE_API_URL}/api/google/auth-url`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.cookie || ''
      },
      credentials: 'include'
    });
    
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: 'Failed to get auth URL'
      });
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error getting Gmail auth URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get Gmail auth URL'
    });
  }
});

app.post('/api/gmail/disconnect', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    // Forward request to Google API
    const response = await fetch(`${VITE_API_URL}/api/google/disconnect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.cookie || ''
      },
      credentials: 'include',
      body: JSON.stringify({})
    });
    
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: 'Failed to disconnect Gmail'
      });
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error disconnecting Gmail:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect Gmail'
    });
  }
});

// Handler functions for endpoints
async function handleGmailListMessages(userId, maxResults = 10) {
  try {
    // Forward request to Google API
    const response = await fetch(`${VITE_API_URL}/api/google/gmail/messages?maxResults=${maxResults}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to list Gmail messages: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing Gmail messages:', error);
    throw error;
  }
}

async function handleGmailSearchMessages(userId, query) {
  try {
    // Forward request to Google API
    const response = await fetch(`${VITE_API_URL}/api/google/gmail/messages?query=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to search Gmail messages: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error searching Gmail messages:', error);
    throw error;
  }
}

async function handleTaskCreate(userId, parameters) {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: parameters.title,
        description: parameters.description || null,
        priority: parameters.priority || 'medium',
        due_date: parameters.dueDate || null,
        created_by: userId
      })
      .select();
    
    if (error) throw error;
    
    return { tasks: data };
  } catch (error) {
    console.error('Error creating task:', error);
    throw error;
  }
}

async function handleTaskList(userId, parameters) {
  try {
    let query = supabase
      .from('tasks')
      .select(`
        *,
        assignments:task_assignments(
          user_id,
          user:profiles(*)
        )
      `)
      .eq('created_by', userId);
    
    if (parameters.status) {
      query = query.eq('status', parameters.status);
    }
    
    if (parameters.priority) {
      query = query.eq('priority', parameters.priority);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return { tasks: data };
  } catch (error) {
    console.error('Error listing tasks:', error);
    throw error;
  }
}

async function handleCalendarCreateEvent(userId, parameters) {
  try {
    const { data, error } = await supabase
      .from('calendar_events')
      .insert({
        title: parameters.title,
        description: parameters.description || null,
        start_time: parameters.startTime,
        end_time: parameters.endTime,
        user_id: userId
      })
      .select();
    
    if (error) throw error;
    
    return { events: data };
  } catch (error) {
    console.error('Error creating calendar event:', error);
    throw error;
  }
}

async function handleCalendarListEvents(userId, parameters) {
  try {
    let query = supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId);
    
    if (parameters.startDate) {
      query = query.gte('start_time', parameters.startDate);
    }
    
    if (parameters.endDate) {
      query = query.lte('start_time', parameters.endDate);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return { events: data };
  } catch (error) {
    console.error('Error listing calendar events:', error);
    throw error;
  }
}

async function handleDocumentGenerate(prompt) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const docPrompt = `
      Generate a professional document based on this prompt:
      
      ${prompt}
      
      Format the document with proper structure, headings, and formatting.
      Make it comprehensive and ready for professional use.
    `;
    
    const result = await model.generateContent(docPrompt);
    const content = result.response.text();
    
    return {
      document: {
        title: prompt.substring(0, 50) + '...',
        content: content,
        generated_at: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error generating document:', error);
    throw error;
  }
}

async function handleMeetingCreate(userId, parameters) {
  try {
    // Forward request to Google API
    const response = await fetch(`${VITE_API_URL}/api/google/meetings/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': parameters.cookie || ''
      },
      credentials: 'include',
      body: JSON.stringify({
        title: parameters.title || 'AI Assistant Meeting',
        description: parameters.description || 'Meeting created by SimAlly AI Assistant',
        startTime: parameters.startTime || new Date(Date.now() + 30 * 60000).toISOString(),
        duration: parameters.duration || 60
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create meeting: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return { room: data.meeting };
  } catch (error) {
    console.error('Error creating meeting:', error);
    throw error;
  }
}

async function handleGameStartRiddle(userId) {
  try {
    // Forward request to API
    const response = await fetch(`${VITE_API_URL}/api/create-riddle-conversation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to start riddle game: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error starting riddle game:', error);
    throw error;
  }
}

async function handleGameStartTwentyQuestions(userId, mode) {
  try {
    const endpoint = mode === 'ai-asks' 
      ? '/api/create-twenty-questions-ai-asks' 
      : '/api/create-twenty-questions-user-asks';
    
    // Forward request to API
    const response = await fetch(`${VITE_API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to start 20 questions game: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error starting 20 questions game:', error);
    throw error;
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    active_sessions: aiSessions.size,
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