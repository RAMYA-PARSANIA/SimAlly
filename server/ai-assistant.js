const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
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

// Initialize OAuth2 client for Gmail
const oauth2Client = new OAuth2Client(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

// Store active AI sessions
const activeSessions = new Map();

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

  // Google Docs/Slides
  create_google_doc: {
    endpoint: '/api/google/docs/create-doc',
    method: 'POST',
    description: 'Create a Google Doc with AI-generated content',
    parameters: ['userId', 'prompt'],
    example: 'Create a Google Doc about project management',
    implementation: 'executeCreateGoogleDoc'
  },
  create_google_slides: {
    endpoint: '/api/google/docs/create-slides',
    method: 'POST',
    description: 'Create a Google Slides presentation with AI-generated content',
    parameters: ['userId', 'prompt'],
    example: 'Create a presentation about renewable energy',
    implementation: 'executeCreateGoogleSlides'
  },
  list_google_docs: {
    endpoint: '/api/google/docs/docs',
    method: 'GET',
    description: 'List user\'s Google Docs',
    parameters: ['userId'],
    example: 'Show my Google Docs',
    implementation: 'executeListGoogleDocs'
  },
  list_google_slides: {
    endpoint: '/api/google/docs/slides',
    method: 'GET',
    description: 'List user\'s Google Slides presentations',
    parameters: ['userId'],
    example: 'Show my presentations',
    implementation: 'executeListGoogleSlides'
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
   - Google Docs and Slides creation and management
   - Game modes (riddles, 20 questions)
   - General conversation and knowledge

6. For document and presentation requests:
   - Use create_google_doc for document creation
   - Use create_google_slides for presentation creation
   - Use list_google_docs to show user's documents
   - Use list_google_slides to show user's presentations
   - Extract detailed information about what the user wants to create

CONTEXT: ${JSON.stringify(context)}
USER MESSAGE: "${message}"

Analyze the message and respond with the appropriate JSON format. Be intelligent about recognizing what the user wants to do.`;

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
        const result = await executeEndpointFunction(parsedResponse.endpoint, parsedResponse.parameters, userId, req);
        
        // Use userMessage if available, otherwise use the original response
        const responseMessage = result?.userMessage || parsedResponse.response;
        
        return res.json({
          success: true,
          agent: {
            intent: 'endpoint_call',
            endpoint: parsedResponse.endpoint,
            parameters: parsedResponse.parameters,
            response: responseMessage,
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
async function executeEndpointFunction(endpoint, parameters, userId, req = null) {
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
      
    // Google Docs/Slides functions
    case 'executeCreateGoogleDoc':
      return await executeCreateGoogleDoc(parameters);
    case 'executeCreateGoogleSlides':
      return await executeCreateGoogleSlides(parameters);
    case 'executeListGoogleDocs':
      return await executeListGoogleDocs(parameters.userId);
    case 'executeListGoogleSlides':
      return await executeListGoogleSlides(parameters.userId);

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

// Gmail Functions - Updated to use Supabase
async function executeGmailStatus(userId) {
  try {
    if (!userId) {
      return { success: true, connected: false, error: 'User ID required' };
    }
    
    // Check if tokens exist in Supabase
    const { data: hasTokens, error: checkError } = await supabase.rpc('has_gmail_tokens', {
      p_user_id: userId
    });
    
    if (checkError) {
      console.error('Error checking Gmail token status:', checkError);
      return { success: true, connected: false };
    }
    
    if (!hasTokens) {
      return { success: true, connected: false };
    }
    
    // Get tokens from Supabase
    const { data: tokensData, error: tokensError } = await supabase.rpc('get_gmail_tokens', {
      p_user_id: userId
    });
    
    if (tokensError || !tokensData.success) {
      console.error('Error retrieving Gmail tokens:', tokensError || tokensData.error);
      return { success: true, connected: false };
    }
    
    // Set up OAuth client with tokens
    const clientForRequest = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );
    
    clientForRequest.setCredentials({
      access_token: tokensData.access_token,
      refresh_token: tokensData.refresh_token,
      token_type: tokensData.token_type || 'Bearer',
      expiry_date: new Date(tokensData.expires_at).getTime()
    });
    
    // Get Gmail profile to verify connection
    const gmail = google.gmail({ version: 'v1', auth: clientForRequest });
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
      'https://mail.google.com/',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/presentations'
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
    if (!userId) {
      return { success: false, error: 'User ID is required' };
    }
    
    // Revoke tokens in Supabase
    const { data, error } = await supabase.rpc('revoke_gmail_tokens', {
      p_user_id: userId
    });
    
    if (error) {
      console.error('Error revoking Gmail tokens:', error);
      return { success: false, error: 'Failed to disconnect Gmail account' };
    }
    
    return { success: true, message: 'Gmail disconnected successfully' };
  } catch (error) {
    console.error('Error disconnecting Gmail:', error);
    return { success: false, error: error.message };
  }
}

// Enhanced Gmail Get Emails function with Supabase token storage
async function executeGmailGetEmails(userId, query = '', maxResults = 10) {
  try {
    console.log(`Getting emails for userId: ${userId}, query: ${query}`);
    
    if (!userId) {
      console.error('No userId provided');
      return { success: false, error: 'User ID is required' };
    }

    // Get tokens from Supabase
    const { data: tokensData, error: tokensError } = await supabase.rpc('get_gmail_tokens', {
      p_user_id: userId
    });
    
    if (tokensError || !tokensData.success) {
      console.error('Error retrieving Gmail tokens:', tokensError || tokensData.error);
      return { success: false, error: 'Not authenticated with Google' };
    }

    // Set up OAuth client with tokens
    const oAuth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );
    
    oAuth2Client.setCredentials({
      access_token: tokensData.access_token,
      refresh_token: tokensData.refresh_token,
      token_type: tokensData.token_type || 'Bearer',
      expiry_date: new Date(tokensData.expires_at).getTime()
    });

    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: parseInt(maxResults)
    });

    const messages = response.data.messages || [];
    const emails = [];

    for (const message of messages) {
      const details = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date']
      });
      
      const headers = details.data.payload.headers;
      const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';
      
      emails.push({
        id: message.id,
        threadId: message.threadId,
        subject,
        from,
        date,
        snippet: details.data.snippet,
        isUnread: details.data.labelIds?.includes('UNREAD') || false
      });
    }

    return { success: true, emails };
  } catch (error) {
    console.error('Error in executeGmailGetEmails:', error);
    return { success: false, error: error.message };
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
    if (!userId || !emailId) {
      return { success: false, error: 'User ID and Email ID are required' };
    }
    
    // Get tokens from Supabase
    const { data: tokensData, error: tokensError } = await supabase.rpc('get_gmail_tokens', {
      p_user_id: userId
    });
    
    if (tokensError || !tokensData.success) {
      console.error('Error retrieving Gmail tokens:', tokensError || tokensData.error);
      return { success: false, error: 'Not authenticated with Google' };
    }
    
    // Set up OAuth client with tokens
    const oAuth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );
    
    oAuth2Client.setCredentials({
      access_token: tokensData.access_token,
      refresh_token: tokensData.refresh_token,
      token_type: tokensData.token_type || 'Bearer',
      expiry_date: new Date(tokensData.expires_at).getTime()
    });
    
    // Get email
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
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
    if (!userId || !messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return { success: false, error: 'User ID and message IDs are required' };
    }
    
    // Get tokens from Supabase
    const { data: tokensData, error: tokensError } = await supabase.rpc('get_gmail_tokens', {
      p_user_id: userId
    });
    
    if (tokensError || !tokensData.success) {
      console.error('Error retrieving Gmail tokens:', tokensError || tokensData.error);
      return { success: false, error: 'Not authenticated with Google' };
    }
    
    // Set up OAuth client with tokens
    const oAuth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );
    
    oAuth2Client.setCredentials({
      access_token: tokensData.access_token,
      refresh_token: tokensData.refresh_token,
      token_type: tokensData.token_type || 'Bearer',
      expiry_date: new Date(tokensData.expires_at).getTime()
    });
    
    // Delete emails
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
    
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
    if (!userId || !messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return { success: false, error: 'User ID and message IDs are required' };
    }
    
    // Get tokens from Supabase
    const { data: tokensData, error: tokensError } = await supabase.rpc('get_gmail_tokens', {
      p_user_id: userId
    });
    
    if (tokensError || !tokensData.success) {
      console.error('Error retrieving Gmail tokens:', tokensError || tokensData.error);
      return { success: false, error: 'Not authenticated with Google' };
    }
    
    // Set up OAuth client with tokens
    const oAuth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );
    
    oAuth2Client.setCredentials({
      access_token: tokensData.access_token,
      refresh_token: tokensData.refresh_token,
      token_type: tokensData.token_type || 'Bearer',
      expiry_date: new Date(tokensData.expires_at).getTime()
    });
    
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
    
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
    if (!userId || !messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return { success: false, error: 'User ID and message IDs are required' };
    }
    
    // Get tokens from Supabase
    const { data: tokensData, error: tokensError } = await supabase.rpc('get_gmail_tokens', {
      p_user_id: userId
    });
    
    if (tokensError || !tokensData.success) {
      console.error('Error retrieving Gmail tokens:', tokensError || tokensData.error);
      return { success: false, error: 'Not authenticated with Google' };
    }
    
    // Set up OAuth client with tokens
    const oAuth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );
    
    oAuth2Client.setCredentials({
      access_token: tokensData.access_token,
      refresh_token: tokensData.refresh_token,
      token_type: tokensData.token_type || 'Bearer',
      expiry_date: new Date(tokensData.expires_at).getTime()
    });
    
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
    
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
    if (!userId) {
      return { success: false, error: 'User ID is required' };
    }
    
    // Get tokens from Supabase
    const { data: tokensData, error: tokensError } = await supabase.rpc('get_gmail_tokens', {
      p_user_id: userId
    });
    
    if (tokensError || !tokensData.success) {
      console.error('Error retrieving Gmail tokens:', tokensError || tokensData.error);
      return { success: false, error: 'Not authenticated with Google' };
    }
    
    // Set up OAuth client with tokens
    const oAuth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );
    
    oAuth2Client.setCredentials({
      access_token: tokensData.access_token,
      refresh_token: tokensData.refresh_token,
      token_type: tokensData.token_type || 'Bearer',
      expiry_date: new Date(tokensData.expires_at).getTime()
    });

    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
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

// Google Docs/Slides Functions
async function executeCreateGoogleDoc(parameters) {
  try {
    const { userId, prompt } = parameters;
    
    if (!userId || !prompt) {
      return { success: false, error: 'User ID and prompt are required' };
    }
    
    // Make API call to create Google Doc
    const response = await fetch(`${process.env.VITE_API_URL || 'http://localhost:8000'}/api/google/docs/create-doc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        prompt
      })
    });
    
    console.log('Google Docs API response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Google Docs API response data:', data);
    
    if (data.success && data.document) {
      // Format a user-friendly response with actual HTML links for clickability
      const userMessage = `✅ **Document Created Successfully!**

📄 **${data.document.title}**

🔗 **View/Edit Online:** <a href="${data.document.url}" target="_blank" rel="noopener noreferrer" style="color: #10b981; text-decoration: underline;">Open in Google Docs</a>

💾 **Download:** <a href="${data.document.downloadUrl}" target="_blank" rel="noopener noreferrer" style="color: #10b981; text-decoration: underline;">Download as Word (.docx)</a>

Your document has been created and saved to your Google Drive. You can view and edit it online, or download it as a Word document to use offline.`;
      
      return {
        success: true,
        userMessage,
        document: data.document
      };
    }
    
    return data;
  } catch (error) {
    console.error('Error creating Google Doc:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    });
    return { 
      success: false, 
      error: 'Failed to create Google Doc',
      details: error.message,
      userMessage: `❌ **Error Creating Document**

I encountered an error while trying to create your Google Doc: ${error.message}

Please try again or check your Google account connection.`
    };
  }
}

