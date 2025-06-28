const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { tokenStore } = require('./google-api');
const cookieParser = require('cookie-parser');
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

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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

// Store AI sessions
const aiSessions = new Map();

// Initialize AI session
app.post('/api/init-session', (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  
  // Generate a session ID for this AI session
  const sessionId = userId;
  
  // Store session
  aiSessions.set(sessionId, {
    userId,
    created: new Date().toISOString(),
    history: []
  });
  
  res.json({
    success: true,
    sessionId
  });
});

// Process chat message with agent detection
app.post('/api/chat/agent-process', async (req, res) => {
  const { message, userId, context = {} } = req.body;
  
  console.log(`[${Date.now()}] Processing message: "${message}" for user: ${userId}`);
  
  if (!message || !userId) {
    return res.status(400).json({ success: false, error: 'Message and userId are required' });
  }
  
  try {
    // Get or create session
    let session = aiSessions.get(userId);
    if (!session) {
      session = {
        userId,
        created: new Date().toISOString(),
        history: []
      };
      aiSessions.set(userId, session);
    }
    
    // Add user message to history
    session.history.push({
      role: 'user',
      content: message
    });
    
    // Determine if this is a request for an endpoint call
    const agentPrompt = `
      You are an AI assistant that can help users with various tasks. 
      Analyze the user's message and determine if it requires calling a specific endpoint.
      
      User message: "${message}"
      
      Context:
      - Gmail connected: ${context.gmailConnected ? 'Yes' : 'No'}
      
      If the message requires calling an endpoint, respond with JSON in this format:
      {
        "type": "endpoint_call",
        "endpoint": "endpoint_name",
        "parameters": { param1: value1, param2: value2 },
        "response": "Your human-friendly response to the user"
      }
      
      Available endpoints:
      - gmail_unread: Get unread emails (requires Gmail connection)
      - gmail_search: Search emails (requires Gmail connection, parameters: query)
      - task_list: Get user's tasks
      - task_create: Create a new task (parameters: title, description, priority, dueDate)
      - calendar_events: Get calendar events
      - document_generate: Generate a document (parameters: type, topic, length)
      - meeting_create: Create a meeting room (parameters: title)
      - game_start: Start a game (parameters: gameType)
      
      If the message is a general chat that doesn't require an endpoint call, respond with JSON in this format:
      {
        "type": "chat",
        "response": "Your helpful response to the user's message"
      }
      
      Only respond with valid JSON.
    `;
    
    const agentResult = await model.generateContent(agentPrompt);
    const agentText = agentResult.response.text();
    
    // Parse the agent's response
    let agentData;
    try {
      // Extract JSON from the response (in case there's markdown or other text)
      const jsonMatch = agentText.match(/```json\n([\s\S]*?)\n```/) || 
                        agentText.match(/```([\s\S]*?)```/) || 
                        [null, agentText];
      const jsonText = jsonMatch[1].trim();
      agentData = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Failed to parse agent response:', agentText, parseError);
      return res.status(500).json({ success: false, error: 'Failed to parse agent response' });
    }
    
    // Handle endpoint calls
    if (agentData.type === 'endpoint_call') {
      const endpoint = agentData.endpoint;
      const parameters = agentData.parameters || {};
      
      // Gmail endpoints require Google connection
      if (endpoint.startsWith('gmail_') && !context.gmailConnected) {
        return res.json({
          success: true,
          agent: {
            intent: 'chat',
            response: "I'd like to help with your Gmail, but you need to connect your Google account first. You can do this from the Dashboard by clicking 'Connect Google'."
          }
        });
      }
      
      let result = null;
      
      // Process the endpoint call
      switch (endpoint) {
        case 'gmail_unread':
          result = await handleGmailUnread(userId);
          break;
        case 'gmail_search':
          result = await handleGmailSearch(userId, parameters.query);
          break;
        case 'task_list':
          result = await handleTaskList(userId);
          break;
        case 'task_create':
          result = await handleTaskCreate(userId, parameters);
          break;
        case 'calendar_events':
          result = await handleCalendarEvents(userId);
          break;
        case 'document_generate':
          result = await handleDocumentGenerate(parameters);
          break;
        case 'meeting_create':
          result = await handleMeetingCreate(parameters);
          break;
        case 'game_start':
          result = await handleGameStart(userId, parameters.gameType);
          break;
        default:
          // Unknown endpoint, fall back to chat
          return res.json({
            success: true,
            agent: {
              intent: 'chat',
              response: agentData.response || "I'm not sure how to process that request. Could you try asking in a different way?"
            }
          });
      }
      
      // Add assistant response to history
      session.history.push({
        role: 'assistant',
        content: agentData.response
      });
      
      return res.json({
        success: true,
        agent: {
          intent: 'endpoint_call',
          endpoint,
          response: agentData.response,
          result
        }
      });
    } else {
      // Regular chat response
      // Add assistant response to history
      session.history.push({
        role: 'assistant',
        content: agentData.response
      });
      
      return res.json({
        success: true,
        agent: {
          intent: 'chat',
          response: agentData.response
        }
      });
    }
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ success: false, error: 'Failed to process message' });
  }
});

