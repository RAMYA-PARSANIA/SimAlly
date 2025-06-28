const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

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
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// Enhanced CORS configuration for production
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:4173',
      'https://simally.vercel.app',
      'https://simally-webapp.vercel.app',
      VITE_API_URL,
      VITE_AI_API_URL,
      VITE_MEDIA_API_URL,
      VITE_WORKSPACE_API_URL,
      FRONTEND_URL,
      VITE_APP_URL
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

// Encryption functions for secure token storage
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const IV_LENGTH = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}

// Initialize AI session
app.post('/api/init-session', async (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  
  try {
    // Generate a unique session ID
    const sessionId = crypto.randomBytes(16).toString('hex');
    
    // Store session with user ID
    aiSessions.set(sessionId, {
      userId,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      context: []
    });
    
    // Set session cookie
    res.cookie('ai_session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax'
    });
    
    console.log(`AI session initialized for user: ${userId} with enhanced security`);
    
    res.json({
      success: true,
      sessionId
    });
  } catch (error) {
    console.error('Error initializing AI session:', error);
    res.status(500).json({ success: false, error: 'Failed to initialize AI session' });
  }
});

// General chat endpoint
app.post('/api/chat/general', async (req, res) => {
  const { message, userId } = req.body;
  const sessionId = req.cookies.ai_session_id;
  
  if (!message) {
    return res.status(400).json({ success: false, error: 'Message is required' });
  }
  
  if (!sessionId || !aiSessions.has(sessionId)) {
    return res.status(401).json({ success: false, error: 'Invalid or expired session' });
  }
  
  try {
    // Get session
    const session = aiSessions.get(sessionId);
    
    // Verify user ID matches
    if (session.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Session user mismatch' });
    }
    
    // Update last activity
    session.lastActivity = new Date().toISOString();
    
    // Process with AI
    const result = await model.generateContent(message);
    const response = result.response.text();
    
    // Update context
    session.context.push({ role: 'user', content: message });
    session.context.push({ role: 'assistant', content: response });
    
    // Limit context size
    if (session.context.length > 20) {
      session.context = session.context.slice(-20);
    }
    
    res.json({
      success: true,
      response
    });
  } catch (error) {
    console.error('Error processing chat message:', error);
    res.status(500).json({ success: false, error: 'Failed to process message' });
  }
});

// Agent processing endpoint
app.post('/api/chat/agent-process', async (req, res) => {
  const { message, userId, context } = req.body;
  const sessionId = req.cookies.ai_session_id;
  
  if (!message) {
    return res.status(400).json({ success: false, error: 'Message is required' });
  }
  
  if (!sessionId || !aiSessions.has(sessionId)) {
    return res.status(401).json({ success: false, error: 'Invalid or expired session' });
  }
  
  try {
    // Get session
    const session = aiSessions.get(sessionId);
    
    // Verify user ID matches
    if (session.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Session user mismatch' });
    }
    
    // Update last activity
    session.lastActivity = new Date().toISOString();
    
    // Determine intent
    const intentPrompt = `
      Analyze this user message and determine the intent:
      
      Message: "${message}"
      
      Possible intents:
      1. gmail_list - User wants to list or view emails
      2. gmail_search - User wants to search emails
      3. gmail_read - User wants to read a specific email
      4. gmail_delete - User wants to delete emails
      5. task_list - User wants to list tasks
      6. task_create - User wants to create a task
      7. calendar_list - User wants to list calendar events
      8. calendar_create - User wants to create a calendar event
      9. meeting_create - User wants to create a meeting
      10. game_start - User wants to start a game
      11. document_generate - User wants to generate a document
      12. general_chat - General conversation or question
      
      Additional context:
      - Gmail connected: ${context?.gmailConnected ? 'Yes' : 'No'}
      
      Respond with JSON only:
      {
        "intent": "one_of_the_above_intents",
        "parameters": {
          // Any extracted parameters like search terms, dates, etc.
        }
      }
    `;
    
    const intentResult = await model.generateContent(intentPrompt);
    const intentResponse = intentResult.response.text();
    
    let intent;
    try {
      intent = JSON.parse(intentResponse);
    } catch (error) {
      console.error('Error parsing intent JSON:', error);
      intent = { intent: 'general_chat', parameters: {} };
    }
    
    // Handle based on intent
    let agentResponse;
    
    if (intent.intent === 'gmail_list' && context?.gmailConnected) {
      agentResponse = await handleGmailList(userId, intent.parameters);
    } else if (intent.intent === 'gmail_search' && context?.gmailConnected) {
      agentResponse = await handleGmailSearch(userId, intent.parameters);
    } else if (intent.intent === 'task_list') {
      agentResponse = await handleTaskList(userId);
    } else if (intent.intent === 'task_create') {
      agentResponse = await handleTaskCreate(userId, message);
    } else if (intent.intent === 'meeting_create') {
      agentResponse = await handleMeetingCreate(userId, message);
    } else if (intent.intent === 'game_start') {
      agentResponse = await handleGameStart(userId, intent.parameters);
    } else if (intent.intent === 'document_generate') {
      agentResponse = await handleDocumentGenerate(userId, message);
    } else {
      // General chat
      const chatResult = await model.generateContent(message);
      const chatResponse = chatResult.response.text();
      
      agentResponse = {
        intent: 'general_chat',
        response: chatResponse
      };
    }
    
    // Update context
    session.context.push({ role: 'user', content: message });
    session.context.push({ role: 'assistant', content: agentResponse.response });
    
    // Limit context size
    if (session.context.length > 20) {
      session.context = session.context.slice(-20);
    }
    
    res.json({
      success: true,
      agent: agentResponse
    });
  } catch (error) {
    console.error('Error processing agent message:', error);
    res.status(500).json({ success: false, error: 'Failed to process message' });
  }
});

