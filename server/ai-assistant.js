const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { OAuth2Client } = require('google-auth-library');
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
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

// Initialize services
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

// Middleware
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));
app.use(express.json());

// Session storage for user sessions (in production, use Redis or similar)
const userSessions = new Map();

// Helper function to get user session token
function getUserSessionToken(userId) {
  return userSessions.get(userId) || null;
}

// Helper function to set user session token
function setUserSessionToken(userId, sessionToken) {
  userSessions.set(userId, sessionToken);
}

// Helper function to get encrypted Gmail tokens
async function getGmailTokens(userId) {
  try {
    const sessionToken = getUserSessionToken(userId);
    if (!sessionToken) {
      console.log(`No active session for user ${userId}`);
      return null;
    }

    const { data, error } = await supabase.rpc('get_decrypted_gmail_tokens', {
      p_user_id: userId,
      p_session_token: sessionToken
    });

    if (error) {
      console.error('Error getting Gmail tokens:', error);
      return null;
    }

    if (!data.success) {
      console.log(`No Gmail tokens found for user ${userId}`);
      return null;
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type,
      expiry_date: new Date(data.expires_at).getTime()
    };
  } catch (error) {
    console.error('Error in getGmailTokens:', error);
    return null;
  }
}

// Helper function to store encrypted Gmail tokens
async function storeGmailTokens(userId, tokens) {
  try {
    const sessionToken = getUserSessionToken(userId);
    if (!sessionToken) {
      console.error('No active session for storing tokens');
      return { success: false, error: 'No active session' };
    }

    const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : 
                     new Date(Date.now() + 3600000).toISOString(); // 1 hour default

    const { data, error } = await supabase.rpc('store_encrypted_gmail_tokens', {
      p_user_id: userId,
      p_session_token: sessionToken,
      p_access_token: tokens.access_token,
      p_refresh_token: tokens.refresh_token,
      p_token_type: tokens.token_type || 'Bearer',
      p_expires_at: expiresAt,
      p_scope: tokens.scope
    });

    if (error) {
      console.error('Error storing Gmail tokens:', error);
      return { success: false, error: 'Failed to store tokens' };
    }

    console.log(`Gmail tokens stored securely for user ${userId}`);
    return data;
  } catch (error) {
    console.error('Error in storeGmailTokens:', error);
    return { success: false, error: 'Internal error' };
  }
}

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
  gmail_unread: {
    endpoint: '/api/gmail/unread',
    method: 'GET',
    description: 'Get unread emails',
    parameters: ['userId', 'maxResults?'],
    example: 'Show my unread emails',
    implementation: 'executeGmailUnread'
  },
  gmail_search: {
    endpoint: '/api/gmail/search',
    method: 'GET',
    description: 'Search emails by query',
    parameters: ['userId', 'query', 'maxResults?'],
    example: 'Search emails for "project update"',
    implementation: 'executeGmailSearch'
  },
  gmail_search_sender: {
    endpoint: '/api/gmail/search-by-sender',
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
  gmail_emails: {
    endpoint: '/api/gmail/emails',
    method: 'GET',
    description: 'Get emails from inbox',
    parameters: ['userId', 'query?', 'maxResults?'],
    example: 'Show my emails',
    implementation: 'executeGmailEmails'
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

  // General Query
  general_query: {
    endpoint: 'GENERAL_CHAT',
    method: 'CHAT',
    description: 'General conversation with AI assistant',
    parameters: ['message'],
    example: 'What is the weather like? How do I cook pasta? Explain quantum physics',
    implementation: 'executeGeneralQuery'
  }
};

// Initialize user session when they access the AI assistant
app.post('/api/init-session', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID required' });
    }

    // Generate a secure session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    setUserSessionToken(userId, sessionToken);

    console.log(`Secure session initialized for user ${userId}`);
    res.json({ success: true, sessionId: sessionToken });
  } catch (error) {
    console.error('Error initializing session:', error);
    res.status(500).json({ success: false, error: 'Failed to initialize session' });
  }
});

// Gmail OAuth - Get authorization URL
app.get('/api/gmail/auth-url', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID required' });
    }

    // Initialize session for this user
    const sessionToken = crypto.randomBytes(32).toString('hex');
    setUserSessionToken(userId, sessionToken);

    const oauth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      `${VITE_AI_API_URL}/auth/gmail/callback`
    );

    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: userId, // Pass user ID in state
      prompt: 'consent' // Force consent to get refresh token
    });

    res.json({ success: true, authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ success: false, error: 'Failed to generate auth URL' });
  }
});

