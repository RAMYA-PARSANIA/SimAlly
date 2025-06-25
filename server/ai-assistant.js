const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.AI_ASSISTANT_PORT || 8001;

// Get frontend URL from environment
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Gmail OAuth configuration
const oauth2Client = new OAuth2Client(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

// Middleware
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));
app.use(express.json());

// API endpoints
const API_ENDPOINTS = [
  {
    name: 'getUnreadEmails',
    description: 'Get unread emails from Gmail',
    endpoint: '/api/gmail/unread',
    method: 'GET',
    parameters: ['userId'],
    requiresGmailAuth: true
  },
  {
    name: 'searchEmails',
    description: 'Search emails in Gmail',
    endpoint: '/api/gmail/search',
    method: 'GET',
    parameters: ['userId', 'query'],
    requiresGmailAuth: true
  },
  {
    name: 'getPromotionalEmails',
    description: 'Get promotional emails from Gmail',
    endpoint: '/api/gmail/promotional',
    method: 'GET',
    parameters: ['userId'],
    requiresGmailAuth: true
  },
  {
    name: 'deleteEmails',
    description: 'Delete emails from Gmail',
    endpoint: '/api/gmail/delete-emails',
    method: 'POST',
    parameters: ['userId', 'messageIds'],
    requiresGmailAuth: true
  },
  {
    name: 'createTask',
    description: 'Create a new task',
    endpoint: '/api/tasks/create',
    method: 'POST',
    parameters: ['userId', 'title', 'description', 'priority', 'dueDate']
  },
  {
    name: 'getTasks',
    description: 'Get user tasks',
    endpoint: '/api/tasks/list',
    method: 'GET',
    parameters: ['userId', 'status']
  },
  {
    name: 'createCalendarEvent',
    description: 'Create a calendar event',
    endpoint: '/api/calendar/create',
    method: 'POST',
    parameters: ['userId', 'title', 'description', 'startTime', 'endTime']
  },
  {
    name: 'getCalendarEvents',
    description: 'Get calendar events',
    endpoint: '/api/calendar/list',
    method: 'GET',
    parameters: ['userId', 'startDate', 'endDate']
  },
  {
    name: 'createMeetingRoom',
    description: 'Create a video meeting room',
    endpoint: '/api/meetings/create',
    method: 'POST',
    parameters: ['userId', 'title']
  },
  {
    name: 'generateDocument',
    description: 'Generate a document from a template',
    endpoint: '/api/documents/generate',
    method: 'POST',
    parameters: ['userId', 'type', 'parameters']
  },
  {
    name: 'startGame',
    description: 'Start a game session',
    endpoint: '/api/games/start',
    method: 'POST',
    parameters: ['userId', 'gameType']
  },
  {
    name: 'generalChat',
    description: 'General chat with the AI assistant',
    endpoint: '/api/chat/general',
    method: 'POST',
    parameters: ['userId', 'message']
  }
];