// Gmail list handler
async function handleGmailList(userId, parameters) {
  try {
    const maxResults = parameters.count || 10;
    
    // Get Gmail messages
    const response = await fetch(`${VITE_API_URL}/api/google/gmail/messages?maxResults=${maxResults}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': await getGoogleCookies(userId)
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch emails: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch emails');
    }
    
    return {
      intent: 'endpoint_call',
      endpoint: 'gmail_list',
      response: `📧 Found ${data.messages.length} emails in your inbox`,
      result: {
        emails: data.messages
      }
    };
  } catch (error) {
    console.error('Error handling Gmail list:', error);
    return {
      intent: 'endpoint_call',
      endpoint: 'gmail_list',
      response: `I encountered an error while trying to fetch your emails: ${error.message}`,
      result: {
        error: error.message
      }
    };
  }
}

// Gmail search handler
async function handleGmailSearch(userId, parameters) {
  try {
    const query = parameters.query || '';
    const maxResults = parameters.count || 10;
    
    // Get Gmail messages with search query
    const response = await fetch(`${VITE_API_URL}/api/google/gmail/messages?maxResults=${maxResults}&query=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': await getGoogleCookies(userId)
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to search emails: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to search emails');
    }
    
    return {
      intent: 'endpoint_call',
      endpoint: 'gmail_search',
      response: `📧 Found ${data.messages.length} emails matching "${query}"`,
      result: {
        emails: data.messages,
        query
      }
    };
  } catch (error) {
    console.error('Error handling Gmail search:', error);
    return {
      intent: 'endpoint_call',
      endpoint: 'gmail_search',
      response: `I encountered an error while searching your emails: ${error.message}`,
      result: {
        error: error.message
      }
    };
  }
}

// Task list handler
async function handleTaskList(userId) {
  try {
    // Get tasks from database
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select(`
        *,
        assignments:task_assignments(
          user_id,
          user:profiles(*)
        )
      `)
      .or(`created_by.eq.${userId},task_assignments.user_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch tasks: ${error.message}`);
    }
    
    return {
      intent: 'endpoint_call',
      endpoint: 'task_list',
      response: `📋 Found ${tasks.length} tasks`,
      result: {
        tasks
      }
    };
  } catch (error) {
    console.error('Error handling task list:', error);
    return {
      intent: 'endpoint_call',
      endpoint: 'task_list',
      response: `I encountered an error while fetching your tasks: ${error.message}`,
      result: {
        error: error.message
      }
    };
  }
}