// Gmail OAuth callback
app.get('/auth/gmail/callback', async (req, res) => {
  try {
    const { code, state: userId } = req.query;

    if (!code || !userId) {
      return res.redirect(`${FRONTEND_URL}/assistant?error=auth_failed`);
    }

    console.log('Gmail OAuth callback for user:', userId);

    // Exchange code for tokens
    const oauth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      `${VITE_AI_API_URL}/auth/gmail/callback`
    );
    
    const { tokens } = await oauth2Client.getAccessToken(code);
    console.log('Received tokens from Google:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expires_in,
      expiryDate: tokens.expiry_date
    });

    // Store encrypted tokens
    const result = await storeGmailTokens(userId, tokens);
    
    if (!result.success) {
      console.error('Failed to store tokens:', result.error);
      return res.redirect(`${FRONTEND_URL}/assistant?error=token_storage_failed`);
    }

    // Redirect back to assistant with success
    res.redirect(`${FRONTEND_URL}/assistant?gmail_connected=true`);
  } catch (error) {
    console.error('Gmail OAuth callback error:', error);
    res.redirect(`${FRONTEND_URL}/assistant?error=oauth_failed`);
  }
});

// Check Gmail connection status
app.get('/api/gmail/status', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID required' });
    }

    const tokens = await getGmailTokens(userId);
    
    if (!tokens) {
      return res.json({ connected: false });
    }

    // Try to get user profile to verify connection
    const oauth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET
    );
    oauth2Client.setCredentials(tokens);

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    try {
      const profile = await gmail.users.getProfile({ userId: 'me' });
      
      res.json({
        connected: true,
        email: profile.data.emailAddress,
        unreadCount: profile.data.messagesTotal
      });
    } catch (gmailError) {
      console.error('Gmail API error:', gmailError);
      res.json({ connected: false });
    }
  } catch (error) {
    console.error('Error checking Gmail status:', error);
    res.json({ connected: false });
  }
});

// Disconnect Gmail
app.post('/api/gmail/disconnect', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID required' });
    }

    // Revoke tokens using secure function
    const { data, error } = await supabase.rpc('revoke_gmail_tokens', {
      p_user_id: userId
    });

    if (error) {
      console.error('Error revoking tokens:', error);
      return res.status(500).json({ success: false, error: 'Failed to disconnect' });
    }

    // Clear session
    userSessions.delete(userId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting Gmail:', error);
    res.status(500).json({ success: false, error: 'Failed to disconnect' });
  }
});

// Get Gmail emails with enhanced security
app.get('/api/gmail/emails', async (req, res) => {
  try {
    const { userId, query = '', maxResults = 10 } = req.query;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID required' });
    }

    const tokens = await getGmailTokens(userId);
    
    if (!tokens) {
      return res.status(401).json({ success: false, error: 'Gmail not connected' });
    }

    const oauth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET
    );
    oauth2Client.setCredentials(tokens);

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Search for emails
    const searchQuery = query || 'in:inbox';
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: searchQuery,
      maxResults: parseInt(maxResults)
    });

    if (!response.data.messages) {
      return res.json({ success: true, emails: [] });
    }

    // Get detailed email information
    const emails = await Promise.all(
      response.data.messages.slice(0, 10).map(async (message) => {
        try {
          const emailData = await gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject', 'Date']
          });

          const headers = emailData.data.payload.headers;
          const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
          const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
          const date = headers.find(h => h.name === 'Date')?.value || '';

          return {
            id: message.id,
            threadId: message.threadId,
            from,
            subject,
            date,
            snippet: emailData.data.snippet,
            isUnread: emailData.data.labelIds?.includes('UNREAD') || false
          };
        } catch (error) {
          console.error('Error fetching email details:', error);
          return null;
        }
      })
    );

    const validEmails = emails.filter(email => email !== null);

    res.json({ success: true, emails: validEmails });
  } catch (error) {
    console.error('Error fetching emails:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch emails' });
  }
});