// General chat endpoint (without agent detection)
app.post('/api/chat/general', async (req, res) => {
  const { message, userId } = req.body;
  
  if (!message || !userId) {
    return res.status(400).json({ success: false, error: 'Message and userId are required' });
  }
  
  try {
    // Get or create session
    let session = aiSessions.get(userId);
    if (!session) {
      session = {
        userId,
        created: new Date().toISOString(),
        history: []
      };
      aiSessions.set(userId, session);
    }
    
    // Add user message to history
    session.history.push({
      role: 'user',
      content: message
    });
    
    // Generate response
    const chatHistory = session.history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }]
    }));
    
    const result = await model.generateContent({
      contents: chatHistory,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      }
    });
    
    const response = result.response.text();
    
    // Add assistant response to history
    session.history.push({
      role: 'assistant',
      content: response
    });
    
    // Trim history if it gets too long
    if (session.history.length > 20) {
      session.history = session.history.slice(-20);
    }
    
    res.json({
      success: true,
      response
    });
  } catch (error) {
    console.error('Error generating chat response:', error);
    res.status(500).json({ success: false, error: 'Failed to generate response' });
  }
});

// Endpoint handlers
async function handleGmailUnread(userId) {
  console.log(`[${Date.now()}] Handling Gmail unread for user: ${userId}`);
  
  try {
    // Check if we have tokens for this user
    if (!tokenStore.has(userId)) {
      console.log(`[${Date.now()}] No tokens found for user ID: ${userId}`);
      return { success: false, error: 'Not authenticated with Google' };
    }
    
    // Make request to Gmail API endpoint
    const response = await fetch(`${VITE_API_URL}/api/gmail/unread?userId=${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch unread emails: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error handling Gmail unread:', error);
    return { success: false, error: error.message };
  }
}

async function handleGmailSearch(userId, query) {
  console.log(`[${Date.now()}] Handling Gmail search for user: ${userId}, query: ${query}`);
  
  try {
    // Check if we have tokens for this user
    if (!tokenStore.has(userId)) {
      console.log(`[${Date.now()}] No tokens found for user ID: ${userId}`);
      return { success: false, error: 'Not authenticated with Google' };
    }
    
    // Make request to Gmail API endpoint
    const response = await fetch(`${VITE_API_URL}/api/gmail/messages?userId=${userId}&query=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to search emails: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error handling Gmail search:', error);
    return { success: false, error: error.message };
  }
}

async function handleTaskList(userId) {
  // This would typically fetch tasks from your database
  return { success: true, tasks: [] };
}

async function handleTaskCreate(userId, parameters) {
  // This would typically create a task in your database
  return { success: true, task: { id: 'mock-id', ...parameters } };
}

async function handleCalendarEvents(userId) {
  // This would typically fetch calendar events
  return { success: true, events: [] };
}

async function handleDocumentGenerate(parameters) {
  // This would typically generate a document
  return { 
    success: true, 
    document: { 
      title: parameters.topic || 'Generated Document',
      content: `<h1>${parameters.topic || 'Generated Document'}</h1><p>This is a sample document.</p>` 
    } 
  };
}

async function handleMeetingCreate(parameters) {
  // This would typically create a meeting room
  const roomName = `meeting-${Date.now()}`;
  return { 
    success: true, 
    room: { 
      name: parameters.title || 'New Meeting',
      url: `https://meet.google.com/${roomName}` 
    } 
  };
}

async function handleGameStart(userId, gameType) {
  // This would typically start a game
  return { 
    success: true, 
    game: { 
      type: gameType || 'riddle',
      url: `https://example.com/game/${gameType || 'riddle'}` 
    } 
  };
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'ai-assistant',
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
});

module.exports = app;