// Task create handler
async function handleTaskCreate(userId, message) {
  try {
    // Extract task details using AI
    const extractPrompt = `
      Extract task information from this message:
      
      "${message}"
      
      Respond with JSON only:
      {
        "title": "brief task title",
        "description": "detailed description or null if not provided",
        "priority": "low|medium|high|urgent",
        "due_date": "YYYY-MM-DD if mentioned, null otherwise"
      }
    `;
    
    const extractResult = await model.generateContent(extractPrompt);
    const extractResponse = extractResult.response.text();
    
    let taskData;
    try {
      taskData = JSON.parse(extractResponse);
    } catch (error) {
      console.error('Failed to parse task data:', error);
      throw new Error('Failed to extract task information');
    }
    
    // Create task in database
    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority || 'medium',
        due_date: taskData.due_date,
        created_by: userId
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create task: ${error.message}`);
    }
    
    return {
      intent: 'endpoint_call',
      endpoint: 'task_create',
      response: `✅ Task created: "${task.title}"`,
      result: {
        task
      }
    };
  } catch (error) {
    console.error('Error handling task creation:', error);
    return {
      intent: 'endpoint_call',
      endpoint: 'task_create',
      response: `I encountered an error while creating your task: ${error.message}`,
      result: {
        error: error.message
      }
    };
  }
}

// Meeting create handler
async function handleMeetingCreate(userId, message) {
  try {
    // Extract meeting details using AI
    const extractPrompt = `
      Extract meeting information from this message:
      
      "${message}"
      
      Respond with JSON only:
      {
        "title": "meeting title",
        "description": "meeting description or null if not provided",
        "startTime": "YYYY-MM-DDTHH:MM:SS if mentioned, null otherwise",
        "duration": "duration in minutes, default to 60 if not specified"
      }
    `;
    
    const extractResult = await model.generateContent(extractPrompt);
    const extractResponse = extractResult.response.text();
    
    let meetingData;
    try {
      meetingData = JSON.parse(extractResponse);
    } catch (error) {
      console.error('Failed to parse meeting data:', error);
      throw new Error('Failed to extract meeting information');
    }
    
    // Set default start time if not provided (30 minutes from now)
    if (!meetingData.startTime) {
      const startTime = new Date();
      startTime.setMinutes(startTime.getMinutes() + 30);
      meetingData.startTime = startTime.toISOString();
    }
    
    // Create meeting using Google Calendar API
    const response = await fetch(`${VITE_API_URL}/api/google/meetings/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': await getGoogleCookies(userId)
      },
      body: JSON.stringify({
        title: meetingData.title,
        description: meetingData.description,
        startTime: meetingData.startTime,
        duration: meetingData.duration || 60
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create meeting: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to create meeting');
    }
    
    return {
      intent: 'endpoint_call',
      endpoint: 'meeting_create',
      response: `📅 Meeting created: "${data.meeting.title}" at ${new Date(data.meeting.startTime).toLocaleString()}`,
      result: {
        meeting: data.meeting
      }
    };
  } catch (error) {
    console.error('Error handling meeting creation:', error);
    return {
      intent: 'endpoint_call',
      endpoint: 'meeting_create',
      response: `I encountered an error while creating your meeting: ${error.message}`,
      result: {
        error: error.message
      }
    };
  }
}