// Agent processing endpoint
app.post('/api/chat/agent-process', async (req, res) => {
  try {
    const { message, userId, context = {} } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }
    
    // Prepare system prompt with API endpoints
    const systemPrompt = `
      You are an AI assistant for the SimAlly application. You have access to the following API endpoints:
      
      ${API_ENDPOINTS.map(endpoint => 
        `- ${endpoint.name}: ${endpoint.description} (${endpoint.method} ${endpoint.endpoint}) - Parameters: ${endpoint.parameters.join(', ')}${endpoint.requiresGmailAuth ? ' - Requires Gmail authentication' : ''}`
      ).join('\n')}
      
      Based on the user's message, determine if you should:
      1. Call a specific API endpoint (if the user's request matches one of the available endpoints)
      2. Respond with a general chat message (if no specific endpoint is needed)
      
      If an endpoint is needed, respond with JSON in this format:
      {
        "intent": "endpoint_call",
        "endpoint": "endpointName",
        "parameters": {
          "param1": "value1",
          "param2": "value2"
        },
        "response": "Your human-friendly response to the user"
      }
      
      If no endpoint is needed, respond with JSON in this format:
      {
        "intent": "general_chat",
        "response": "Your helpful response to the user's query"
      }
      
      Additional context:
      - Gmail connected: ${context.gmailConnected ? 'Yes' : 'No'}
      
      Only respond with valid JSON. Do not include any other text.
    `;
    
    // Generate response from Gemini
    const result = await model.generateContent([
      { text: systemPrompt, role: 'system' },
      { text: message, role: 'user' }
    ]);
    
    const responseText = result.response.text();
    
    // Parse the JSON response
    let agentResponse;
    try {
      agentResponse = JSON.parse(responseText);
    } catch (error) {
      console.error('Failed to parse agent response:', error);
      console.log('Raw response:', responseText);
      return res.status(500).json({
        success: false,
        error: 'Invalid response from AI agent'
      });
    }
    
    // If the intent is to call an endpoint, process it
    if (agentResponse.intent === 'endpoint_call') {
      const { endpoint, parameters } = agentResponse;
      
      // Find the matching endpoint
      const apiEndpoint = API_ENDPOINTS.find(e => e.name === endpoint);
      
      if (!apiEndpoint) {
        return res.json({
          success: true,
          agent: {
            intent: 'general_chat',
            response: `I'm sorry, but I don't have access to the ${endpoint} functionality. Is there something else I can help you with?`
          }
        });
      }
      
      // Check if Gmail auth is required but not available
      if (apiEndpoint.requiresGmailAuth && !context.gmailConnected) {
        return res.json({
          success: true,
          agent: {
            intent: 'general_chat',
            response: 'To use this feature, you need to connect your Gmail account first. Please click the "Connect Gmail" button at the top of the page.'
          }
        });
      }
      
      // Execute the endpoint call
      let result;
      try {
        result = await callEndpoint(apiEndpoint, { ...parameters, userId });
      } catch (error) {
        console.error(`Error calling endpoint ${endpoint}:`, error);
        return res.json({
          success: true,
          agent: {
            intent: 'general_chat',
            response: `I encountered an error while trying to ${apiEndpoint.description.toLowerCase()}. Please try again later.`
          }
        });
      }
      
      return res.json({
        success: true,
        agent: {
          intent: 'endpoint_call',
          endpoint,
          parameters,
          response: agentResponse.response,
          result
        }
      });
    } else {
      // For general chat, just return the response
      return res.json({
        success: true,
        agent: {
          intent: 'general_chat',
          response: agentResponse.response
        }
      });
    }
  } catch (error) {
    console.error('Error processing agent request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process request'
    });
  }
});

// General chat endpoint
app.post('/api/chat/general', async (req, res) => {
  try {
    const { message, userId } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }
    
    const result = await model.generateContent([
      { text: "You are a helpful AI assistant for the SimAlly application. Provide concise, accurate, and helpful responses to the user's questions.", role: 'system' },
      { text: message, role: 'user' }
    ]);
    
    const response = result.response.text();
    
    res.json({
      success: true,
      response
    });
  } catch (error) {
    console.error('Error in general chat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process chat request'
    });
  }
});

// Gmail auth URL endpoint
app.get('/api/gmail/auth-url', (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.labels'
    ];
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: userId
    });
    
    res.json({
      success: true,
      authUrl
    });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate auth URL'
    });
  }
});

// Gmail auth callback endpoint
app.get('/auth/gmail/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const userId = state;
    
    if (!code || !userId) {
      return res.status(400).send('Missing required parameters');
    }
    
    const { tokens } = await oauth2Client.getToken(code);
    
    // Store tokens in database
    const { error } = await supabase
      .from('gmail_tokens')
      .upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: tokens.token_type,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        scope: tokens.scope
      });
    
    if (error) {
      console.error('Error storing tokens:', error);
      return res.status(500).send('Failed to store tokens');
    }
    
    // Redirect back to the application
    res.redirect(`${FRONTEND_URL}/assistant?gmail_connected=true`);
  } catch (error) {
    console.error('Error in auth callback:', error);
    res.status(500).send('Authentication failed');
  }
});

// Gmail status endpoint
app.get('/api/gmail/status', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    const { data, error } = await supabase
      .from('gmail_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) {
      return res.json({
        connected: false
      });
    }
    
    // Check if token is expired
    if (new Date(data.expires_at) < new Date()) {
      // Token is expired, try to refresh
      try {
        oauth2Client.setCredentials({
          refresh_token: data.refresh_token
        });
        
        const { credentials } = await oauth2Client.refreshAccessToken();
        
        // Update tokens in database
        await supabase
          .from('gmail_tokens')
          .update({
            access_token: credentials.access_token,
            expires_at: new Date(Date.now() + credentials.expires_in * 1000).toISOString()
          })
          .eq('user_id', userId);
        
        return res.json({
          connected: true,
          email: await getGmailEmail(credentials.access_token)
        });
      } catch (refreshError) {
        console.error('Error refreshing token:', refreshError);
        return res.json({
          connected: false,
          error: 'Token expired and refresh failed'
        });
      }
    }
    
    // Token is valid
    return res.json({
      connected: true,
      email: await getGmailEmail(data.access_token)
    });
  } catch (error) {
    console.error('Error checking Gmail status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check Gmail status'
    });
  }
});

