const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { OAuth2Client } = require('google-auth-library');
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.AI_ASSISTANT_PORT || 8001;

// Initialize services
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Complete endpoint mapping for our webapp
const WEBAPP_ENDPOINTS = {
  // Gmail Management
  gmail_status: {
    endpoint: '/api/gmail/status',
    method: 'GET',
    description: 'Check Gmail connection status for user',
    parameters: ['userId'],
    example: 'Check my Gmail status'
  },
  gmail_connect: {
    endpoint: '/api/gmail/auth-url',
    method: 'GET',
    description: 'Get Gmail OAuth URL for connection',
    parameters: ['userId'],
    example: 'Connect my Gmail account'
  },
  gmail_disconnect: {
    endpoint: '/api/gmail/disconnect',
    method: 'POST',
    description: 'Disconnect Gmail account',
    parameters: ['userId'],
    example: 'Disconnect Gmail'
  },
  gmail_unread: {
    endpoint: '/api/gmail/unread',
    method: 'GET',
    description: 'Get unread emails',
    parameters: ['userId', 'maxResults?'],
    example: 'Show my unread emails'
  },
  gmail_search: {
    endpoint: '/api/gmail/search',
    method: 'GET',
    description: 'Search emails by query',
    parameters: ['userId', 'query', 'maxResults?'],
    example: 'Search emails for "project update"'
  },
  gmail_search_sender: {
    endpoint: '/api/gmail/search-by-sender',
    method: 'GET',
    description: 'Search emails by sender',
    parameters: ['userId', 'sender', 'maxResults?'],
    example: 'Show emails from john@company.com'
  },
  gmail_get_email: {
    endpoint: '/api/gmail/email/:id',
    method: 'GET',
    description: 'Get full email content by ID',
    parameters: ['userId', 'emailId'],
    example: 'Show full email content'
  },
  gmail_delete_emails: {
    endpoint: '/api/gmail/delete-emails',
    method: 'POST',
    description: 'Delete multiple emails',
    parameters: ['userId', 'messageIds'],
    example: 'Delete selected emails'
  },
  gmail_summarize: {
    endpoint: '/api/gmail/summarize-emails',
    method: 'POST',
    description: 'AI summarize emails',
    parameters: ['userId', 'messageIds'],
    example: 'Summarize my recent emails'
  },
  gmail_extract_tasks: {
    endpoint: '/api/gmail/extract-tasks-events',
    method: 'POST',
    description: 'Extract tasks and events from emails',
    parameters: ['userId', 'messageIds'],
    example: 'Extract tasks from my emails'
  },

  // Workspace Management
  workspace_channels: {
    endpoint: '/api/workspace/channels',
    method: 'GET',
    description: 'Get user channels',
    parameters: ['userId'],
    example: 'Show my channels'
  },
  workspace_create_channel: {
    endpoint: '/api/workspace/channels',
    method: 'POST',
    description: 'Create new channel',
    parameters: ['name', 'description?', 'type', 'created_by'],
    example: 'Create a channel called "project-alpha"'
  },
  workspace_messages: {
    endpoint: '/api/workspace/messages/:channelId',
    method: 'GET',
    description: 'Get channel messages',
    parameters: ['channelId'],
    example: 'Show messages from general channel'
  },
  workspace_send_message: {
    endpoint: '/api/workspace/messages',
    method: 'POST',
    description: 'Send message to channel',
    parameters: ['channel_id', 'sender_id', 'content', 'type?', 'metadata?'],
    example: 'Send message to team channel'
  },
  workspace_tasks: {
    endpoint: '/api/workspace/tasks',
    method: 'GET',
    description: 'Get user tasks',
    parameters: ['userId'],
    example: 'Show my tasks'
  },
  workspace_create_task: {
    endpoint: '/api/workspace/tasks',
    method: 'POST',
    description: 'Create new task',
    parameters: ['title', 'description?', 'priority?', 'due_date?', 'created_by'],
    example: 'Create task "Review project proposal"'
  },
  workspace_update_task: {
    endpoint: '/api/workspace/tasks/:id',
    method: 'PUT',
    description: 'Update task status or details',
    parameters: ['taskId', 'status?', 'priority?', 'due_date?'],
    example: 'Mark task as completed'
  },
  workspace_assign_task: {
    endpoint: '/api/workspace/task-assignments',
    method: 'POST',
    description: 'Assign task to user',
    parameters: ['task_id', 'user_id'],
    example: 'Assign task to team member'
  },

  // Calendar Management
  calendar_events: {
    endpoint: '/api/calendar/events',
    method: 'GET',
    description: 'Get calendar events',
    parameters: ['userId', 'start_date?', 'end_date?'],
    example: 'Show my calendar events'
  },
  calendar_create_event: {
    endpoint: '/api/calendar/events',
    method: 'POST',
    description: 'Create calendar event',
    parameters: ['title', 'description?', 'start_time', 'end_time', 'user_id', 'task_id?'],
    example: 'Schedule meeting for tomorrow 2pm'
  },
  calendar_update_event: {
    endpoint: '/api/calendar/events/:id',
    method: 'PUT',
    description: 'Update calendar event',
    parameters: ['eventId', 'title?', 'start_time?', 'end_time?'],
    example: 'Reschedule meeting to 3pm'
  },
  calendar_delete_event: {
    endpoint: '/api/calendar/events/:id',
    method: 'DELETE',
    description: 'Delete calendar event',
    parameters: ['eventId'],
    example: 'Cancel tomorrow meeting'
  },

  // Meeting Management
  meeting_create_room: {
    endpoint: '/api/meetings/create-room',
    method: 'POST',
    description: 'Create video meeting room',
    parameters: ['roomName', 'displayName'],
    example: 'Create meeting room for daily standup'
  },
  meeting_join_room: {
    endpoint: '/api/meetings/join-room',
    method: 'POST',
    description: 'Join video meeting room',
    parameters: ['roomName', 'displayName'],
    example: 'Join meeting room "daily-standup"'
  },
  meeting_auto_notes: {
    endpoint: '/api/meetings/auto-notes',
    method: 'POST',
    description: 'Generate meeting notes from text',
    parameters: ['text', 'speaker', 'userId'],
    example: 'Generate notes from meeting transcript'
  },
  meeting_summary: {
    endpoint: '/api/meetings/summary',
    method: 'POST',
    description: 'Generate meeting summary',
    parameters: ['transcript', 'participants', 'duration'],
    example: 'Summarize our team meeting'
  },

  // Game Mode
  game_riddle: {
    endpoint: '/api/create-riddle-conversation',
    method: 'POST',
    description: 'Start riddle game',
    parameters: ['user_id?'],
    example: 'Start riddle game'
  },
  game_twenty_questions_user: {
    endpoint: '/api/create-twenty-questions-user-asks',
    method: 'POST',
    description: 'Start 20 questions (user asks)',
    parameters: ['user_id?'],
    example: 'Play 20 questions where I ask'
  },
  game_twenty_questions_ai: {
    endpoint: '/api/create-twenty-questions-ai-asks',
    method: 'POST',
    description: 'Start 20 questions (AI asks)',
    parameters: ['user_id?'],
    example: 'Play 20 questions where AI asks'
  },
  game_end_conversation: {
    endpoint: '/api/end-conversation',
    method: 'POST',
    description: 'End game conversation',
    parameters: ['user_id'],
    example: 'End current game'
  },

  // Document Generation
  document_generate: {
    endpoint: '/api/documents/generate',
    method: 'POST',
    description: 'Generate document with AI',
    parameters: ['prompt', 'documentType?', 'format?'],
    example: 'Generate project proposal document'
  },
  document_latex_to_pdf: {
    endpoint: '/api/documents/latex-to-pdf',
    method: 'POST',
    description: 'Convert LaTeX to PDF',
    parameters: ['latexContent', 'filename?'],
    example: 'Convert LaTeX document to PDF'
  },

  // Chat Processing
  chat_process_message: {
    endpoint: '/api/chat/process-message',
    method: 'POST',
    description: 'Process message for AI task detection',
    parameters: ['message', 'messageId', 'channelId', 'senderId', 'mentions?', 'userId'],
    example: 'Process chat message for tasks'
  },
  chat_agent_process: {
    endpoint: '/api/chat/agent-process',
    method: 'POST',
    description: 'Process message with AI agent',
    parameters: ['message', 'userId', 'context?'],
    example: 'Process user query with AI'
  },

  // General Query (New)
  general_query: {
    endpoint: 'GENERAL_CHAT',
    method: 'CHAT',
    description: 'General conversation with AI assistant',
    parameters: ['message'],
    example: 'What is the weather like? How do I cook pasta? Explain quantum physics'
  }
};