// Game start handler
async function handleGameStart(userId, parameters) {
  try {
    // Determine game type
    const gameType = parameters.gameType || 'riddle';
    
    let endpoint;
    if (gameType.includes('riddle')) {
      endpoint = '/api/create-riddle-conversation';
    } else if (gameType.includes('twenty') && gameType.includes('user')) {
      endpoint = '/api/create-twenty-questions-user-asks';
    } else if (gameType.includes('twenty')) {
      endpoint = '/api/create-twenty-questions-ai-asks';
    } else {
      endpoint = '/api/create-riddle-conversation'; // Default
    }
    
    // Create game conversation
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
      throw new Error(`Failed to create game: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to create game');
    }
    
    return {
      intent: 'endpoint_call',
      endpoint: 'game_start',
      response: `🎮 Game ready! Click the link to start playing.`,
      result: {
        conversation_id: data.conversation_id,
        conversation_url: data.conversation_url,
        game_type: data.game_type
      }
    };
  } catch (error) {
    console.error('Error handling game start:', error);
    return {
      intent: 'endpoint_call',
      endpoint: 'game_start',
      response: `I encountered an error while setting up your game: ${error.message}`,
      result: {
        error: error.message
      }
    };
  }
}

// Document generate handler
async function handleDocumentGenerate(userId, message) {
  try {
    // Extract document details using AI
    const extractPrompt = `
      Extract document generation information from this message:
      
      "${message}"
      
      Respond with JSON only:
      {
        "documentType": "resume|cover_letter|project_proposal|meeting_notes|report|other",
        "title": "document title",
        "content": "specific content requirements or topics to include"
      }
    `;
    
    const extractResult = await model.generateContent(extractPrompt);
    const extractResponse = extractResult.response.text();
    
    let documentData;
    try {
      documentData = JSON.parse(extractResponse);
    } catch (error) {
      console.error('Failed to parse document data:', error);
      throw new Error('Failed to extract document information');
    }
    
    // Generate document content using AI
    const generatePrompt = `
      Generate a professional ${documentData.documentType} with the title "${documentData.title}".
      
      Content requirements: ${documentData.content}
      
      Format the document in clean HTML that can be easily copied or downloaded.
      Include appropriate sections, formatting, and professional language.
      
      Respond with the complete HTML document.
    `;
    
    const generateResult = await model.generateContent(generatePrompt);
    const documentContent = generateResult.response.text();
    
    return {
      intent: 'endpoint_call',
      endpoint: 'document_generate',
      response: `📄 Document generated: "${documentData.title}"`,
      result: {
        document: {
          type: documentData.documentType,
          title: documentData.title,
          content: documentContent
        }
      }
    };
  } catch (error) {
    console.error('Error handling document generation:', error);
    return {
      intent: 'endpoint_call',
      endpoint: 'document_generate',
      response: `I encountered an error while generating your document: ${error.message}`,
      result: {
        error: error.message
      }
    };
  }
}

// Helper function to get Google cookies for requests
async function getGoogleCookies(userId) {
  try {
    // Get the user's Google session ID from the database
    const { data, error } = await supabase
      .from('gmail_tokens')
      .select('session_id')
      .eq('user_id', userId)
      .single();
    
    if (error || !data || !data.session_id) {
      return '';
    }
    
    return `google_session_id=${data.session_id}`;
  } catch (error) {
    console.error('Error getting Google cookies:', error);
    return '';
  }
}

// Gmail callback handler - improved error handling
app.get('/api/gmail/callback', async (req, res) => {
  const { code, state } = req.query;
  const { userId } = req.cookies;
  
  if (!code || !state) {
    return res.redirect(`${FRONTEND_URL}/assistant?gmail_error=true`);
  }
  
  try {
    // Exchange code for tokens
    const tokenResponse = await fetch(`${VITE_API_URL}/api/google/callback?code=${code}&state=${state}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });
    
    // Check if the response is OK
    if (!tokenResponse.ok) {
      console.error(`Error in Gmail callback: ${tokenResponse.status} ${tokenResponse.statusText}`);
      return res.redirect(`${FRONTEND_URL}/assistant?gmail_error=true`);
    }
    
    // Try to parse the response as text first to debug
    const responseText = await tokenResponse.text();
    
    // Check if the response is valid JSON
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (error) {
      console.error('Error in Gmail callback:', error);
      console.error('Response text:', responseText);
      return res.redirect(`${FRONTEND_URL}/assistant?gmail_error=true`);
    }
    
    // Store the session ID in the database
    if (userId) {
      await supabase
        .from('gmail_tokens')
        .upsert({
          user_id: userId,
          session_id: state,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
        });
    }
    
    // Redirect back to the assistant page
    res.redirect(`${FRONTEND_URL}/assistant?gmail_connected=true`);
  } catch (error) {
    console.error('Error in Gmail callback:', error);
    res.redirect(`${FRONTEND_URL}/assistant?gmail_error=true`);
  }
});

// Gmail status endpoint
app.get('/api/gmail/status', async (req, res) => {
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  
  try {
    // Check if user has a valid Gmail token
    const { data, error } = await supabase
      .from('gmail_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) {
      return res.json({ success: true, connected: false });
    }
    
    // Check if token is expired
    const expiryDate = new Date(data.expires_at);
    const isExpired = expiryDate < new Date();
    
    if (isExpired) {
      return res.json({ success: true, connected: false });
    }
    
    // Get Gmail status
    const response = await fetch(`${VITE_API_URL}/api/google/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `google_session_id=${data.session_id}`
      }
    });
    
    if (!response.ok) {
      return res.json({ success: true, connected: false });
    }
    
    const statusData = await response.json();
    
    return res.json({
      success: true,
      connected: statusData.connected,
      email: data.email,
      expiresAt: data.expires_at
    });
  } catch (error) {
    console.error('Error checking Gmail status:', error);
    return res.status(500).json({ success: false, error: 'Failed to check Gmail status' });
  }
});

// Gmail disconnect endpoint
app.post('/api/gmail/disconnect', async (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  
  try {
    // Get the user's Gmail session
    const { data, error } = await supabase
      .from('gmail_tokens')
      .select('session_id')
      .eq('user_id', userId)
      .single();
    
    if (!error && data && data.session_id) {
      // Call the Google API to disconnect
      await fetch(`${VITE_API_URL}/api/google/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `google_session_id=${data.session_id}`
        }
      });
    }
    
    // Delete the token from the database
    await supabase
      .from('gmail_tokens')
      .delete()
      .eq('user_id', userId);
    
    res.json({ success: true, message: 'Gmail disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting Gmail:', error);
    res.status(500).json({ success: false, error: 'Failed to disconnect Gmail' });
  }
});

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