// Gmail disconnect endpoint
app.post('/api/gmail/disconnect', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    const { error } = await supabase
      .from('gmail_tokens')
      .delete()
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error disconnecting Gmail:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to disconnect Gmail'
      });
    }
    
    res.json({
      success: true
    });
  } catch (error) {
    console.error('Error disconnecting Gmail:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect Gmail'
    });
  }
});

// Get unread emails endpoint
app.get('/api/gmail/unread', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    const accessToken = await getAccessToken(userId);
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Gmail not connected'
      });
    }
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
      maxResults: 10
    });
    
    const messages = response.data.messages || [];
    const emails = await Promise.all(messages.map(async (message) => {
      return await getEmailDetails(gmail, message.id);
    }));
    
    res.json({
      success: true,
      emails
    });
  } catch (error) {
    console.error('Error getting unread emails:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get unread emails'
    });
  }
});

// Search emails endpoint
app.get('/api/gmail/search', async (req, res) => {
  try {
    const { userId, query } = req.query;
    
    if (!userId || !query) {
      return res.status(400).json({
        success: false,
        error: 'User ID and query are required'
      });
    }
    
    const accessToken = await getAccessToken(userId);
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Gmail not connected'
      });
    }
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 10
    });
    
    const messages = response.data.messages || [];
    const emails = await Promise.all(messages.map(async (message) => {
      return await getEmailDetails(gmail, message.id);
    }));
    
    res.json({
      success: true,
      emails
    });
  } catch (error) {
    console.error('Error searching emails:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search emails'
    });
  }
});

// Get promotional emails endpoint
app.get('/api/gmail/promotional', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    const accessToken = await getAccessToken(userId);
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Gmail not connected'
      });
    }
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'category:promotions',
      maxResults: 10
    });
    
    const messages = response.data.messages || [];
    const emails = await Promise.all(messages.map(async (message) => {
      const email = await getEmailDetails(gmail, message.id);
      
      // Try to extract unsubscribe link
      try {
        const fullEmail = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full'
        });
        
        const headers = fullEmail.data.payload.headers;
        const listUnsubscribe = headers.find(h => h.name.toLowerCase() === 'list-unsubscribe');
        
        if (listUnsubscribe) {
          const match = listUnsubscribe.value.match(/<(https?:\/\/[^>]+)>/);
          if (match) {
            email.unsubscribeUrl = match[1];
          }
        }
      } catch (error) {
        console.error('Error extracting unsubscribe link:', error);
      }
      
      return email;
    }));
    
    res.json({
      success: true,
      emails
    });
  } catch (error) {
    console.error('Error getting promotional emails:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get promotional emails'
    });
  }
});

// Delete emails endpoint
app.post('/api/gmail/delete-emails', async (req, res) => {
  try {
    const { userId, messageIds } = req.body;
    
    if (!userId || !messageIds || !Array.isArray(messageIds)) {
      return res.status(400).json({
        success: false,
        error: 'User ID and message IDs array are required'
      });
    }
    
    const accessToken = await getAccessToken(userId);
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Gmail not connected'
      });
    }
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    oauth2Client.setCredentials({ access_token: accessToken });
    
    let deleted = 0;
    let failed = 0;
    
    for (const messageId of messageIds) {
      try {
        await gmail.users.messages.trash({
          userId: 'me',
          id: messageId
        });
        deleted++;
      } catch (error) {
        console.error(`Error deleting message ${messageId}:`, error);
        failed++;
      }
    }
    
    res.json({
      success: true,
      deleted,
      failed
    });
  } catch (error) {
    console.error('Error deleting emails:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete emails'
    });
  }
});