// Get single email with body
app.get('/api/gmail/email/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID required' });
    }

    const tokens = await getGmailTokens(userId);
    
    if (!tokens) {
      return res.status(401).json({ success: false, error: 'Gmail not connected' });
    }

    const oauth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET
    );
    oauth2Client.setCredentials(tokens);

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const emailData = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });

    // Extract email body
    let body = '';
    const payload = emailData.data.payload;
    
    if (payload.parts) {
      const textPart = payload.parts.find(part => part.mimeType === 'text/html') ||
                      payload.parts.find(part => part.mimeType === 'text/plain');
      if (textPart && textPart.body.data) {
        body = Buffer.from(textPart.body.data, 'base64').toString();
      }
    } else if (payload.body.data) {
      body = Buffer.from(payload.body.data, 'base64').toString();
    }

    const headers = payload.headers;
    const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
    const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
    const date = headers.find(h => h.name === 'Date')?.value || '';

    res.json({
      success: true,
      email: {
        id: messageId,
        from,
        subject,
        date,
        body,
        isUnread: emailData.data.labelIds?.includes('UNREAD') || false
      }
    });
  } catch (error) {
    console.error('Error fetching email:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch email' });
  }
});

// Delete emails
app.post('/api/gmail/delete-emails', async (req, res) => {
  try {
    const { userId, messageIds } = req.body;
    
    if (!userId || !messageIds || !Array.isArray(messageIds)) {
      return res.status(400).json({ success: false, error: 'Invalid request' });
    }

    const tokens = await getGmailTokens(userId);
    
    if (!tokens) {
      return res.status(401).json({ success: false, error: 'Gmail not connected' });
    }

    const oauth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET
    );
    oauth2Client.setCredentials(tokens);

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    let deleted = 0;
    let failed = 0;

    for (const messageId of messageIds) {
      try {
        await gmail.users.messages.delete({
          userId: 'me',
          id: messageId
        });
        deleted++;
      } catch (error) {
        console.error(`Failed to delete message ${messageId}:`, error);
        failed++;
      }
    }

    res.json({ success: true, deleted, failed });
  } catch (error) {
    console.error('Error deleting emails:', error);
    res.status(500).json({ success: false, error: 'Failed to delete emails' });
  }
});

// Enhanced AI Agent Processing with complete endpoint access
app.post('/api/chat/agent-process', async (req, res) => {
  try {
    const { message, userId, context = {} } = req.body;

    if (!message || !userId) {
      return res.status(400).json({ success: false, error: 'Message and user ID required' });
    }

    // Initialize session if not exists
    if (!getUserSessionToken(userId)) {
      const sessionToken = crypto.randomBytes(32).toString('hex');
      setUserSessionToken(userId, sessionToken);
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
   - For promotional/marketing emails, use the gmail_promotions endpoint

4. For general chat:
   - Answer questions about any topic (weather, cooking, science, etc.)
   - Provide helpful information and explanations
   - Be conversational and friendly
   - Don't mention technical endpoints or implementation details

5. You have access to ALL these functions:
   - Gmail management (read, search, delete, summarize emails, find promotional/marketing emails)
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
    case 'executeGmailEmails':
      return await executeGmailEmails(parameters.userId, parameters.query, parameters.maxResults);

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

// Implementation functions for all endpoints

// Gmail Functions
async function executeGmailStatus(userId) {
  try {
    const tokens = await getGmailTokens(userId);
    if (!tokens) {
      return { success: true, connected: false };
    }

    const oauth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET
    );
    oauth2Client.setCredentials(tokens);

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    
    return { 
      success: true, 
      connected: true, 
      email: profile.data.emailAddress,
      unreadCount: profile.data.messagesTotal 
    };
  } catch (error) {
    return { success: true, connected: false };
  }
}

async function executeGmailConnect(userId) {
  try {
    const oauth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      `${VITE_AI_API_URL}/auth/gmail/callback`
    );

    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: userId,
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

    // Clear session
    userSessions.delete(userId);

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function executeGmailEmails(userId, query = '', maxResults = 10) {
  try {
    const tokens = await getGmailTokens(userId);
    if (!tokens) {
      return { success: false, error: 'Gmail not connected' };
    }

    const oauth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET
    );
    oauth2Client.setCredentials(tokens);

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const searchQuery = query || 'in:inbox';
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: searchQuery,
      maxResults: parseInt(maxResults)
    });

    const messages = response.data.messages || [];
    const emails = [];

    for (const message of messages) {
      const emailData = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date']
      });

      const headers = emailData.data.payload.headers;
      const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
      const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
      const date = headers.find(h => h.name === 'Date')?.value || '';

      emails.push({
        id: message.id,
        from,
        subject,
        date,
        snippet: emailData.data.snippet || '',
        isUnread: emailData.data.labelIds?.includes('UNREAD') || false
      });
    }

    return { success: true, emails };
  } catch (error) {
    console.error('Error fetching emails:', error);
    return { success: false, error: 'Failed to fetch emails' };
  }
}