async function executeCreateGoogleSlides(parameters) {
  try {
    const { userId, prompt } = parameters;
    
    if (!userId || !prompt) {
      return { success: false, error: 'User ID and prompt are required' };
    }
    
    // Make API call to create Google Slides
    const response = await fetch(`${process.env.VITE_API_URL || 'http://localhost:8000'}/api/google/docs/create-slides`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        prompt
      })
    });
    
    console.log('Google Slides API response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Google Slides API response data:', data);
    
    if (data.success && data.presentation) {
      // Format a user-friendly response with actual HTML links for clickability
      const userMessage = `✅ **Presentation Created Successfully!**

📊 **${data.presentation.title}**

🔗 **View/Edit Online:** <a href="${data.presentation.url}" target="_blank" rel="noopener noreferrer" style="color: #10b981; text-decoration: underline;">Open in Google Slides</a>

💾 **Download:** <a href="${data.presentation.downloadUrl}" target="_blank" rel="noopener noreferrer" style="color: #10b981; text-decoration: underline;">Download as PowerPoint (.pptx)</a>

Your presentation has been created and saved to your Google Drive. You can view and edit it online, or download it as a PowerPoint file to use offline.`;
      
      return {
        success: true,
        userMessage,
        presentation: data.presentation
      };
    }
    
    return data;
  } catch (error) {
    console.error('Error creating Google Slides:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    });
    return { 
      success: false, 
      error: 'Failed to create Google Slides',
      details: error.message,
      userMessage: `❌ **Error Creating Presentation**

I encountered an error while trying to create your Google Slides presentation: ${error.message}

Please try again or check your Google account connection.`
    };
  }
}

async function executeListGoogleDocs(userId) {
  try {
    if (!userId) {
      return { success: false, error: 'User ID is required' };
    }
    
    // Make API call to list Google Docs
    const response = await fetch(`${VITE_API_URL}/api/google/docs/docs?userId=${userId}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing Google Docs:', error);
    return { success: false, error: 'Failed to list Google Docs' };
  }
}

async function executeListGoogleSlides(userId) {
  try {
    if (!userId) {
      return { success: false, error: 'User ID is required' };
    }
    
    // Make API call to list Google Slides
    const response = await fetch(`${VITE_API_URL}/api/google/docs/slides?userId=${userId}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error listing Google Slides:', error);
    return { success: false, error: 'Failed to list Google Slides' };
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

// Mount the Google API router
const { router: googleApiRouter } = require('./google-api');
app.use('/api', googleApiRouter);

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
});

module.exports = app;