// Get email details endpoint
app.get('/api/gmail/email/:emailId', async (req, res) => {
  try {
    const { emailId } = req.params;
    const { userId } = req.query;
    
    if (!userId || !emailId) {
      return res.status(400).json({
        success: false,
        error: 'User ID and email ID are required'
      });
    }
    
    const accessToken = await getAccessToken(userId);
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Gmail not connected'
      });
    }
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: emailId,
      format: 'full'
    });
    
    const email = await getEmailDetails(gmail, emailId, true);
    
    res.json({
      success: true,
      email
    });
  } catch (error) {
    console.error('Error getting email details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get email details'
    });
  }
});

// Create task endpoint
app.post('/api/tasks/create', async (req, res) => {
  try {
    const { userId, title, description, priority, dueDate } = req.body;
    
    if (!userId || !title) {
      return res.status(400).json({
        success: false,
        error: 'User ID and title are required'
      });
    }
    
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title,
        description: description || null,
        priority: priority || 'medium',
        due_date: dueDate || null,
        created_by: userId
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating task:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create task'
      });
    }
    
    res.json({
      success: true,
      task: data
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create task'
    });
  }
});

// Get tasks endpoint
app.get('/api/tasks/list', async (req, res) => {
  try {
    const { userId, status } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    let query = supabase
      .from('tasks')
      .select(`
        *,
        assignments:task_assignments(
          user_id,
          user:profiles(*)
        )
      `)
      .or(`created_by.eq.${userId},assignments.user_id.eq.${userId}`);
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error getting tasks:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get tasks'
      });
    }
    
    res.json({
      success: true,
      tasks: data
    });
  } catch (error) {
    console.error('Error getting tasks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get tasks'
    });
  }
});

// Create calendar event endpoint
app.post('/api/calendar/create', async (req, res) => {
  try {
    const { userId, title, description, startTime, endTime } = req.body;
    
    if (!userId || !title || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: 'User ID, title, start time, and end time are required'
      });
    }
    
    const { data, error } = await supabase
      .from('calendar_events')
      .insert({
        title,
        description: description || null,
        start_time: startTime,
        end_time: endTime,
        user_id: userId
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating calendar event:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create calendar event'
      });
    }
    
    res.json({
      success: true,
      event: data
    });
  } catch (error) {
    console.error('Error creating calendar event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create calendar event'
    });
  }
});

// Get calendar events endpoint
app.get('/api/calendar/list', async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    let query = supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId);
    
    if (startDate) {
      query = query.gte('start_time', startDate);
    }
    
    if (endDate) {
      query = query.lte('start_time', endDate);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error getting calendar events:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get calendar events'
      });
    }
    
    res.json({
      success: true,
      events: data
    });
  } catch (error) {
    console.error('Error getting calendar events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get calendar events'
    });
  }
});

// Create meeting room endpoint
app.post('/api/meetings/create', async (req, res) => {
  try {
    const { userId, title } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    // Generate a unique room name
    const roomName = `${title || 'meeting'}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    res.json({
      success: true,
      room: {
        name: roomName,
        url: `${FRONTEND_URL}/meetings?room=${encodeURIComponent(roomName)}`
      }
    });
  } catch (error) {
    console.error('Error creating meeting room:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create meeting room'
    });
  }
});

// Generate document endpoint
app.post('/api/documents/generate', async (req, res) => {
  try {
    const { userId, type, parameters } = req.body;
    
    if (!userId || !type) {
      return res.status(400).json({
        success: false,
        error: 'User ID and document type are required'
      });
    }
    
    // Generate document content based on type and parameters
    let content = '';
    let title = '';
    
    switch (type) {
      case 'proposal':
        title = parameters?.title || 'Project Proposal';
        content = await generateProposal(parameters);
        break;
      case 'report':
        title = parameters?.title || 'Report';
        content = await generateReport(parameters);
        break;
      case 'resume':
        title = parameters?.name ? `${parameters.name}'s Resume` : 'Resume';
        content = await generateResume(parameters);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid document type'
        });
    }
    
    res.json({
      success: true,
      document: {
        title,
        content,
        type
      }
    });
  } catch (error) {
    console.error('Error generating document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate document'
    });
  }
});

// Start game endpoint
app.post('/api/games/start', async (req, res) => {
  try {
    const { userId, gameType } = req.body;
    
    if (!userId || !gameType) {
      return res.status(400).json({
        success: false,
        error: 'User ID and game type are required'
      });
    }
    
    // Call the game API to create a conversation
    const gameApiUrl = `${process.env.API_URL || 'http://localhost:8000'}/api/create-${gameType}-conversation`;
    
    const response = await fetch(gameApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId
      })
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to create game conversation');
    }
    
    res.json({
      success: true,
      conversation_id: data.conversation_id,
      conversation_url: data.conversation_url,
      game_type: data.game_type
    });
  } catch (error) {
    console.error('Error starting game:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start game'
    });
  }
});