async function executeGmailUnread(userId, maxResults = 20) {
  try {
    const tokens = await getGmailTokens(userId);
    if (!tokens) {
      return { success: false, error: 'Gmail not connected' };
    }

    const oauth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET
    );
    oauth2Client.setCredentials(tokens);

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
      maxResults: parseInt(maxResults)
    });

    const messages = response.data.messages || [];
    const emails = [];

    for (const message of messages.slice(0, maxResults)) {
      const emailData = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date']
      });

      const headers = emailData.data.payload.headers;
      const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
      const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
      const date = headers.find(h => h.name === 'Date')?.value || '';

      emails.push({
        id: message.id,
        from,
        subject,
        date,
        snippet: emailData.data.snippet || '',
        isUnread: true
      });
    }

    return { success: true, emails, totalCount: emails.length };
  } catch (error) {
    console.error('Error fetching unread emails:', error);
    return { success: false, error: 'Failed to fetch unread emails' };
  }
}

async function executeGmailSearch(userId, query, maxResults = 10) {
  try {
    const tokens = await getGmailTokens(userId);
    if (!tokens) {
      return { success: false, error: 'Gmail not connected' };
    }

    const oauth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET
    );
    oauth2Client.setCredentials(tokens);

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: parseInt(maxResults)
    });

    const messages = response.data.messages || [];
    const emails = [];

    for (const message of messages) {
      const emailData = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date']
      });

      const headers = emailData.data.payload.headers;
      const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
      const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
      const date = headers.find(h => h.name === 'Date')?.value || '';

      emails.push({
        id: message.id,
        from,
        subject,
        date,
        snippet: emailData.data.snippet || '',
        isUnread: emailData.data.labelIds?.includes('UNREAD') || false
      });
    }

    return { success: true, emails, query };
  } catch (error) {
    console.error('Error searching emails:', error);
    return { success: false, error: 'Failed to search emails' };
  }
}

async function executeGmailSearchSender(userId, sender, maxResults = 10) {
  const query = `from:${sender}`;
  return executeGmailSearch(userId, query, maxResults);
}

async function executeGmailGetEmail(userId, emailId) {
  try {
    const tokens = await getGmailTokens(userId);
    if (!tokens) {
      return { success: false, error: 'Gmail not connected' };
    }

    const oauth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET
    );
    oauth2Client.setCredentials(tokens);

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const emailData = await gmail.users.messages.get({
      userId: 'me',
      id: emailId,
      format: 'full'
    });

    const headers = emailData.data.payload.headers;
    const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
    const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
    const date = headers.find(h => h.name === 'Date')?.value || '';

    // Extract body
    let body = '';
    if (emailData.data.payload.body.data) {
      body = Buffer.from(emailData.data.payload.body.data, 'base64').toString();
    } else if (emailData.data.payload.parts) {
      for (const part of emailData.data.payload.parts) {
        if (part.mimeType === 'text/html' || part.mimeType === 'text/plain') {
          if (part.body.data) {
            body = Buffer.from(part.body.data, 'base64').toString();
            break;
          }
        }
      }
    }

    return {
      success: true,
      email: {
        id: emailId,
        from,
        subject,
        date,
        body,
        snippet: emailData.data.snippet || ''
      }
    };
  } catch (error) {
    console.error('Error fetching email:', error);
    return { success: false, error: 'Failed to fetch email' };
  }
}