// Enhanced AI agent processing
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

    const systemPrompt = `You are SimAlly, a powerful AI assistant with access to a comprehensive webapp. 

AVAILABLE ENDPOINTS:
${endpointsList}

INSTRUCTIONS:
1. Analyze the user's message and determine the best response approach
2. If the message requires webapp functionality, respond with JSON in this exact format:
{
  "type": "endpoint_call",
  "endpoint": "endpoint_key_from_list",
  "parameters": {
    "param1": "value1",
    "param2": "value2"
  },
  "response": "Brief explanation of what you're doing"
}

3. If it's a general question/conversation, respond with JSON in this format:
{
  "type": "general_chat",
  "response": "Your helpful response to their question"
}

4. For endpoint calls:
   - Use exact endpoint keys from the list above
   - Extract parameters from the user message intelligently
   - Calculate dates/times when needed (e.g., "tomorrow" = tomorrow's date)
   - Use the provided userId: "${userId}" when needed
   - For optional parameters, only include if mentioned or relevant

5. For general chat:
   - Answer questions about any topic
   - Provide helpful information
   - Be conversational and friendly
   - Don't mention endpoints or technical details

CONTEXT: ${JSON.stringify(context)}

USER MESSAGE: "${message}"

Respond with the appropriate JSON format:`;

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

      // Return structured response for endpoint calling
      res.json({
        success: true,
        agent: {
          intent: 'endpoint_call',
          endpoint: parsedResponse.endpoint,
          parameters: parsedResponse.parameters,
          response: parsedResponse.response,
          config: endpointConfig
        }
      });

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

