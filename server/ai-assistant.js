const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
require('dotenv').config();
const { tokenStore } = require('./google-api');

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

// Initialize OAuth2 client for Gmail
const oauth2Client = new OAuth2Client(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

// Store active AI sessions
const activeSessions = new Map();

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

// Add security headers
app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Complete endpoint mapping for our webapp with ALL available functions
const WEBAPP_ENDPOINTS = {
  // Gmail Management
  gmail_status: {
    endpoint: '/api/gmail/status',
    method: 'GET',
    description: 'Check Gmail connection status for user',
    parameters: ['userId'],
    example: 'Check my Gmail status',
    implementation: 'executeGmailStatus'
  },
  gmail_connect: {
    endpoint: '/api/gmail/auth-url',
    method: 'GET',
    description: 'Get Gmail OAuth URL for connection',
    parameters: ['userId'],
    example: 'Connect my Gmail account',
    implementation: 'executeGmailConnect'
  },
  gmail_disconnect: {
    endpoint: '/api/gmail/disconnect',
    method: 'POST',
    description: 'Disconnect Gmail account',
    parameters: ['userId'],
    example: 'Disconnect Gmail',
    implementation: 'executeGmailDisconnect'
  },
  gmail_get_emails: {
    endpoint: '/api/gmail/emails',
    method: 'GET',
    description: 'Get emails with optional query filter',
    parameters: ['userId', 'query?', 'maxResults?'],
    example: 'Show my emails',
    implementation: 'executeGmailGetEmails'
  },
  gmail_unread: {
    endpoint: '/api/gmail/emails',
    method: 'GET',
    description: 'Get unread emails',
    parameters: ['userId', 'maxResults?'],
    example: 'Show my unread emails',
    implementation: 'executeGmailUnread'
  },
  gmail_search: {
    endpoint: '/api/gmail/emails',
    method: 'GET',
    description: 'Search emails by query',
    parameters: ['userId', 'query', 'maxResults?'],
    example: 'Search emails for "project update"',
    implementation: 'executeGmailSearch'
  },
  gmail_search_sender: {
    endpoint: '/api/gmail/emails',
    method: 'GET',
    description: 'Search emails by sender',
    parameters: ['userId', 'sender', 'maxResults?'],
    example: 'Show emails from john@company.com',
    implementation: 'executeGmailSearchSender'
  },
  gmail_get_email: {
    endpoint: '/api/gmail/email/:id',
    method: 'GET',
    description: 'Get full email content by ID',
    parameters: ['userId', 'emailId'],
    example: 'Show full email content',
    implementation: 'executeGmailGetEmail'
  },
  gmail_delete_emails: {
    endpoint: '/api/gmail/delete-emails',
    method: 'POST',
    description: 'Delete multiple emails',
    parameters: ['userId', 'messageIds'],
    example: 'Delete selected emails',
    implementation: 'executeGmailDeleteEmails'
  },
  gmail_summarize: {
    endpoint: '/api/gmail/summarize-emails',
    method: 'POST',
    description: 'AI summarize emails',
    parameters: ['userId', 'messageIds'],
    example: 'Summarize my recent emails',
    implementation: 'executeGmailSummarize'
  },
  gmail_extract_tasks: {
    endpoint: '/api/gmail/extract-tasks-events',
    method: 'POST',
    description: 'Extract tasks and events from emails',
    parameters: ['userId', 'messageIds'],
    example: 'Extract tasks from my emails',
    implementation: 'executeGmailExtractTasks'
  },
  gmail_promotions: {
    endpoint: '/api/gmail/promotions',
    method: 'GET',
    description: 'Get promotional and marketing emails with unsubscribe links',
    parameters: ['userId', 'maxResults?'],
    example: 'Show my promotional emails',
    implementation: 'executeGmailPromotions'
  },

  // Workspace Management
  workspace_channels: {
    endpoint: '/api/workspace/channels',
    method: 'GET',
    description: 'Get user channels',
    parameters: ['userId'],
    example: 'Show my channels',
    implementation: 'executeWorkspaceChannels'
  },
  workspace_create_channel: {
    endpoint: '/api/workspace/channels',
    method: 'POST',
    description: 'Create new channel',
    parameters: ['name', 'description?', 'type', 'created_by'],
    example: 'Create a channel called "project-alpha"',
    implementation: 'executeWorkspaceCreateChannel'
  },
  workspace_messages: {
    endpoint: '/api/workspace/messages/:channelId',
    method: 'GET',
    description: 'Get channel messages',
    parameters: ['channelId'],
    example: 'Show messages from general channel',
    implementation: 'executeWorkspaceMessages'
  },
  workspace_send_message: {
    endpoint: '/api/workspace/messages',
    method: 'POST',
    description: 'Send message to channel',
    parameters: ['channel_id', 'sender_id', 'content', 'type?', 'metadata?'],
    example: 'Send message to team channel',
    implementation: 'executeWorkspaceSendMessage'
  },
  workspace_tasks: {
    endpoint: '/api/workspace/tasks',
    method: 'GET',
    description: 'Get user tasks',
    parameters: ['userId'],
    example: 'Show my tasks',
    implementation: 'executeWorkspaceTasks'
  },
  workspace_create_task: {
    endpoint: '/api/workspace/tasks',
    method: 'POST',
    description: 'Create new task',
    parameters: ['title', 'description?', 'priority?', 'due_date?', 'created_by'],
    example: 'Create task "Review project proposal"',
    implementation: 'executeWorkspaceCreateTask'
  },
  workspace_update_task: {
    endpoint: '/api/workspace/tasks/:id',
    method: 'PUT',
    description: 'Update task status or details',
    parameters: ['taskId', 'status?', 'priority?', 'due_date?'],
    example: 'Mark task as completed',
    implementation: 'executeWorkspaceUpdateTask'
  },
  workspace_assign_task: {
    endpoint: '/api/workspace/task-assignments',
    method: 'POST',
    description: 'Assign task to user',
    parameters: ['task_id', 'user_id'],
    example: 'Assign task to team member',
    implementation: 'executeWorkspaceAssignTask'
  },

  // Calendar Management
  calendar_events: {
    endpoint: '/api/calendar/events',
    method: 'GET',
    description: 'Get calendar events',
    parameters: ['userId', 'start_date?', 'end_date?'],
    example: 'Show my calendar events',
    implementation: 'executeCalendarEvents'
  },
  calendar_create_event: {
    endpoint: '/api/calendar/events',
    method: 'POST',
    description: 'Create calendar event',
    parameters: ['title', 'description?', 'start_time', 'end_time', 'user_id', 'task_id?'],
    example: 'Schedule meeting for tomorrow 2pm',
    implementation: 'executeCalendarCreateEvent'
  },
  calendar_update_event: {
    endpoint: '/api/calendar/events/:id',
    method: 'PUT',
    description: 'Update calendar event',
    parameters: ['eventId', 'title?', 'start_time?', 'end_time?'],
    example: 'Reschedule meeting to 3pm',
    implementation: 'executeCalendarUpdateEvent'
  },
  calendar_delete_event: {
    endpoint: '/api/calendar/events/:id',
    method: 'DELETE',
    description: 'Delete calendar event',
    parameters: ['eventId'],
    example: 'Cancel tomorrow meeting',
    implementation: 'executeCalendarDeleteEvent'
  },

  // Meeting Management
  meeting_create_room: {
    endpoint: '/api/meetings/create-room',
    method: 'POST',
    description: 'Create video meeting room',
    parameters: ['roomName', 'displayName'],
    example: 'Create meeting room for daily standup',
    implementation: 'executeMeetingCreateRoom'
  },
  meeting_join_room: {
    endpoint: '/api/meetings/join-room',
    method: 'POST',
    description: 'Join video meeting room',
    parameters: ['roomName', 'displayName'],
    example: 'Join meeting room "daily-standup"',
    implementation: 'executeMeetingJoinRoom'
  },
  meeting_auto_notes: {
    endpoint: '/api/meetings/auto-notes',
    method: 'POST',
    description: 'Generate meeting notes from text',
    parameters: ['text', 'speaker', 'userId'],
    example: 'Generate notes from meeting transcript',
    implementation: 'executeMeetingAutoNotes'
  },
  meeting_summary: {
    endpoint: '/api/meetings/summary',
    method: 'POST',
    description: 'Generate meeting summary',
    parameters: ['transcript', 'participants', 'duration'],
    example: 'Summarize our team meeting',
    implementation: 'executeMeetingSummary'
  },

  // Game Mode
  game_riddle: {
    endpoint: '/api/create-riddle-conversation',
    method: 'POST',
    description: 'Start riddle game',
    parameters: ['user_id?'],
    example: 'Start riddle game',
    implementation: 'executeGameRiddle'
  },
  game_twenty_questions_user: {
    endpoint: '/api/create-twenty-questions-user-asks',
    method: 'POST',
    description: 'Start 20 questions (user asks)',
    parameters: ['user_id?'],
    example: 'Play 20 questions where I ask',
    implementation: 'executeGameTwentyQuestionsUser'
  },
  game_twenty_questions_ai: {
    endpoint: '/api/create-twenty-questions-ai-asks',
    method: 'POST',
    description: 'Start 20 questions (AI asks)',
    parameters: ['user_id?'],
    example: 'Play 20 questions where AI asks',
    implementation: 'executeGameTwentyQuestionsAI'
  },
  game_end_conversation: {
    endpoint: '/api/end-conversation',
    method: 'POST',
    description: 'End game conversation',
    parameters: ['user_id'],
    example: 'End current game',
    implementation: 'executeGameEndConversation'
  },

  // Document Generation
  document_generate: {
    endpoint: '/api/documents/generate',
    method: 'POST',
    description: 'Generate document with AI',
    parameters: ['prompt', 'documentType?', 'format?'],
    example: 'Generate project proposal document',
    implementation: 'executeDocumentGenerate'
  },
  document_latex_to_pdf: {
    endpoint: '/api/documents/latex-to-pdf',
    method: 'POST',
    description: 'Convert LaTeX to PDF',
    parameters: ['latexContent', 'filename?'],
    example: 'Convert LaTeX document to PDF',
    implementation: 'executeDocumentLatexToPdf'
  },

  // Chat Processing
  chat_process_message: {
    endpoint: '/api/chat/process-message',
    method: 'POST',
    description: 'Process message for AI task detection',
    parameters: ['message', 'messageId', 'channelId', 'senderId', 'mentions?', 'userId'],
    example: 'Process chat message for tasks',
    implementation: 'executeChatProcessMessage'
  },

  // General Query (New)
  general_query: {
    endpoint: 'GENERAL_CHAT',
    method: 'CHAT',
    description: 'General conversation with AI assistant',
    parameters: ['message'],
    example: 'What is the weather like? How do I cook pasta? Explain quantum physics',
    implementation: 'executeGeneralQuery'
  }
};

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
    const sessionId = crypto.randomBytes(32).toString('hex');
    
    // Store session with timestamp
    activeSessions.set(sessionId, {
      userId,
      createdAt: new Date(),
      lastActivity: new Date(),
      history: []
    });
    
    console.log(`AI session initialized for user: ${userId} with enhanced security`);
    
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

// General chat endpoint
app.post('/api/chat/general', async (req, res) => {
  try {
    const { message, userId } = req.body;
    
    if (!message || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Message and User ID are required'
      });
    }
    
    // Get or create session
    let sessionId = req.headers['x-session-id'];
    let session = sessionId ? activeSessions.get(sessionId) : null;
    
    if (!session) {
      sessionId = crypto.randomBytes(32).toString('hex');
      session = {
        userId,
        createdAt: new Date(),
        lastActivity: new Date(),
        history: []
      };
      activeSessions.set(sessionId, session);
    }
    
    // Update session activity
    session.lastActivity = new Date();
    
    // Add message to history
    session.history.push({
      role: 'user',
      content: message
    });
    
    // Generate AI response
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const chat = model.startChat({
      history: session.history
    });
    
    const result = await chat.sendMessage(message);
    const response = result.response.text();
    
    // Add response to history
    session.history.push({
      role: 'model',
      content: response
    });
    
    // Keep history limited to last 20 messages
    if (session.history.length > 20) {
      session.history = session.history.slice(-20);
    }
    
    res.json({
      success: true,
      response,
      sessionId
    });
  } catch (error) {
    console.error('Error in general chat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process message'
    });
  }
});