// Meeting auto-notes endpoint
app.post('/api/meetings/auto-notes', async (req, res) => {
  try {
    const { text, speaker, userId } = req.body;
    
    if (!text || !speaker) {
      return res.status(400).json({
        success: false,
        error: 'Text and speaker are required'
      });
    }
    
    // Generate notes from the text
    const prompt = `
      Extract key points, action items, and decisions from this meeting transcript segment:
      
      Speaker: ${speaker}
      Text: "${text}"
      
      Provide a concise summary of important information. If there are action items or decisions, highlight them.
      Keep it brief and focused on the most important information.
    `;
    
    const result = await model.generateContent(prompt);
    const notes = result.response.text();
    
    res.json({
      success: true,
      notes,
      speaker,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating auto-notes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate notes'
    });
  }
});

// Meeting summary endpoint
app.post('/api/meetings/summary', async (req, res) => {
  try {
    const { transcript, participants, duration } = req.body;
    
    if (!transcript) {
      return res.status(400).json({
        success: false,
        error: 'Transcript is required'
      });
    }
    
    // Generate meeting summary
    const prompt = `
      Generate a comprehensive meeting summary from this transcript:
      
      ${transcript}
      
      Participants: ${participants ? participants.join(', ') : 'Multiple participants'}
      Duration: ${duration || 'Unknown'} minutes
      
      Include:
      1. Key discussion points
      2. Decisions made
      3. Action items with assignees (if mentioned)
      4. Next steps
      
      Format the summary in a clear, professional way.
    `;
    
    const result = await model.generateContent(prompt);
    const summary = result.response.text();
    
    res.json({
      success: true,
      summary,
      participants,
      duration
    });
  } catch (error) {
    console.error('Error generating meeting summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate meeting summary'
    });
  }
});

// Helper functions
async function getAccessToken(userId) {
  const { data, error } = await supabase
    .from('gmail_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  // Check if token is expired
  if (new Date(data.expires_at) < new Date()) {
    // Token is expired, try to refresh
    try {
      oauth2Client.setCredentials({
        refresh_token: data.refresh_token
      });
      
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      // Update tokens in database
      await supabase
        .from('gmail_tokens')
        .update({
          access_token: credentials.access_token,
          expires_at: new Date(Date.now() + credentials.expires_in * 1000).toISOString()
        })
        .eq('user_id', userId);
      
      return credentials.access_token;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return null;
    }
  }
  
  return data.access_token;
}

async function getGmailEmail(accessToken) {
  try {
    oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const profile = await gmail.users.getProfile({
      userId: 'me'
    });
    
    return profile.data.emailAddress;
  } catch (error) {
    console.error('Error getting Gmail email:', error);
    return null;
  }
}

async function getEmailDetails(gmail, messageId, includeBody = false) {
  try {
    const message = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: includeBody ? 'full' : 'metadata',
      metadataHeaders: ['From', 'Subject', 'Date']
    });
    
    const headers = message.data.payload.headers;
    const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
    const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
    const date = headers.find(h => h.name === 'Date')?.value || new Date().toISOString();
    
    const email = {
      id: messageId,
      threadId: message.data.threadId,
      from,
      subject,
      date,
      snippet: message.data.snippet,
      isUnread: message.data.labelIds.includes('UNREAD')
    };
    
    if (includeBody) {
      email.body = getEmailBody(message.data.payload);
    }
    
    return email;
  } catch (error) {
    console.error(`Error getting email details for ${messageId}:`, error);
    return {
      id: messageId,
      from: 'Error',
      subject: 'Could not load email',
      date: new Date().toISOString(),
      snippet: 'Error loading email details',
      isUnread: false
    };
  }
}

function getEmailBody(payload) {
  if (!payload) return '';
  
  if (payload.body && payload.body.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf8');
  }
  
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body && part.body.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf8');
      }
    }
    
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf8');
      }
    }
    
    // Recursively check nested parts
    for (const part of payload.parts) {
      if (part.parts) {
        const body = getEmailBody(part);
        if (body) return body;
      }
    }
  }
  
  return '';
}