// Endpoint execution helper
app.post('/api/chat/execute-endpoint', async (req, res) => {
  try {
    const { endpoint, parameters, userId } = req.body;
    const config = WEBAPP_ENDPOINTS[endpoint];

    if (!config) {
      return res.status(400).json({ success: false, error: 'Invalid endpoint' });
    }

    let result;

    // Execute the appropriate endpoint based on the endpoint key
    switch (endpoint) {
      case 'gmail_unread':
        result = await executeGmailUnread(parameters.userId || userId, parameters.maxResults);
        break;
      
      case 'gmail_search':
        result = await executeGmailSearch(parameters.userId || userId, parameters.query, parameters.maxResults);
        break;
      
      case 'gmail_search_sender':
        result = await executeGmailSearchSender(parameters.userId || userId, parameters.sender, parameters.maxResults);
        break;
      
      case 'workspace_create_task':
        result = await executeCreateTask(parameters);
        break;
      
      case 'workspace_tasks':
        result = await executeGetTasks(parameters.userId || userId);
        break;
      
      case 'calendar_create_event':
        result = await executeCreateEvent(parameters);
        break;
      
      case 'document_generate':
        result = await executeGenerateDocument(parameters);
        break;
      
      default:
        result = { success: false, error: 'Endpoint not implemented yet' };
    }

    res.json(result);

  } catch (error) {
    console.error('Error executing endpoint:', error);
    res.status(500).json({ success: false, error: 'Failed to execute endpoint' });
  }
});

// Helper functions for endpoint execution
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

async function executeCreateTask(parameters) {
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
    console.error('Error creating task:', error);
    return { success: false, error: 'Failed to create task' };
  }
}

async function executeGetTasks(userId) {
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

    return { success: true, tasks: data };
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return { success: false, error: 'Failed to fetch tasks' };
  }
}

async function executeCreateEvent(parameters) {
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
    console.error('Error creating event:', error);
    return { success: false, error: 'Failed to create event' };
  }
}

async function executeGenerateDocument(parameters) {
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
    console.error('Error generating document:', error);
    return { success: false, error: 'Failed to generate document' };
  }
}

// Gmail token management functions
async function getGmailTokens(userId) {
  try {
    const { data, error } = await supabase
      .from('gmail_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      console.log(`No Gmail tokens found for user ${userId}`);
      return null;
    }

    // Check if token is expired
    const now = new Date();
    const expiresAt = new Date(data.expires_at);
    
    if (now >= expiresAt) {
      console.log(`Gmail token expired for user ${userId}`);
      // Try to refresh token
      return await refreshGmailToken(userId, data.refresh_token);
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type,
      expiry_date: expiresAt.getTime()
    };
  } catch (error) {
    console.error('Error getting Gmail tokens:', error);
    return null;
  }
}

async function refreshGmailToken(userId, refreshToken) {
  try {
    const oauth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    
    // Store refreshed tokens
    await storeGmailTokens(userId, credentials);
    
    return credentials;
  } catch (error) {
    console.error('Error refreshing Gmail token:', error);
    return null;
  }
}

async function storeGmailTokens(userId, tokens) {
  try {
    const expiresAt = new Date(tokens.expiry_date || Date.now() + 3600000);
    
    const { error } = await supabase
      .from('gmail_tokens')
      .upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: tokens.token_type || 'Bearer',
        expires_at: expiresAt.toISOString(),
        scope: tokens.scope,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error storing Gmail tokens:', error);
    } else {
      console.log(`Gmail tokens stored for user ${userId}`);
    }
  } catch (error) {
    console.error('Error storing Gmail tokens:', error);
  }
}

// Keep existing endpoints for backward compatibility
app.get('/api/gmail/status', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    console.log(`Gmail status check for user ${userId}: checking...`);
    
    const tokens = await getGmailTokens(userId);
    
    if (!tokens) {
      console.log(`Gmail status check for user ${userId}: disconnected`);
      return res.json({ connected: false });
    }

    // Test the connection
    try {
      const oauth2Client = new OAuth2Client(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET
      );
      oauth2Client.setCredentials(tokens);

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      const profile = await gmail.users.getProfile({ userId: 'me' });
      
      console.log(`Gmail status check for user ${userId}: connected`);
      return res.json({ 
        connected: true, 
        email: profile.data.emailAddress,
        unreadCount: profile.data.messagesTotal 
      });
    } catch (error) {
      console.log(`Gmail status check for user ${userId}: connection failed`);
      return res.json({ connected: false });
    }
  } catch (error) {
    console.error('Error checking Gmail status:', error);
    res.status(500).json({ success: false, error: 'Failed to check Gmail status' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`AI Assistant server running on http://localhost:${PORT}`);
});

module.exports = app;