async function executeGmailDeleteEmails(userId, messageIds) {
  try {
    const tokens = await getGmailTokens(userId);
    if (!tokens) {
      return { success: false, error: 'Gmail not connected' };
    }

    const oauth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET
    );
    oauth2Client.setCredentials(tokens);

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    let deleted = 0;
    let failed = 0;

    for (const messageId of messageIds) {
      try {
        await gmail.users.messages.delete({
          userId: 'me',
          id: messageId
        });
        deleted++;
      } catch (error) {
        console.error(`Failed to delete message ${messageId}:`, error);
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
    const tokens = await getGmailTokens(userId);
    if (!tokens) {
      return { success: false, error: 'Gmail not connected' };
    }

    const oauth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET
    );
    oauth2Client.setCredentials(tokens);

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
    const tokens = await getGmailTokens(userId);
    if (!tokens) {
      return { success: false, error: 'Gmail not connected' };
    }

    const oauth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET
    );
    oauth2Client.setCredentials(tokens);

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

    // Extract tasks and events using AI
    const emailText = emails.map(email => 
      `From: ${email.from}\nSubject: ${email.subject}\nContent: ${email.snippet}`
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
    const tokens = await getGmailTokens(userId);
    if (!tokens) {
      return { success: false, error: 'Gmail not connected' };
    }

    const oauth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET
    );
    oauth2Client.setCredentials(tokens);

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Use Gmail's category:promotions search
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'category:promotions',
      maxResults: parseInt(maxResults)
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

// General chat endpoint
app.post('/api/chat/general', async (req, res) => {
  try {
    const { message, userId } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message required' });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    const prompt = `You are SimAlly, a helpful AI assistant. Respond to this message in a friendly and informative way: "${message}"`;
    
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    res.json({ success: true, response });
  } catch (error) {
    console.error('Error in general chat:', error);
    res.status(500).json({ success: false, error: 'Failed to generate response' });
  }
});

// Additional endpoints for backward compatibility
app.get('/api/gmail/unread', async (req, res) => {
  try {
    const { userId, maxResults } = req.query;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    const result = await executeGmailUnread(userId, maxResults);
    res.json(result);
  } catch (error) {
    console.error('Error getting unread emails:', error);
    res.status(500).json({ success: false, error: 'Failed to get unread emails' });
  }
});

app.get('/api/gmail/search', async (req, res) => {
  try {
    const { userId, query, maxResults } = req.query;
    
    if (!userId || !query) {
      return res.status(400).json({ success: false, error: 'User ID and query are required' });
    }

    const result = await executeGmailSearch(userId, query, maxResults);
    res.json(result);
  } catch (error) {
    console.error('Error searching emails:', error);
    res.status(500).json({ success: false, error: 'Failed to search emails' });
  }
});

app.get('/api/gmail/search-by-sender', async (req, res) => {
  try {
    const { userId, sender, maxResults } = req.query;
    
    if (!userId || !sender) {
      return res.status(400).json({ success: false, error: 'User ID and sender are required' });
    }

    const result = await executeGmailSearchSender(userId, sender, maxResults);
    res.json(result);
  } catch (error) {
    console.error('Error searching emails by sender:', error);
    res.status(500).json({ success: false, error: 'Failed to search emails by sender' });
  }
});

app.post('/api/gmail/summarize-emails', async (req, res) => {
  try {
    const { userId, messageIds } = req.body;
    
    if (!userId || !messageIds) {
      return res.status(400).json({ success: false, error: 'User ID and message IDs are required' });
    }

    const result = await executeGmailSummarize(userId, messageIds);
    res.json(result);
  } catch (error) {
    console.error('Error summarizing emails:', error);
    res.status(500).json({ success: false, error: 'Failed to summarize emails' });
  }
});

app.post('/api/gmail/extract-tasks-events', async (req, res) => {
  try {
    const { userId, messageIds } = req.body;
    
    if (!userId || !messageIds) {
      return res.status(400).json({ success: false, error: 'User ID and message IDs are required' });
    }

    const result = await executeGmailExtractTasks(userId, messageIds);
    res.json(result);
  } catch (error) {
    console.error('Error extracting tasks and events:', error);
    res.status(500).json({ success: false, error: 'Failed to extract tasks and events' });
  }
});

app.get('/api/gmail/promotions', async (req, res) => {
  try {
    const { userId, maxResults } = req.query;
    const result = await executeGmailPromotions(userId, maxResults);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch promotional emails' });
  }
});

app.post('/api/documents/generate', async (req, res) => {
  try {
    const result = await executeDocumentGenerate(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error generating document:', error);
    res.status(500).json({ success: false, error: 'Failed to generate document' });
  }
});

app.post('/api/meetings/auto-notes', async (req, res) => {
  try {
    const result = await executeMeetingAutoNotes(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error generating auto notes:', error);
    res.status(500).json({ success: false, error: 'Failed to generate auto notes' });
  }
});

app.post('/api/meetings/summary', async (req, res) => {
  try {
    const result = await executeMeetingSummary(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error generating meeting summary:', error);
    res.status(500).json({ success: false, error: 'Failed to generate meeting summary' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'ai-assistant',
    timestamp: new Date().toISOString(),
    security: 'enhanced',
    endpoints: Object.keys(WEBAPP_ENDPOINTS).length
  });
});

// Cleanup expired sessions periodically
setInterval(() => {
  console.log('Session cleanup - Active sessions:', userSessions.size);
}, 60000); // Every minute

app.listen(PORT, () => {
  console.log(`AI Assistant server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Enhanced security features enabled with ${Object.keys(WEBAPP_ENDPOINTS).length} endpoints`);
});

module.exports = app;