// Enhanced AI agent processing with complete endpoint access
app.post('/api/chat/agent-process', async (req, res) => {
  try {
    const { message, userId, context = {} } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    console.log(`Processing message: "${message}" for user: ${userId}`);

    // Create comprehensive prompt with all endpoints
    const endpointsList = Object.entries(WEBAPP_ENDPOINTS)
      .map(([key, config]) => `${key}: ${config.description} (${config.method} ${config.endpoint}) - Parameters: [${config.parameters.join(', ')}] - Example: "${config.example}"`)
      .join('\n');

    const systemPrompt = `You are SimAlly, a powerful AI assistant with access to a comprehensive webapp with ALL these capabilities:

AVAILABLE ENDPOINTS AND FUNCTIONS:
${endpointsList}

INSTRUCTIONS:
1. Analyze the user's message carefully and determine the best response approach
2. You can handle TWO types of requests:

   A) WEBAPP FUNCTIONALITY - If the message requires any webapp functionality, respond with JSON:
   {
     "type": "endpoint_call",
     "endpoint": "endpoint_key_from_list_above",
     "parameters": {
       "param1": "value1",
       "param2": "value2"
     },
     "response": "Brief explanation of what you're doing"
   }

   B) GENERAL CONVERSATION - If it's a general question/conversation, respond with JSON:
   {
     "type": "general_chat",
     "response": "Your helpful response to their question"
   }

3. For endpoint calls:
   - Use EXACT endpoint keys from the list above
   - Extract parameters from the user message intelligently
   - Calculate dates/times when needed (e.g., "tomorrow" = tomorrow's date in YYYY-MM-DD format)
   - Use the provided userId: "${userId}" when needed
   - For optional parameters, only include if mentioned or relevant
   - Be smart about parameter extraction (e.g., extract email addresses, task titles, etc.)
   - For promotional/marketing emails, use the gmail_promotions endpoint. If the user wants to unsubscribe, include the unsubscribeUrl in the response if available.

4. For general chat:
   - Answer questions about any topic (weather, cooking, science, etc.)
   - Provide helpful information and explanations
   - Be conversational and friendly
   - Don't mention technical endpoints or implementation details

5. You have access to ALL these functions:
   - Gmail management (read, search, delete, summarize emails, find promotional/marketing emails, unsubscribe)
   - Workspace features (channels, messages, tasks, assignments)
   - Calendar management (events, scheduling)
   - Meeting tools (create rooms, notes, summaries)
   - Document generation (AI-powered content creation)
   - Game modes (riddles, 20 questions)
   - General conversation and knowledge

CONTEXT: ${JSON.stringify(context)}
USER MESSAGE: "${message}"

Analyze the message and respond with the appropriate JSON format. Be intelligent about recognizing what the user wants to do.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(systemPrompt);
    const aiResponse = result.response.text();

    console.log('AI Response:', aiResponse);

    // Parse AI response
    let parsedResponse;
    try {
      // Clean the response to extract JSON
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Fallback to general chat
      parsedResponse = {
        type: 'general_chat',
        response: aiResponse
      };
    }

    // Handle the response based on type
    if (parsedResponse.type === 'endpoint_call') {
      const endpointConfig = WEBAPP_ENDPOINTS[parsedResponse.endpoint];
      
      if (!endpointConfig) {
        return res.json({
          success: true,
          agent: {
            intent: 'general_chat',
            response: 'I apologize, but I couldn\'t find the appropriate function for your request. Could you please rephrase it?'
          }
        });
      }

      // Execute the endpoint function directly
      try {
        const result = await executeEndpointFunction(parsedResponse.endpoint, parsedResponse.parameters, userId);
        
        return res.json({
          success: true,
          agent: {
            intent: 'endpoint_call',
            endpoint: parsedResponse.endpoint,
            parameters: parsedResponse.parameters,
            response: parsedResponse.response,
            result: result,
            config: endpointConfig
          }
        });
      } catch (error) {
        console.error('Error executing endpoint:', error);
        return res.json({
          success: true,
          agent: {
            intent: 'general_chat',
            response: `I encountered an error while ${parsedResponse.response.toLowerCase()}. Please try again.`
          }
        });
      }

    } else {
      // General chat response
      res.json({
        success: true,
        agent: {
          intent: 'general_chat',
          response: parsedResponse.response
        }
      });
    }

  } catch (error) {
    console.error('Error in agent processing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process message with AI agent'
    });
  }
});

// Master function to execute any endpoint
async function executeEndpointFunction(endpoint, parameters, userId) {
  const config = WEBAPP_ENDPOINTS[endpoint];
  if (!config || !config.implementation) {
    throw new Error('Invalid endpoint or missing implementation');
  }

  // Add userId to parameters if not present
  if (!parameters.userId && userId) {
    parameters.userId = userId;
  }

  // Execute the appropriate function
  switch (config.implementation) {
    // Gmail functions
    case 'executeGmailStatus':
      return await executeGmailStatus(parameters.userId);
    case 'executeGmailConnect':
      return await executeGmailConnect(parameters.userId);
    case 'executeGmailDisconnect':
      return await executeGmailDisconnect(parameters.userId);
    case 'executeGmailGetEmails':
      return await executeGmailGetEmails(parameters.userId, parameters.query, parameters.maxResults);
    case 'executeGmailUnread':
      return await executeGmailUnread(parameters.userId, parameters.maxResults);
    case 'executeGmailSearch':
      return await executeGmailSearch(parameters.userId, parameters.query, parameters.maxResults);
    case 'executeGmailSearchSender':
      return await executeGmailSearchSender(parameters.userId, parameters.sender, parameters.maxResults);
    case 'executeGmailGetEmail':
      return await executeGmailGetEmail(parameters.userId, parameters.emailId);
    case 'executeGmailDeleteEmails':
      return await executeGmailDeleteEmails(parameters.userId, parameters.messageIds);
    case 'executeGmailSummarize':
      return await executeGmailSummarize(parameters.userId, parameters.messageIds);
    case 'executeGmailExtractTasks':
      return await executeGmailExtractTasks(parameters.userId, parameters.messageIds);
    case 'executeGmailPromotions':
      return await executeGmailPromotions(parameters.userId, parameters.maxResults);

    // Workspace functions
    case 'executeWorkspaceChannels':
      return await executeWorkspaceChannels(parameters.userId);
    case 'executeWorkspaceCreateChannel':
      return await executeWorkspaceCreateChannel(parameters);
    case 'executeWorkspaceMessages':
      return await executeWorkspaceMessages(parameters.channelId);
    case 'executeWorkspaceSendMessage':
      return await executeWorkspaceSendMessage(parameters);
    case 'executeWorkspaceTasks':
      return await executeWorkspaceTasks(parameters.userId);
    case 'executeWorkspaceCreateTask':
      return await executeWorkspaceCreateTask(parameters);
    case 'executeWorkspaceUpdateTask':
      return await executeWorkspaceUpdateTask(parameters.taskId, parameters);
    case 'executeWorkspaceAssignTask':
      return await executeWorkspaceAssignTask(parameters);

    // Calendar functions
    case 'executeCalendarEvents':
      return await executeCalendarEvents(parameters.userId, parameters.start_date, parameters.end_date);
    case 'executeCalendarCreateEvent':
      return await executeCalendarCreateEvent(parameters);
    case 'executeCalendarUpdateEvent':
      return await executeCalendarUpdateEvent(parameters.eventId, parameters);
    case 'executeCalendarDeleteEvent':
      return await executeCalendarDeleteEvent(parameters.eventId);

    // Meeting functions
    case 'executeMeetingCreateRoom':
      return await executeMeetingCreateRoom(parameters);
    case 'executeMeetingJoinRoom':
      return await executeMeetingJoinRoom(parameters);
    case 'executeMeetingAutoNotes':
      return await executeMeetingAutoNotes(parameters);
    case 'executeMeetingSummary':
      return await executeMeetingSummary(parameters);

    // Game functions
    case 'executeGameRiddle':
      return await executeGameRiddle(parameters.user_id);
    case 'executeGameTwentyQuestionsUser':
      return await executeGameTwentyQuestionsUser(parameters.user_id);
    case 'executeGameTwentyQuestionsAI':
      return await executeGameTwentyQuestionsAI(parameters.user_id);
    case 'executeGameEndConversation':
      return await executeGameEndConversation(parameters.user_id);

    // Document functions
    case 'executeDocumentGenerate':
      return await executeDocumentGenerate(parameters);
    case 'executeDocumentLatexToPdf':
      return await executeDocumentLatexToPdf(parameters);

    // Chat functions
    case 'executeChatProcessMessage':
      return await executeChatProcessMessage(parameters);

    // General query
    case 'executeGeneralQuery':
      return await executeGeneralQuery(parameters.message);

    default:
      throw new Error('Function implementation not found');
  }
}

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
    
    // Define expanded scopes for more access
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/drive.readonly'
    ];
    
    // Use userId directly as state instead of JSON to avoid parsing issues
    const state = userId;
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state,
      prompt: 'consent'
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

// Gmail auth callback
app.get('/auth/gmail/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.redirect(`${FRONTEND_URL}/assistant?gmail_error=true`);
    }
    
    // Use state directly as userId (no parsing needed)
    const userId = state;
    
    console.log(`Gmail OAuth callback for user: ${userId}`);
    
    // Exchange code for tokens with robust error handling
    let tokens;
    try {
      const tokenResponse = await oauth2Client.getToken(code.toString());
      tokens = tokenResponse.tokens;
      
      if (!tokens || !tokens.access_token) {
        console.error('Invalid token response:', tokenResponse);
        return res.redirect(`${FRONTEND_URL}/assistant?gmail_error=true`);
      }
      
      console.log('Received tokens from Google:', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiresIn: tokens.expires_in,
        expiryDate: tokens.expiry_date
      });
    } catch (tokenError) {
      console.error('Error getting tokens:', tokenError);
      return res.redirect(`${FRONTEND_URL}/assistant?gmail_error=true`);
    }
    
    // Generate a secure session token for encryption
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    // Store tokens in database
    try {
      const { data, error } = await supabase.rpc('store_encrypted_gmail_tokens_with_fallback', {
        p_user_id: userId,
        p_session_token: sessionToken,
        p_access_token: tokens.access_token,
        p_refresh_token: tokens.refresh_token || null,
        p_token_type: tokens.token_type || 'Bearer',
        p_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        p_scope: tokens.scope
      });
      
      if (error) {
        console.error('Error storing Gmail tokens:', error);
        return res.redirect(`${FRONTEND_URL}/assistant?gmail_error=true`);
      }
      
      if (!data || !data.success) {
        console.error('Failed to store Gmail tokens:', data?.error || 'Unknown error');
        return res.redirect(`${FRONTEND_URL}/assistant?gmail_error=true`);
      }
      
      console.log(`Gmail tokens stored securely for user ${userId}`);
    } catch (storageError) {
      console.error('Exception storing Gmail tokens:', storageError);
      return res.redirect(`${FRONTEND_URL}/assistant?gmail_error=true`);
    }
    
    // Redirect back to assistant page
    res.redirect(`${FRONTEND_URL}/assistant?gmail_connected=true`);
  } catch (error) {
    console.error('Error in Gmail callback:', error);
    res.redirect(`${FRONTEND_URL}/assistant?gmail_error=true`);
  }
});

// Refactored Gmail status endpoint
app.get('/api/gmail/status', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    console.log(`Gmail status check for user ${userId}: checking...`);

    // Retrieve tokens from tokenStore using session ID
    const sessionId = req.cookies.google_session_id;
    const tokens = tokenStore.get(sessionId);

    if (!tokens || !tokens.access_token) {
      return res.json({
        connected: false
      });
    }

    // Set up OAuth client with tokens
    oauth2Client.setCredentials(tokens);

    // Get Gmail profile to verify connection
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });

    // Get unread count
    const unreadResponse = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
      maxResults: 1
    });

    const unreadCount = unreadResponse.data.resultSizeEstimate || 0;

    res.json({
      connected: true,
      email: profile.data.emailAddress,
      unreadCount
    });
  } catch (error) {
    console.error('Error checking Gmail status:', error);
    res.json({
      connected: false,
      error: 'Failed to verify Gmail connection'
    });
  }
});

// Refactored Gmail disconnect endpoint
app.post('/api/gmail/disconnect', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    // Clear tokens from tokenStore
    const sessionId = req.cookies.google_session_id;
    tokenStore.delete(sessionId);

    res.json({
      success: true,
      message: 'Gmail disconnected successfully'
    });
  } catch (error) {
    console.error('Error disconnecting Gmail:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect Gmail'
    });
  }
});

// Gmail get emails endpoint
app.get('/api/gmail/emails', async (req, res) => {
  try {
    const { userId, query, maxResults = 10 } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    // Generate a session token for decryption
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    // Get tokens
    const { data, error } = await supabase.rpc('get_decrypted_gmail_tokens_with_fallback', {
      p_user_id: userId,
      p_session_token: sessionToken
    });
    
    if (error || !data.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to get Gmail tokens'
      });
    }
    
    // Set up OAuth client with tokens
    oauth2Client.setCredentials({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type,
      expiry_date: new Date(data.expires_at).getTime()
    });
    
    // Get emails
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query || '',
      maxResults: parseInt(maxResults.toString())
    });
    
    const messages = response.data.messages || [];
    const emails = [];
    
    // Get email details
    for (const message of messages) {
      const emailData = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date']
      });
      
      const headers = emailData.data.payload.headers;
      const from = headers.find(h => h.name === 'From')?.value || '';
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';
      
      emails.push({
        id: message.id,
        threadId: message.threadId,
        from,
        subject,
        date,
        snippet: emailData.data.snippet,
        isUnread: emailData.data.labelIds.includes('UNREAD')
      });
    }
    
    res.json({
      success: true,
      emails
    });
  } catch (error) {
    console.error('Error getting Gmail emails:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get emails'
    });
  }
});

// Gmail get email endpoint
app.get('/api/gmail/email/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;
    
    if (!userId || !id) {
      return res.status(400).json({
        success: false,
        error: 'User ID and Email ID are required'
      });
    }
    
    // Generate a session token for decryption
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    // Get tokens
    const { data, error } = await supabase.rpc('get_decrypted_gmail_tokens_with_fallback', {
      p_user_id: userId,
      p_session_token: sessionToken
    });
    
    if (error || !data.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to get Gmail tokens'
      });
    }
    
    // Set up OAuth client with tokens
    oauth2Client.setCredentials({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type,
      expiry_date: new Date(data.expires_at).getTime()
    });
    
    // Get email
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const response = await gmail.users.messages.get({
      userId: 'me',
      id,
      format: 'full'
    });
    
    const headers = response.data.payload.headers;
    const from = headers.find(h => h.name === 'From')?.value || '';
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    const date = headers.find(h => h.name === 'Date')?.value || '';
    
    // Extract body with improved handling
    let body = '';
    
    // Function to extract body parts recursively
    const extractBody = (part) => {
      if (part.mimeType === 'text/html' && part.body && part.body.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.mimeType === 'text/plain' && part.body && part.body.data && !body) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.parts) {
        for (const subPart of part.parts) {
          const extractedBody = extractBody(subPart);
          if (extractedBody) {
            return extractedBody;
          }
        }
      }
      return null;
    };
    
    // Try to get HTML body first
    if (response.data.payload.mimeType === 'text/html' && response.data.payload.body && response.data.payload.body.data) {
      body = Buffer.from(response.data.payload.body.data, 'base64').toString('utf-8');
    } else if (response.data.payload.parts) {
      for (const part of response.data.payload.parts) {
        const extractedBody = extractBody(part);
        if (extractedBody) {
          body = extractedBody;
          break;
        }
      }
    } else if (response.data.payload.body && response.data.payload.body.data) {
      body = Buffer.from(response.data.payload.body.data, 'base64').toString('utf-8');
    }
    
    // Check for unsubscribe link
    const unsubscribeHeader = headers.find(h => h.name.toLowerCase() === 'list-unsubscribe')?.value;
    let unsubscribeUrl = null;
    
    if (unsubscribeHeader) {
      const match = unsubscribeHeader.match(/<(https?:\/\/[^>]+)>/);
      if (match) {
        unsubscribeUrl = match[1];
      }
    }
    
    // If no unsubscribe header, try to find one in the body
    if (!unsubscribeUrl && body) {
      const unsubscribeRegex = /href=["'](https?:\/\/[^"']+unsubscribe[^"']+)["']/i;
      const match = body.match(unsubscribeRegex);
      if (match) {
        unsubscribeUrl = match[1];
      }
    }
    
    // Mark as read
    try {
      await gmail.users.messages.modify({
        userId: 'me',
        id: emailId,
        resource: {
          removeLabelIds: ['UNREAD']
        }
      });
    } catch (markError) {
      console.error('Error marking email as read:', markError);
      // Continue anyway, this is not critical
    }
    
    res.json({
      success: true,
      email: {
        id: emailId,
        threadId: response.data.threadId,
        from,
        subject,
        date,
        snippet: response.data.snippet,
        isUnread: response.data.labelIds.includes('UNREAD'),
        body,
        unsubscribeUrl
      }
    });
  } catch (error) {
    console.error('Error getting Gmail email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get email'
    });
  }
});

// Gmail delete emails endpoint
app.post('/api/gmail/delete-emails', async (req, res) => {
  try {
    const { userId, messageIds } = req.body;
    
    if (!userId || !messageIds || !Array.isArray(messageIds)) {
      return res.status(400).json({
        success: false,
        error: 'User ID and Message IDs are required'
      });
    }
    
    // Generate a session token for decryption
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    // Get tokens
    const { data, error } = await supabase.rpc('get_decrypted_gmail_tokens_with_fallback', {
      p_user_id: userId,
      p_session_token: sessionToken
    });
    
    if (error || !data.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to get Gmail tokens'
      });
    }
    
    // Set up OAuth client with tokens
    oauth2Client.setCredentials({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type,
      expiry_date: new Date(data.expires_at).getTime()
    });
    
    // Delete emails
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
        console.error(`Error deleting email ${messageId}:`, error);
        failed++;
      }
    }
    
    res.json({
      success: true,
      deleted,
      failed
    });
  } catch (error) {
    console.error('Error deleting Gmail emails:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete emails'
    });
  }
});

// Gmail summarize emails endpoint
app.post('/api/gmail/summarize-emails', async (req, res) => {
  try {
    const { userId, messageIds } = req.body;
    
    if (!userId || !messageIds || !Array.isArray(messageIds)) {
      return res.status(400).json({
        success: false,
        error: 'User ID and Message IDs are required'
      });
    }
    
    // Generate a session token for decryption
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    // Get tokens
    const { data, error } = await supabase.rpc('get_decrypted_gmail_tokens_with_fallback', {
      p_user_id: userId,
      p_session_token: sessionToken
    });
    
    if (error || !data.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to get Gmail tokens'
      });
    }
    
    // Set up OAuth client with tokens
    oauth2Client.setCredentials({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type,
      expiry_date: new Date(data.expires_at).getTime()
    });
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const emails = [];
    for (const messageId of messageIds) {
      try {
        const emailData = await gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'full'
        });

        const headers = emailData.data.payload.headers;
        const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
        const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
        
        emails.push({
          from,
          subject,
          snippet: emailData.data.snippet || ''
        });
      } catch (error) {
        console.error(`Failed to fetch email ${messageId}:`, error);
      }
    }

    // Generate AI summary
    const emailText = emails.map(email => 
      `From: ${email.from}\nSubject: ${email.subject}\nContent: ${email.snippet}`
    ).join('\n\n');

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const prompt = `Summarize these emails concisely, highlighting key topics, important information, and any action items:\n\n${emailText}`;
    
    const result = await model.generateContent(prompt);
    const summary = result.response.text();

    res.json({
      success: true,
      summary,
      emailCount: emails.length
    });
  } catch (error) {
    console.error('Error summarizing emails:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to summarize emails'
    });
  }
});

// Gmail extract tasks and events endpoint
app.post('/api/gmail/extract-tasks-events', async (req, res) => {
  try {
    const { userId, messageIds } = req.body;
    
    if (!userId || !messageIds || !Array.isArray(messageIds)) {
      return res.status(400).json({
        success: false,
        error: 'User ID and Message IDs are required'
      });
    }
    
    // Generate a session token for decryption
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    // Get tokens
    const { data, error } = await supabase.rpc('get_decrypted_gmail_tokens_with_fallback', {
      p_user_id: userId,
      p_session_token: sessionToken
    });
    
    if (error || !data.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to get Gmail tokens'
      });
    }
    
    // Set up OAuth client with tokens
    oauth2Client.setCredentials({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type,
      expiry_date: new Date(data.expires_at).getTime()
    });
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const emails = [];
    for (const messageId of messageIds) {
      try {
        const emailData = await gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'full'
        });

        const headers = emailData.data.payload.headers;
        const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
        const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
        
        // Extract body
        let body = '';
        
        // Function to extract body parts recursively
        const extractBody = (part) => {
          if (part.mimeType === 'text/html' && part.body && part.body.data) {
            return Buffer.from(part.body.data, 'base64').toString('utf-8');
          } else if (part.mimeType === 'text/plain' && part.body && part.body.data && !body) {
            return Buffer.from(part.body.data, 'base64').toString('utf-8');
          } else if (part.parts) {
            for (const subPart of part.parts) {
              const extractedBody = extractBody(subPart);
              if (extractedBody) {
                return extractedBody;
              }
            }
          }
          return null;
        };
        
        if (emailData.data.payload.parts) {
          for (const part of emailData.data.payload.parts) {
            const extractedBody = extractBody(part);
            if (extractedBody) {
              body = extractedBody;
              break;
            }
          }
        } else if (emailData.data.payload.body && emailData.data.payload.body.data) {
          body = Buffer.from(emailData.data.payload.body.data, 'base64').toString('utf-8');
        }
        
        emails.push({
          from,
          subject,
          body: body || emailData.data.snippet || ''
        });
      } catch (error) {
        console.error(`Failed to fetch email ${messageId}:`, error);
      }
    }

    // Extract tasks and events using AI
    const emailText = emails.map(email => 
      `From: ${email.from}\nSubject: ${email.subject}\nContent: ${email.body}`
    ).join('\n\n---\n\n');

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const prompt = `Extract tasks and calendar events from these emails. Return a JSON object with "tasks" and "events" arrays. Each task should have title, description, priority, due_date. Each event should have title, description, start_time, end_time:\n\n${emailText}`;
    
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    let extracted;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0]);
      } else {
        extracted = { tasks: [], events: [] };
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      extracted = { tasks: [], events: [] };
    }

    // Create tasks in database
    let tasksCreated = 0;
    for (const task of extracted.tasks || []) {
      try {
        const { error } = await supabase
          .from('tasks')
          .insert({
            title: task.title,
            description: task.description,
            priority: task.priority || 'medium',
            due_date: task.due_date,
            created_by: userId
          });

        if (!error) tasksCreated++;
      } catch (error) {
        console.error('Error creating task:', error);
      }
    }

    // Create events in database
    let eventsCreated = 0;
    for (const event of extracted.events || []) {
      try {
        const { error } = await supabase
          .from('calendar_events')
          .insert({
            title: event.title,
            description: event.description,
            start_time: event.start_time,
            end_time: event.end_time,
            user_id: userId
          });

        if (!error) eventsCreated++;
      } catch (error) {
        console.error('Error creating event:', error);
      }
    }

    res.json({ 
      success: true, 
      tasksCreated, 
      eventsCreated,
      tasks: extracted.tasks || [],
      events: extracted.events || [],
      summary: `Extracted ${tasksCreated} tasks and ${eventsCreated} events from ${emails.length} emails.`
    });
  } catch (error) {
    console.error('Error extracting tasks and events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to extract tasks and events'
    });
  }
});

// Gmail get promotional emails endpoint
app.get('/api/gmail/promotions', async (req, res) => {
  try {
    const { userId, maxResults = 20 } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    // Generate a session token for decryption
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    // Get tokens
    const { data, error } = await supabase.rpc('get_decrypted_gmail_tokens_with_fallback', {
      p_user_id: userId,
      p_session_token: sessionToken
    });
    
    if (error || !data.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to get Gmail tokens'
      });
    }
    
    // Set up OAuth client with tokens
    oauth2Client.setCredentials({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type,
      expiry_date: new Date(data.expires_at).getTime()
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    // Use Gmail's category:promotions search
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'category:promotions',
      maxResults: parseInt(maxResults.toString())
    });

    const messages = response.data.messages || [];
    const emails = [];

    for (const message of messages.slice(0, maxResults)) {
      const emailData = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'full'
      });
      const headers = emailData.data.payload.headers;
      const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
      const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
      const date = headers.find(h => h.name === 'Date')?.value || '';
      const snippet = emailData.data.snippet || '';
      
      // Extract unsubscribe URL from List-Unsubscribe header
      let unsubscribeUrl = null;
      const listUnsub = headers.find(h => h.name.toLowerCase() === 'list-unsubscribe');
      if (listUnsub) {
        // Try to extract a URL from the header value
        const match = listUnsub.value.match(/<([^>]+)>/);
        if (match) unsubscribeUrl = match[1];
        else if (listUnsub.value.startsWith('http')) unsubscribeUrl = listUnsub.value;
      }
      
      // If no unsubscribe header, try to find one in the body
      if (!unsubscribeUrl) {
        // Function to extract body parts recursively
        const extractBody = (part) => {
          if (part.mimeType === 'text/html' && part.body && part.body.data) {
            return Buffer.from(part.body.data, 'base64').toString('utf-8');
          } else if (part.parts) {
            for (const subPart of part.parts) {
              const extractedBody = extractBody(subPart);
              if (extractedBody) {
                return extractedBody;
              }
            }
          }
          return null;
        };
        
        let body = '';
        if (emailData.data.payload.parts) {
          for (const part of emailData.data.payload.parts) {
            const extractedBody = extractBody(part);
            if (extractedBody) {
              body = extractedBody;
              break;
            }
          }
        } else if (emailData.data.payload.body && emailData.data.payload.body.data) {
          body = Buffer.from(emailData.data.payload.body.data, 'base64').toString('utf-8');
        }
        
        if (body) {
          const unsubscribeRegex = /href=["'](https?:\/\/[^"']+unsubscribe[^"']+)["']/i;
          const match = body.match(unsubscribeRegex);
          if (match) {
            unsubscribeUrl = match[1];
          }
        }
      }
      
      emails.push({
        id: message.id,
        from,
        subject,
        date,
        snippet,
        isUnread: emailData.data.labelIds?.includes('UNREAD'),
        unsubscribeUrl
      });
    }
    
    res.json({
      success: true,
      emails,
      totalCount: emails.length
    });
  } catch (error) {
    console.error('Error fetching promotional emails:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch promotional emails'
    });
  }
});

// Meeting notes endpoint
app.post('/api/meetings/auto-notes', async (req, res) => {
  try {
    const { text, speaker, userId } = req.body;
    
    if (!text || !speaker) {
      return res.status(400).json({
        success: false,
        error: 'Text and speaker are required'
      });
    }
    
    // Generate notes
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const prompt = `
      Extract key points, action items, or decisions from this meeting transcript segment:
      
      ${speaker}: ${text}
      
      Respond with only the most important information in a concise format.
      If there are no significant points, respond with "No significant points to note."
    `;
    
    const result = await model.generateContent(prompt);
    const notes = result.response.text();
    
    res.json({
      success: true,
      notes
    });
  } catch (error) {
    console.error('Error generating meeting notes:', error);
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
    
    // Generate summary
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const prompt = `
      Generate a comprehensive summary of this meeting transcript:
      
      ${transcript}
      
      Participants: ${participants ? participants.join(', ') : 'Unknown'}
      Duration: ${duration || 'Unknown'} minutes
      
      Include:
      1. Key discussion points
      2. Decisions made
      3. Action items with assignees
      4. Next steps
      
      Format as a professional meeting summary.
    `;
    
    const result = await model.generateContent(prompt);
    const summary = result.response.text();
    
    res.json({
      success: true,
      summary
    });
  } catch (error) {
    console.error('Error generating meeting summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate summary'
    });
  }
});

// Implementation functions for all endpoints

// Gmail Functions
async function executeGmailStatus(userId) {
  try {
    // Check if tokens exist
    const { data: tokensExist } = await supabase.rpc('check_gmail_tokens_exist', {
      p_user_id: userId
    });
    
    if (!tokensExist) {
      return { success: true, connected: false };
    }
    
    // Generate a session token for decryption
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    // Get tokens
    const { data, error } = await supabase.rpc('get_decrypted_gmail_tokens_with_fallback', {
      p_user_id: userId,
      p_session_token: sessionToken
    });
    
    if (error || !data.success) {
      return { success: true, connected: false };
    }
    
    // Set up OAuth client with tokens
    oauth2Client.setCredentials({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type,
      expiry_date: new Date(data.expires_at).getTime()
    });
    
    // Get Gmail profile to verify connection
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    
    // Get unread count
    const unreadResponse = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
      maxResults: 1
    });
    
    const unreadCount = unreadResponse.data.resultSizeEstimate || 0;
    
    return {
      success: true,
      connected: true,
      email: profile.data.emailAddress,
      unreadCount
    };
  } catch (error) {
    console.error('Error checking Gmail status:', error);
    return { success: true, connected: false };
  }
}

async function executeGmailConnect(userId) {
  try {
    // Define expanded scopes for more access
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/drive.readonly'
    ];
    
    // Use userId directly as state
    const state = userId;
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state,
      prompt: 'consent'
    });
    
    return { success: true, authUrl };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function executeGmailDisconnect(userId) {
  try {
    const { data, error } = await supabase.rpc('revoke_gmail_tokens', {
      p_user_id: userId
    });
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true, message: 'Gmail disconnected successfully' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function executeGmailGetEmails(userId, query = '', maxResults = 10) {
  try {
    // Generate a session token for decryption
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    // Get tokens
    const { data, error } = await supabase.rpc('get_decrypted_gmail_tokens_with_fallback', {
      p_user_id: userId,
      p_session_token: sessionToken
    });
    
    if (error || !data.success) {
      return { success: false, error: 'Gmail not connected' };
    }
    
    // Set up OAuth client with tokens
    oauth2Client.setCredentials({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type,
      expiry_date: new Date(data.expires_at).getTime()
    });
    
    // Get emails
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: parseInt(maxResults)
    });
    
    const messages = response.data.messages || [];
    const emails = [];
    
    // Get email details
    for (const message of messages) {
      const emailData = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date']
      });
      
      const headers = emailData.data.payload.headers;
      const from = headers.find(h => h.name === 'From')?.value || '';
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';
      
      emails.push({
        id: message.id,
        threadId: message.threadId,
        from,
        subject,
        date,
        snippet: emailData.data.snippet,
        isUnread: emailData.data.labelIds.includes('UNREAD')
      });
    }
    
    return { success: true, emails };
  } catch (error) {
    console.error('Error getting emails:', error);
    return { success: false, error: 'Failed to get emails' };
  }
}

async function executeGmailUnread(userId, maxResults = 20) {
  return executeGmailGetEmails(userId, 'is:unread', maxResults);
}

async function executeGmailSearch(userId, query, maxResults = 10) {
  return executeGmailGetEmails(userId, query, maxResults);
}

async function executeGmailSearchSender(userId, sender, maxResults = 10) {
  const query = `from:${sender}`;
  return executeGmailGetEmails(userId, query, maxResults);
}

async function executeGmailGetEmail(userId, emailId) {
  try {
    // Generate a session token for decryption
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    // Get tokens
    const { data, error } = await supabase.rpc('get_decrypted_gmail_tokens_with_fallback', {
      p_user_id: userId,
      p_session_token: sessionToken
    });
    
    if (error || !data.success) {
      return { success: false, error: 'Gmail not connected' };
    }
    
    // Set up OAuth client with tokens
    oauth2Client.setCredentials({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type,
      expiry_date: new Date(data.expires_at).getTime()
    });
    
    // Get email
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: emailId,
      format: 'full'
    });
    
    const headers = response.data.payload.headers;
    const from = headers.find(h => h.name === 'From')?.value || '';
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    const date = headers.find(h => h.name === 'Date')?.value || '';
    
    // Extract body with improved handling
    let body = '';
    
    // Function to extract body parts recursively
    const extractBody = (part) => {
      if (part.mimeType === 'text/html' && part.body && part.body.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.mimeType === 'text/plain' && part.body && part.body.data && !body) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.parts) {
        for (const subPart of part.parts) {
          const extractedBody = extractBody(subPart);
          if (extractedBody) {
            return extractedBody;
          }
        }
      }
      return null;
    };
    
    // Try to get HTML body first
    if (response.data.payload.mimeType === 'text/html' && response.data.payload.body && response.data.payload.body.data) {
      body = Buffer.from(response.data.payload.body.data, 'base64').toString('utf-8');
    } else if (response.data.payload.parts) {
      for (const part of response.data.payload.parts) {
        const extractedBody = extractBody(part);
        if (extractedBody) {
          body = extractedBody;
          break;
        }
      }
    } else if (response.data.payload.body && response.data.payload.body.data) {
      body = Buffer.from(response.data.payload.body.data, 'base64').toString('utf-8');
    }
    
    // Check for unsubscribe link
    const unsubscribeHeader = headers.find(h => h.name.toLowerCase() === 'list-unsubscribe')?.value;
    let unsubscribeUrl = null;
    
    if (unsubscribeHeader) {
      const match = unsubscribeHeader.match(/<(https?:\/\/[^>]+)>/);
      if (match) {
        unsubscribeUrl = match[1];
      }
    }
    
    // If no unsubscribe header, try to find one in the body
    if (!unsubscribeUrl && body) {
      const unsubscribeRegex = /href=["'](https?:\/\/[^"']+unsubscribe[^"']+)["']/i;
      const match = body.match(unsubscribeRegex);
      if (match) {
        unsubscribeUrl = match[1];
      }
    }
    
    // Mark as read
    try {
      await gmail.users.messages.modify({
        userId: 'me',
        id: emailId,
        resource: {
          removeLabelIds: ['UNREAD']
        }
      });
    } catch (markError) {
      console.error('Error marking email as read:', markError);
      // Continue anyway, this is not critical
    }
    
    return {
      success: true,
      email: {
        id: emailId,
        threadId: response.data.threadId,
        from,
        subject,
        date,
        snippet: response.data.snippet,
        isUnread: response.data.labelIds.includes('UNREAD'),
        body,
        unsubscribeUrl
      }
    };
  } catch (error) {
    console.error('Error getting email:', error);
    return { success: false, error: 'Failed to get email' };
  }
}

async function executeGmailDeleteEmails(userId, messageIds) {
  try {
    // Generate a session token for decryption
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    // Get tokens
    const { data, error } = await supabase.rpc('get_decrypted_gmail_tokens_with_fallback', {
      p_user_id: userId,
      p_session_token: sessionToken
    });
    
    if (error || !data.success) {
      return { success: false, error: 'Gmail not connected' };
    }
    
    // Set up OAuth client with tokens
    oauth2Client.setCredentials({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type,
      expiry_date: new Date(data.expires_at).getTime()
    });
    
    // Delete emails
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
        console.error(`Error deleting email ${messageId}:`, error);
        failed++;
      }
    }
    
    return { success: true, deleted, failed };
  } catch (error) {
    console.error('Error deleting emails:', error);
    return { success: false, error: 'Failed to delete emails' };
  }
}

async function executeGmailSummarize(userId, messageIds) {
  try {
    // Generate a session token for decryption
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    // Get tokens
    const { data, error } = await supabase.rpc('get_decrypted_gmail_tokens_with_fallback', {
      p_user_id: userId,
      p_session_token: sessionToken
    });
    
    if (error || !data.success) {
      return { success: false, error: 'Gmail not connected' };
    }
    
    // Set up OAuth client with tokens
    oauth2Client.setCredentials({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type,
      expiry_date: new Date(data.expires_at).getTime()
    });
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const emails = [];
    for (const messageId of messageIds) {
      try {
        const emailData = await gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'full'
        });

        const headers = emailData.data.payload.headers;
        const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
        const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
        
        emails.push({
          from,
          subject,
          snippet: emailData.data.snippet || ''
        });
      } catch (error) {
        console.error(`Failed to fetch email ${messageId}:`, error);
      }
    }

    // Generate AI summary
    const emailText = emails.map(email => 
      `From: ${email.from}\nSubject: ${email.subject}\nContent: ${email.snippet}`
    ).join('\n\n');

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const prompt = `Summarize these emails concisely, highlighting key topics, important information, and any action items:\n\n${emailText}`;
    
    const result = await model.generateContent(prompt);
    const summary = result.response.text();

    return { success: true, summary, emailCount: emails.length };
  } catch (error) {
    console.error('Error summarizing emails:', error);
    return { success: false, error: 'Failed to summarize emails' };
  }
}

async function executeGmailExtractTasks(userId, messageIds) {
  try {
    // Generate a session token for decryption
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    // Get tokens
    const { data, error } = await supabase.rpc('get_decrypted_gmail_tokens_with_fallback', {
      p_user_id: userId,
      p_session_token: sessionToken
    });
    
    if (error || !data.success) {
      return { success: false, error: 'Gmail not connected' };
    }
    
    // Set up OAuth client with tokens
    oauth2Client.setCredentials({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type,
      expiry_date: new Date(data.expires_at).getTime()
    });
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const emails = [];
    for (const messageId of messageIds) {
      try {
        const emailData = await gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'full'
        });

        const headers = emailData.data.payload.headers;
        const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
        const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
        
        // Extract body
        let body = '';
        
        // Function to extract body parts recursively
        const extractBody = (part) => {
          if (part.mimeType === 'text/html' && part.body && part.body.data) {
            return Buffer.from(part.body.data, 'base64').toString('utf-8');
          } else if (part.mimeType === 'text/plain' && part.body && part.body.data && !body) {
            return Buffer.from(part.body.data, 'base64').toString('utf-8');
          } else if (part.parts) {
            for (const subPart of part.parts) {
              const extractedBody = extractBody(subPart);
              if (extractedBody) {
                return extractedBody;
              }
            }
          }
          return null;
        };
        
        if (emailData.data.payload.parts) {
          for (const part of emailData.data.payload.parts) {
            const extractedBody = extractBody(part);
            if (extractedBody) {
              body = extractedBody;
              break;
            }
          }
        } else if (emailData.data.payload.body && emailData.data.payload.body.data) {
          body = Buffer.from(emailData.data.payload.body.data, 'base64').toString('utf-8');
        }
        
        emails.push({
          from,
          subject,
          body: body || emailData.data.snippet || ''
        });
      } catch (error) {
        console.error(`Failed to fetch email ${messageId}:`, error);
      }
    }

    // Extract tasks and events using AI
    const emailText = emails.map(email => 
      `From: ${email.from}\nSubject: ${email.subject}\nContent: ${email.body}`
    ).join('\n\n');

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const prompt = `Extract tasks and calendar events from these emails. Return a JSON object with "tasks" and "events" arrays. Each task should have title, description, priority, due_date. Each event should have title, description, start_time, end_time:\n\n${emailText}`;
    
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    let extracted;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0]);
      } else {
        extracted = { tasks: [], events: [] };
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      extracted = { tasks: [], events: [] };
    }

    // Create tasks in database
    let tasksCreated = 0;
    for (const task of extracted.tasks || []) {
      try {
        const { error } = await supabase
          .from('tasks')
          .insert({
            title: task.title,
            description: task.description,
            priority: task.priority || 'medium',
            due_date: task.due_date,
            created_by: userId
          });

        if (!error) tasksCreated++;
      } catch (error) {
        console.error('Error creating task:', error);
      }
    }

    // Create events in database
    let eventsCreated = 0;
    for (const event of extracted.events || []) {
      try {
        const { error } = await supabase
          .from('calendar_events')
          .insert({
            title: event.title,
            description: event.description,
            start_time: event.start_time,
            end_time: event.end_time,
            user_id: userId
          });

        if (!error) eventsCreated++;
      } catch (error) {
        console.error('Error creating event:', error);
      }
    }

    return { 
      success: true, 
      tasksCreated, 
      eventsCreated,
      tasks: extracted.tasks || [],
      events: extracted.events || [],
      summary: `Extracted ${tasksCreated} tasks and ${eventsCreated} events from ${emails.length} emails.`
    };
  } catch (error) {
    console.error('Error extracting tasks and events:', error);
    return { success: false, error: 'Failed to extract tasks and events' };
  }
}

async function executeGmailPromotions(userId, maxResults = 20) {
  try {
    // Generate a session token for decryption
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    // Get tokens
    const { data, error } = await supabase.rpc('get_decrypted_gmail_tokens_with_fallback', {
      p_user_id: userId,
      p_session_token: sessionToken
    });
    
    if (error || !data.success) {
      return { success: false, error: 'Gmail not connected' };
    }
    
    // Set up OAuth client with tokens
    oauth2Client.setCredentials({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type,
      expiry_date: new Date(data.expires_at).getTime()
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    // Use Gmail's category:promotions search
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'category:promotions',
      maxResults: parseInt(maxResults.toString())
    });

    const messages = response.data.messages || [];
    const emails = [];

    for (const message of messages.slice(0, maxResults)) {
      const emailData = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'full'
      });
      const headers = emailData.data.payload.headers;
      const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
      const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
      const date = headers.find(h => h.name === 'Date')?.value || '';
      const snippet = emailData.data.snippet || '';
      
      // Extract unsubscribe URL from List-Unsubscribe header
      let unsubscribeUrl = null;
      const listUnsub = headers.find(h => h.name.toLowerCase() === 'list-unsubscribe');
      if (listUnsub) {
        // Try to extract a URL from the header value
        const match = listUnsub.value.match(/<([^>]+)>/);
        if (match) unsubscribeUrl = match[1];
        else if (listUnsub.value.startsWith('http')) unsubscribeUrl = listUnsub.value;
      }
      
      // If no unsubscribe header, try to find one in the body
      if (!unsubscribeUrl) {
        // Function to extract body parts recursively
        const extractBody = (part) => {
          if (part.mimeType === 'text/html' && part.body && part.body.data) {
            return Buffer.from(part.body.data, 'base64').toString('utf-8');
          } else if (part.parts) {
            for (const subPart of part.parts) {
              const extractedBody = extractBody(subPart);
              if (extractedBody) {
                return extractedBody;
              }
            }
          }
          return null;
        };
        
        let body = '';
        if (emailData.data.payload.parts) {
          for (const part of emailData.data.payload.parts) {
            const extractedBody = extractBody(part);
            if (extractedBody) {
              body = extractedBody;
              break;
            }
          }
        } else if (emailData.data.payload.body && emailData.data.payload.body.data) {
          body = Buffer.from(emailData.data.payload.body.data, 'base64').toString('utf-8');
        }
        
        if (body) {
          const unsubscribeRegex = /href=["'](https?:\/\/[^"']+unsubscribe[^"']+)["']/i;
          const match = body.match(unsubscribeRegex);
          if (match) {
            unsubscribeUrl = match[1];
          }
        }
      }
      
      emails.push({
        id: message.id,
        from,
        subject,
        date,
        snippet,
        isUnread: emailData.data.labelIds?.includes('UNREAD'),
        unsubscribeUrl
      });
    }
    
    return { success: true, emails, totalCount: emails.length };
  } catch (error) {
    console.error('Error fetching promotional emails:', error);
    return { success: false, error: 'Failed to fetch promotional emails' };
  }
}

// Workspace Functions
async function executeWorkspaceChannels(userId) {
  try {
    const { data, error } = await supabase
      .from('channels')
      .select(`
        *,
        channel_members!inner(user_id, role)
      `)
      .eq('channel_members.user_id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, channels: data || [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function executeWorkspaceCreateChannel(parameters) {
  try {
    const { name, description, type = 'public', created_by } = parameters;
    
    const { data, error } = await supabase
      .from('channels')
      .insert({
        name,
        description,
        type,
        created_by
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Add creator as admin member
    await supabase
      .from('channel_members')
      .insert({
        channel_id: data.id,
        user_id: created_by,
        role: 'admin'
      });

    return { success: true, channel: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function executeWorkspaceMessages(channelId) {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles(*)
      `)
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, messages: data || [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function executeWorkspaceSendMessage(parameters) {
  try {
    const { channel_id, sender_id, content, type = 'text', metadata = {} } = parameters;
    
    const { data, error } = await supabase
      .from('messages')
      .insert({
        channel_id,
        sender_id,
        content,
        type,
        metadata
      })
      .select(`
        *,
        sender:profiles(*)
      `)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, message: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function executeWorkspaceTasks(userId) {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        assignments:task_assignments(
          user_id,
          user:profiles(*)
        )
      `)
      .or(`created_by.eq.${userId},assignments.user_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, tasks: data || [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function executeWorkspaceCreateTask(parameters) {
  try {
    const { title, description, priority = 'medium', due_date, created_by } = parameters;
    
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title,
        description,
        priority,
        due_date,
        created_by
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, task: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function executeWorkspaceUpdateTask(taskId, parameters) {
  try {
    const { status, priority, due_date } = parameters;
    
    const updateData = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (due_date) updateData.due_date = due_date;
    
    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, task: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function executeWorkspaceAssignTask(parameters) {
  try {
    const { task_id, user_id } = parameters;
    
    const { data, error } = await supabase
      .from('task_assignments')
      .insert({
        task_id,
        user_id
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, assignment: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Calendar Functions
async function executeCalendarEvents(userId, start_date, end_date) {
  try {
    let query = supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .order('start_time');

    if (start_date) {
      query = query.gte('start_time', start_date);
    }
    if (end_date) {
      query = query.lte('start_time', end_date);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, events: data || [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function executeCalendarCreateEvent(parameters) {
  try {
    const { title, description, start_time, end_time, user_id, task_id } = parameters;
    
    const { data, error } = await supabase
      .from('calendar_events')
      .insert({
        title,
        description,
        start_time,
        end_time,
        user_id,
        task_id
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, event: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function executeCalendarUpdateEvent(eventId, parameters) {
  try {
    const { title, start_time, end_time } = parameters;
    
    const updateData = {};
    if (title) updateData.title = title;
    if (start_time) updateData.start_time = start_time;
    if (end_time) updateData.end_time = end_time;
    
    const { data, error } = await supabase
      .from('calendar_events')
      .update(updateData)
      .eq('id', eventId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, event: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function executeCalendarDeleteEvent(eventId) {
  try {
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', eventId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Meeting Functions
async function executeMeetingCreateRoom(parameters) {
  try {
    const { roomName, displayName } = parameters;
    
    // This would integrate with your meeting service
    // For now, return a mock response
    return {
      success: true,
      room: {
        name: roomName,
        url: `${FRONTEND_URL}/meetings?room=${encodeURIComponent(roomName)}`,
        creator: displayName
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function executeMeetingJoinRoom(parameters) {
  try {
    const { roomName, displayName } = parameters;
    
    return {
      success: true,
      room: {
        name: roomName,
        url: `${FRONTEND_URL}/meetings?room=${encodeURIComponent(roomName)}`,
        participant: displayName
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function executeMeetingAutoNotes(parameters) {
  try {
    const { text, speaker, userId } = parameters;
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const prompt = `Generate concise meeting notes from this transcript segment. Speaker: ${speaker}, Text: "${text}". Extract key points, decisions, and action items.`;
    
    const result = await model.generateContent(prompt);
    const notes = result.response.text();

    return { success: true, notes, speaker };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function executeMeetingSummary(parameters) {
  try {
    const { transcript, participants, duration } = parameters;
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const prompt = `Generate a comprehensive meeting summary from this transcript. Participants: ${participants.join(', ')}, Duration: ${duration} minutes. Transcript: ${transcript}. Include key discussion points, decisions made, action items, and next steps.`;
    
    const result = await model.generateContent(prompt);
    const summary = result.response.text();

    return { success: true, summary, participants, duration };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Game Functions
async function executeGameRiddle(user_id) {
  try {
    const response = await fetch(`${VITE_API_URL}/api/create-riddle-conversation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id })
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function executeGameTwentyQuestionsUser(user_id) {
  try {
    const response = await fetch(`${VITE_API_URL}/api/create-twenty-questions-user-asks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id })
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function executeGameTwentyQuestionsAI(user_id) {
  try {
    const response = await fetch(`${VITE_API_URL}/api/create-twenty-questions-ai-asks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id })
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function executeGameEndConversation(user_id) {
  try {
    const response = await fetch(`${VITE_API_URL}/api/end-conversation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id })
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Document Functions
async function executeDocumentGenerate(parameters) {
  try {
    const { prompt, documentType = 'general', format = 'html' } = parameters;
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    const documentPrompt = `Generate a professional ${documentType} document based on this request: "${prompt}"
    
    Format the response as clean ${format.toUpperCase()} with proper structure, headings, and formatting.
    Make it comprehensive and professional.`;
    
    const result = await model.generateContent(documentPrompt);
    const content = result.response.text();
    
    return {
      success: true,
      document: {
        content,
        type: documentType,
        format,
        generated_at: new Date().toISOString()
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function executeDocumentLatexToPdf(parameters) {
  try {
    const { latexContent, filename = 'document.pdf' } = parameters;
    
    // This would integrate with a LaTeX to PDF service
    // For now, return a mock response
    return {
      success: true,
      pdf: {
        filename,
        url: 'mock-pdf-url',
        generated_at: new Date().toISOString()
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Chat Functions
async function executeChatProcessMessage(parameters) {
  try {
    const { message, messageId, channelId, senderId, mentions, userId } = parameters;
    
    // This would integrate with your workspace processor
    // For now, return a mock response
    return {
      success: true,
      processed: true,
      taskCreated: false,
      message: 'Message processed successfully'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// General Query Function
async function executeGeneralQuery(message) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(message);
    const response = result.response.text();
    
    return {
      success: true,
      response
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Session cleanup job
function cleanupInactiveSessions() {
  const now = new Date();
  const inactiveThreshold = 30 * 60 * 1000; // 30 minutes in milliseconds
  
  for (const [sessionId, session] of activeSessions.entries()) {
    const lastActivity = session.lastActivity || session.createdAt;
    const inactiveDuration = now - lastActivity;
    
    if (inactiveDuration > inactiveThreshold) {
      console.log(`Cleaning up inactive session ${sessionId} for user ${session.userId}`);
      activeSessions.delete(sessionId);
    }
  }
}

// Run session cleanup every 15 minutes
setInterval(cleanupInactiveSessions, 15 * 60 * 1000);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    activeSessions: activeSessions.size,
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
  console.log(`Enhanced with ${Object.keys(WEBAPP_ENDPOINTS).length} available endpoints`);
});

module.exports = app;