async function generateProposal(parameters = {}) {
  const { title, client, scope, budget, timeline } = parameters;
  
  const prompt = `
    Generate a professional project proposal with the following details:
    
    Title: ${title || 'Project Proposal'}
    Client: ${client || 'Client Name'}
    Scope: ${scope || 'Project scope and objectives'}
    Budget: ${budget || 'Project budget'}
    Timeline: ${timeline || 'Project timeline'}
    
    Include sections for:
    1. Executive Summary
    2. Project Scope
    3. Methodology
    4. Timeline
    5. Budget
    6. Team
    7. Terms and Conditions
    
    Format as clean HTML that can be easily styled.
  `;
  
  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function generateReport(parameters = {}) {
  const { title, type, data, period } = parameters;
  
  const prompt = `
    Generate a professional ${type || 'business'} report with the following details:
    
    Title: ${title || 'Report'}
    Period: ${period || 'Q2 2023'}
    Data: ${data || 'Sample data and metrics'}
    
    Include sections for:
    1. Executive Summary
    2. Key Findings
    3. Detailed Analysis
    4. Recommendations
    5. Conclusion
    
    Format as clean HTML that can be easily styled.
  `;
  
  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function generateResume(parameters = {}) {
  const { name, experience, education, skills } = parameters;
  
  const prompt = `
    Generate a professional resume with the following details:
    
    Name: ${name || 'John Doe'}
    Experience: ${experience || 'Work experience details'}
    Education: ${education || 'Education details'}
    Skills: ${skills || 'Technical and soft skills'}
    
    Include sections for:
    1. Contact Information
    2. Professional Summary
    3. Work Experience
    4. Education
    5. Skills
    6. Certifications (if applicable)
    
    Format as clean HTML that can be easily styled.
  `;
  
  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function callEndpoint(endpoint, parameters) {
  switch (endpoint.name) {
    case 'getUnreadEmails':
      return await getUnreadEmails(parameters.userId);
    case 'searchEmails':
      return await searchEmails(parameters.userId, parameters.query);
    case 'getPromotionalEmails':
      return await getPromotionalEmails(parameters.userId);
    case 'deleteEmails':
      return await deleteEmails(parameters.userId, parameters.messageIds);
    case 'createTask':
      return await createTask(parameters);
    case 'getTasks':
      return await getTasks(parameters.userId, parameters.status);
    case 'createCalendarEvent':
      return await createCalendarEvent(parameters);
    case 'getCalendarEvents':
      return await getCalendarEvents(parameters.userId, parameters.startDate, parameters.endDate);
    case 'createMeetingRoom':
      return await createMeetingRoom(parameters.userId, parameters.title);
    case 'generateDocument':
      return await generateDocument(parameters.userId, parameters.type, parameters);
    case 'startGame':
      return await startGame(parameters.userId, parameters.gameType);
    case 'generalChat':
      return await generalChat(parameters.userId, parameters.message);
    default:
      throw new Error(`Unknown endpoint: ${endpoint.name}`);
  }
}

async function getUnreadEmails(userId) {
  const accessToken = await getAccessToken(userId);
  if (!accessToken) {
    throw new Error('Gmail not connected');
  }
  
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  
  const response = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread',
    maxResults: 10
  });
  
  const messages = response.data.messages || [];
  const emails = await Promise.all(messages.map(async (message) => {
    return await getEmailDetails(gmail, message.id);
  }));
  
  return { emails };
}

async function searchEmails(userId, query) {
  const accessToken = await getAccessToken(userId);
  if (!accessToken) {
    throw new Error('Gmail not connected');
  }
  
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  
  const response = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 10
  });
  
  const messages = response.data.messages || [];
  const emails = await Promise.all(messages.map(async (message) => {
    return await getEmailDetails(gmail, message.id);
  }));
  
  return { emails };
}

async function getPromotionalEmails(userId) {
  const accessToken = await getAccessToken(userId);
  if (!accessToken) {
    throw new Error('Gmail not connected');
  }
  
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  
  const response = await gmail.users.messages.list({
    userId: 'me',
    q: 'category:promotions',
    maxResults: 10
  });
  
  const messages = response.data.messages || [];
  const emails = await Promise.all(messages.map(async (message) => {
    const email = await getEmailDetails(gmail, message.id);
    
    // Try to extract unsubscribe link
    try {
      const fullEmail = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'full'
      });
      
      const headers = fullEmail.data.payload.headers;
      const listUnsubscribe = headers.find(h => h.name.toLowerCase() === 'list-unsubscribe');
      
      if (listUnsubscribe) {
        const match = listUnsubscribe.value.match(/<(https?:\/\/[^>]+)>/);
        if (match) {
          email.unsubscribeUrl = match[1];
        }
      }
    } catch (error) {
      console.error('Error extracting unsubscribe link:', error);
    }
    
    return email;
  }));
  
  return { emails };
}

async function deleteEmails(userId, messageIds) {
  const accessToken = await getAccessToken(userId);
  if (!accessToken) {
    throw new Error('Gmail not connected');
  }
  
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  
  let deleted = 0;
  let failed = 0;
  
  for (const messageId of messageIds) {
    try {
      await gmail.users.messages.trash({
        userId: 'me',
        id: messageId
      });
      deleted++;
    } catch (error) {
      console.error(`Error deleting message ${messageId}:`, error);
      failed++;
    }
  }
  
  return { deleted, failed };
}

async function createTask(parameters) {
  const { userId, title, description, priority, dueDate } = parameters;
  
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title,
      description: description || null,
      priority: priority || 'medium',
      due_date: dueDate || null,
      created_by: userId
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create task: ${error.message}`);
  }
  
  return { task: data };
}

async function getTasks(userId, status) {
  let query = supabase
    .from('tasks')
    .select(`
      *,
      assignments:task_assignments(
        user_id,
        user:profiles(*)
      )
    `)
    .or(`created_by.eq.${userId},assignments.user_id.eq.${userId}`);
  
  if (status) {
    query = query.eq('status', status);
  }
  
  const { data, error } = await query;
  
  if (error) {
    throw new Error(`Failed to get tasks: ${error.message}`);
  }
  
  return { tasks: data };
}

async function createCalendarEvent(parameters) {
  const { userId, title, description, startTime, endTime } = parameters;
  
  const { data, error } = await supabase
    .from('calendar_events')
    .insert({
      title,
      description: description || null,
      start_time: startTime,
      end_time: endTime,
      user_id: userId
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create calendar event: ${error.message}`);
  }
  
  return { event: data };
}

async function getCalendarEvents(userId, startDate, endDate) {
  let query = supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', userId);
  
  if (startDate) {
    query = query.gte('start_time', startDate);
  }
  
  if (endDate) {
    query = query.lte('start_time', endDate);
  }
  
  const { data, error } = await query;
  
  if (error) {
    throw new Error(`Failed to get calendar events: ${error.message}`);
  }
  
  return { events: data };
}

async function createMeetingRoom(userId, title) {
  // Generate a unique room name
  const roomName = `${title || 'meeting'}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  
  return {
    room: {
      name: roomName,
      url: `${FRONTEND_URL}/meetings?room=${encodeURIComponent(roomName)}`
    }
  };
}

async function generateDocument(userId, type, parameters) {
  let content = '';
  let title = '';
  
  switch (type) {
    case 'proposal':
      title = parameters?.title || 'Project Proposal';
      content = await generateProposal(parameters);
      break;
    case 'report':
      title = parameters?.title || 'Report';
      content = await generateReport(parameters);
      break;
    case 'resume':
      title = parameters?.name ? `${parameters.name}'s Resume` : 'Resume';
      content = await generateResume(parameters);
      break;
    default:
      throw new Error('Invalid document type');
  }
  
  return {
    document: {
      title,
      content,
      type
    }
  };
}

async function startGame(userId, gameType) {
  // Call the game API to create a conversation
  const gameApiUrl = `${process.env.API_URL || 'http://localhost:8000'}/api/create-${gameType}-conversation`;
  
  const response = await fetch(gameApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      user_id: userId
    })
  });
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Failed to create game conversation');
  }
  
  return {
    conversation_id: data.conversation_id,
    conversation_url: data.conversation_url,
    game_type: data.game_type
  };
}

async function generalChat(userId, message) {
  const result = await model.generateContent([
    { text: "You are a helpful AI assistant for the SimAlly application. Provide concise, accurate, and helpful responses to the user's questions.", role: 'system' },
    { text: message, role: 'user' }
  ]);
  
  const response = result.response.text();
  
  return { response };
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'ai-assistant',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`AI Assistant server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});