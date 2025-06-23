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

// Gmail OAuth configuration
const oauth2Client = new OAuth2Client(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

// API Endpoints Documentation for AI Assistant
const API_ENDPOINTS = {
  // Workspace endpoints
  "POST /api/chat/process-message": {
    description: "Process chat messages for AI task detection and workspace management",
    parameters: ["message", "messageId", "channelId", "senderId", "mentions", "userId"]
  },
  "GET /workspace/channels": {
    description: "Get all channels for a user",
    parameters: ["userId"]
  },
  "POST /workspace/channels": {
    description: "Create a new channel",
    parameters: ["name", "description", "type", "created_by"]
  },
  "GET /workspace/messages/:channelId": {
    description: "Get messages for a specific channel",
    parameters: ["channelId", "limit"]
  },
  "POST /workspace/messages": {
    description: "Send a message to a channel",
    parameters: ["channel_id", "sender_id", "content", "type", "attachments"]
  },
  "GET /workspace/tasks": {
    description: "Get tasks for a user",
    parameters: ["userId", "status", "assigned_to"]
  },
  "POST /workspace/tasks": {
    description: "Create a new task",
    parameters: ["title", "description", "priority", "due_date", "created_by", "assigned_to"]
  },
  "PUT /workspace/tasks/:taskId": {
    description: "Update a task",
    parameters: ["taskId", "status", "priority", "due_date", "title", "description"]
  },
  "GET /workspace/calendar": {
    description: "Get calendar events for a user",
    parameters: ["userId", "start_date", "end_date"]
  },
  "POST /workspace/calendar": {
    description: "Create a calendar event",
    parameters: ["title", "description", "start_time", "end_time", "user_id", "task_id"]
  },
  
  // Gmail endpoints
  "GET /api/gmail/status": {
    description: "Check Gmail connection status for a user",
    parameters: ["userId"]
  },
  "GET /api/gmail/auth-url": {
    description: "Get Gmail OAuth authorization URL",
    parameters: ["userId"]
  },
  "POST /api/gmail/disconnect": {
    description: "Disconnect Gmail for a user",
    parameters: ["userId"]
  },
  "GET /api/gmail/unread": {
    description: "Get unread emails from Gmail",
    parameters: ["userId", "maxResults"]
  },
  "GET /api/gmail/search": {
    description: "Search emails in Gmail",
    parameters: ["userId", "query", "maxResults"]
  },
  "GET /api/gmail/search-by-sender": {
    description: "Search emails by sender",
    parameters: ["userId", "sender", "maxResults"]
  },
  "POST /api/gmail/summarize-emails": {
    description: "Generate AI summary of emails",
    parameters: ["userId", "messageIds"]
  },
  "POST /api/gmail/extract-tasks-events": {
    description: "Extract tasks and events from emails using AI",
    parameters: ["userId", "messageIds"]
  },
  "POST /api/gmail/delete-emails": {
    description: "Delete multiple emails",
    parameters: ["userId", "messageIds"]
  },
  "GET /api/gmail/email/:messageId": {
    description: "Get full email content",
    parameters: ["messageId", "userId"]
  },
  
  // Meeting endpoints
  "POST /meetings/start": {
    description: "Start a new video meeting",
    parameters: ["roomName", "displayName", "userId"]
  },
  "POST /meetings/join": {
    description: "Join an existing video meeting",
    parameters: ["roomName", "displayName", "userId"]
  },
  "POST /meetings/end": {
    description: "End a video meeting",
    parameters: ["roomName", "userId"]
  },
  "GET /meetings/status": {
    description: "Get meeting status and participants",
    parameters: ["roomName"]
  },
  "POST /api/meetings/auto-notes": {
    description: "Generate automatic meeting notes from speech",
    parameters: ["text", "speaker", "userId"]
  },
  "POST /api/meetings/summary": {
    description: "Generate meeting summary from transcript",
    parameters: ["transcript", "participants", "duration"]
  },
  
  // Document generation endpoints
  "POST /api/documents/generate": {
    description: "Generate documents using AI",
    parameters: ["prompt", "documentType", "format"]
  },
  "GET /api/documents/templates": {
    description: "Get available document templates",
    parameters: ["category"]
  },
  
  // Game mode endpoints
  "POST /api/create-riddle-conversation": {
    description: "Start a riddle game conversation",
    parameters: ["user_id"]
  },
  "POST /api/create-twenty-questions-user-asks": {
    description: "Start 20 questions game where user asks",
    parameters: ["user_id"]
  },
  "POST /api/create-twenty-questions-ai-asks": {
    description: "Start 20 questions game where AI asks",
    parameters: ["user_id"]
  },
  "POST /api/end-conversation": {
    description: "End any active game conversation",
    parameters: ["user_id"]
  },
  
  // User management endpoints
  "GET /api/users/profile": {
    description: "Get user profile information",
    parameters: ["userId"]
  },
  "PUT /api/users/profile": {
    description: "Update user profile",
    parameters: ["userId", "full_name", "avatar_url", "status"]
  },
  "GET /api/users/search": {
    description: "Search for users",
    parameters: ["query", "limit"]
  }
};

// Enhanced AI Agent Processing
app.post('/api/chat/agent-process', async (req, res) => {
  try {
    const { message, userId, context } = req.body;
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    const prompt = `You are SimAlly, a powerful AI assistant with access to a comprehensive workspace platform. 

Available API endpoints and their capabilities:
${JSON.stringify(API_ENDPOINTS, null, 2)}

User message: "${message}"
User context: ${JSON.stringify(context)}

Analyze the user's request and determine:
1. What the user wants to accomplish
2. Which API endpoint(s) should be called
3. What parameters are needed
4. If it's a general conversation that doesn't require API calls

Respond in this JSON format:
{
  "intent": "gmail_management|workspace_management|meeting_management|document_generation|game_mode|general_chat",
  "subIntent": "specific_action_like_list_unread|search_emails|create_task|start_meeting|etc",
  "apiCalls": [
    {
      "endpoint": "exact_endpoint_path",
      "method": "GET|POST|PUT|DELETE",
      "parameters": {
        "param1": "value1",
        "param2": "value2"
      }
    }
  ],
  "response": "Natural language response to the user",
  "requiresConfirmation": false,
  "followUpQuestions": []
}

Examples:
- "show my unread emails" → gmail_management intent with list_unread subIntent
- "create a task for project review" → workspace_management intent with create_task subIntent  
- "start a meeting called daily standup" → meeting_management intent with start_meeting subIntent
- "generate a project proposal document" → document_generation intent
- "what's the weather like?" → general_chat intent (no API calls needed)

Be intelligent about extracting parameters from the user's message. For example:
- "search emails from john@company.com" should extract sender parameter
- "create task due tomorrow" should calculate the due_date
- "schedule meeting for 3pm" should extract time parameters

Only respond with valid JSON.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    try {
      const agentResponse = JSON.parse(response);
      res.json({ success: true, agent: agentResponse });
    } catch (parseError) {
      console.error('Failed to parse AI response:', response);
      res.json({
        success: true,
        agent: {
          intent: 'general_chat',
          response: 'I understand you want help with something. Could you please be more specific about what you\'d like me to do?',
          apiCalls: []
        }
      });
    }
  } catch (error) {
    console.error('Error in agent processing:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Store Gmail tokens
const storeGmailTokens = async (userId, tokens) => {
  try {
    // Calculate expiry time properly
    const expiresAt = new Date(Date.now() + (tokens.expiry_date || 3600000));
    
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
      throw error;
    }
    
    console.log('Gmail tokens stored successfully for user:', userId);
  } catch (error) {
    console.error('Error storing Gmail tokens:', error);
    throw error;
  }
};

// Get Gmail tokens
const getGmailTokens = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('gmail_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      console.log('No Gmail tokens found for user', userId);
      return null;
    }

    // Check if token is expired
    const now = new Date();
    const expiresAt = new Date(data.expires_at);
    
    if (now >= expiresAt) {
      console.log('Gmail token expired for user', userId);
      return null;
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type,
      expiry_date: expiresAt.getTime(),
      scope: data.scope
    };
  } catch (error) {
    console.error('Error getting Gmail tokens:', error);
    return null;
  }
};

// Gmail OAuth endpoints
app.get('/api/gmail/auth-url', (req, res) => {
  const { userId } = req.query;
  
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

  res.json({ success: true, authUrl });
});

app.get('/auth/gmail/callback', async (req, res) => {
  try {
    const { code, state: userId } = req.query;
    
    if (!code || !userId) {
      return res.redirect('http://localhost:5173/assistant?error=missing_params');
    }

    const { tokens } = await oauth2Client.getToken(code);
    await storeGmailTokens(userId, tokens);
    
    res.redirect('http://localhost:5173/assistant?gmail_connected=true');
  } catch (error) {
    console.error('Gmail OAuth callback error:', error);
    res.redirect('http://localhost:5173/assistant?error=oauth_failed');
  }
});

app.get('/api/gmail/status', async (req, res) => {
  try {
    const { userId } = req.query;
    console.log('Gmail status check for user', userId + ': checking...');
    
    const tokens = await getGmailTokens(userId);
    
    if (!tokens) {
      console.log('No Gmail tokens found for user', userId);
      console.log('Gmail status check for user', userId + ': disconnected');
      return res.json({ connected: false });
    }

    // Test the connection
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    try {
      const profile = await gmail.users.getProfile({ userId: 'me' });
      console.log('Gmail status check for user', userId + ': connected');
      res.json({ 
        connected: true, 
        email: profile.data.emailAddress,
        unreadCount: profile.data.messagesTotal 
      });
    } catch (apiError) {
      console.log('Gmail API error for user', userId + ':', apiError.message);
      console.log('Gmail status check for user', userId + ': disconnected');
      res.json({ connected: false });
    }
  } catch (error) {
    console.error('Error checking Gmail status:', error);
    res.json({ connected: false });
  }
});

app.post('/api/gmail/disconnect', async (req, res) => {
  try {
    const { userId } = req.body;
    
    const { error } = await supabase
      .from('gmail_tokens')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Error disconnecting Gmail:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting Gmail:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Gmail API endpoints
app.get('/api/gmail/unread', async (req, res) => {
  try {
    const { userId, maxResults = 20 } = req.query;
    
    const tokens = await getGmailTokens(userId);
    if (!tokens) {
      return res.status(401).json({ success: false, error: 'Gmail not connected' });
    }

    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
      maxResults: parseInt(maxResults)
    });

    if (!response.data.messages) {
      return res.json({ success: true, emails: [], totalCount: 0 });
    }

    const emails = await Promise.all(
      response.data.messages.map(async (message) => {
        const details = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date']
        });

        const headers = details.data.payload.headers;
        const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
        const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
        const date = headers.find(h => h.name === 'Date')?.value || '';

        return {
          id: message.id,
          threadId: message.threadId,
          from,
          subject,
          date,
          snippet: details.data.snippet,
          isUnread: true
        };
      })
    );

    res.json({ 
      success: true, 
      emails,
      totalCount: response.data.resultSizeEstimate || 0
    });
  } catch (error) {
    console.error('Error fetching unread emails:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/gmail/search', async (req, res) => {
  try {
    const { userId, query, maxResults = 10 } = req.query;
    
    const tokens = await getGmailTokens(userId);
    if (!tokens) {
      return res.status(401).json({ success: false, error: 'Gmail not connected' });
    }

    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: parseInt(maxResults)
    });

    if (!response.data.messages) {
      return res.json({ success: true, emails: [] });
    }

    const emails = await Promise.all(
      response.data.messages.map(async (message) => {
        const details = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date']
        });

        const headers = details.data.payload.headers;
        const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
        const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
        const date = headers.find(h => h.name === 'Date')?.value || '';

        return {
          id: message.id,
          threadId: message.threadId,
          from,
          subject,
          date,
          snippet: details.data.snippet,
          isUnread: details.data.labelIds?.includes('UNREAD') || false
        };
      })
    );

    res.json({ success: true, emails });
  } catch (error) {
    console.error('Error searching emails:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/gmail/search-by-sender', async (req, res) => {
  try {
    const { userId, sender, maxResults = 10 } = req.query;
    
    const tokens = await getGmailTokens(userId);
    if (!tokens) {
      return res.status(401).json({ success: false, error: 'Gmail not connected' });
    }

    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const searchQuery = `from:${sender}`;
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: searchQuery,
      maxResults: parseInt(maxResults)
    });

    if (!response.data.messages) {
      return res.json({ success: true, emails: [] });
    }

    const emails = await Promise.all(
      response.data.messages.map(async (message) => {
        const details = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date']
        });

        const headers = details.data.payload.headers;
        const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
        const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
        const date = headers.find(h => h.name === 'Date')?.value || '';

        return {
          id: message.id,
          threadId: message.threadId,
          from,
          subject,
          date,
          snippet: details.data.snippet,
          isUnread: details.data.labelIds?.includes('UNREAD') || false
        };
      })
    );

    res.json({ success: true, emails });
  } catch (error) {
    console.error('Error searching emails by sender:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/gmail/email/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.query;
    
    const tokens = await getGmailTokens(userId);
    if (!tokens) {
      return res.status(401).json({ success: false, error: 'Gmail not connected' });
    }

    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const details = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });

    // Extract email body
    let body = '';
    const payload = details.data.payload;
    
    if (payload.body && payload.body.data) {
      body = Buffer.from(payload.body.data, 'base64').toString();
    } else if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/html' && part.body && part.body.data) {
          body = Buffer.from(part.body.data, 'base64').toString();
          break;
        } else if (part.mimeType === 'text/plain' && part.body && part.body.data) {
          body = Buffer.from(part.body.data, 'base64').toString();
        }
      }
    }

    const headers = payload.headers;
    const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
    const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
    const date = headers.find(h => h.name === 'Date')?.value || '';

    const email = {
      id: messageId,
      threadId: details.data.threadId,
      from,
      subject,
      date,
      snippet: details.data.snippet,
      body,
      isUnread: details.data.labelIds?.includes('UNREAD') || false
    };

    res.json({ success: true, email });
  } catch (error) {
    console.error('Error fetching email details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/gmail/delete-emails', async (req, res) => {
  try {
    const { userId, messageIds } = req.body;
    
    const tokens = await getGmailTokens(userId);
    if (!tokens) {
      return res.status(401).json({ success: false, error: 'Gmail not connected' });
    }

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
    res.status(500).json({ success: false, error: error.message });
  }
});

// AI-powered email analysis
app.post('/api/gmail/summarize-emails', async (req, res) => {
  try {
    const { userId, messageIds } = req.body;
    
    const tokens = await getGmailTokens(userId);
    if (!tokens) {
      return res.status(401).json({ success: false, error: 'Gmail not connected' });
    }

    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Fetch email details
    const emails = await Promise.all(
      messageIds.map(async (messageId) => {
        const details = await gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date']
        });

        const headers = details.data.payload.headers;
        return {
          from: headers.find(h => h.name === 'From')?.value || 'Unknown',
          subject: headers.find(h => h.name === 'Subject')?.value || '(No Subject)',
          snippet: details.data.snippet
        };
      })
    );

    // Generate AI summary
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const emailText = emails.map(email => 
      `From: ${email.from}\nSubject: ${email.subject}\nContent: ${email.snippet}`
    ).join('\n\n---\n\n');

    const prompt = `Analyze these emails and provide a concise summary:

${emailText}

Provide:
1. Overall summary (2-3 sentences)
2. Key themes and topics
3. Important senders
4. Urgent items requiring attention
5. Suggested actions

Keep it professional and actionable.`;

    const result = await model.generateContent(prompt);
    const summary = result.response.text();

    res.json({ success: true, summary, emailCount: emails.length });
  } catch (error) {
    console.error('Error summarizing emails:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/gmail/extract-tasks-events', async (req, res) => {
  try {
    const { userId, messageIds } = req.body;
    
    const tokens = await getGmailTokens(userId);
    if (!tokens) {
      return res.status(401).json({ success: false, error: 'Gmail not connected' });
    }

    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Fetch email details
    const emails = await Promise.all(
      messageIds.map(async (messageId) => {
        const details = await gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'full'
        });

        // Extract body
        let body = details.data.snippet;
        const payload = details.data.payload;
        
        if (payload.body && payload.body.data) {
          body = Buffer.from(payload.body.data, 'base64').toString();
        } else if (payload.parts) {
          for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body && part.body.data) {
              body = Buffer.from(part.body.data, 'base64').toString();
              break;
            }
          }
        }

        const headers = payload.headers;
        return {
          from: headers.find(h => h.name === 'From')?.value || 'Unknown',
          subject: headers.find(h => h.name === 'Subject')?.value || '(No Subject)',
          body: body.substring(0, 1000) // Limit content
        };
      })
    );

    // Extract tasks and events using AI
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const emailText = emails.map(email => 
      `From: ${email.from}\nSubject: ${email.subject}\nContent: ${email.body}`
    ).join('\n\n---\n\n');

    const prompt = `Analyze these emails and extract actionable tasks and calendar events:

${emailText}

Extract:
1. Tasks (action items, to-dos, assignments)
2. Events (meetings, deadlines, appointments)

For each task, provide:
- title (brief description)
- priority (low/medium/high/urgent)
- due_date (if mentioned, format: YYYY-MM-DD)

For each event, provide:
- title
- start_time (if mentioned, format: YYYY-MM-DDTHH:MM:SS)
- end_time (if mentioned, format: YYYY-MM-DDTHH:MM:SS)

Respond in JSON format:
{
  "tasks": [{"title": "...", "priority": "...", "due_date": "..."}],
  "events": [{"title": "...", "start_time": "...", "end_time": "..."}]
}`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    try {
      const extracted = JSON.parse(response);
      
      // Create tasks in database
      const createdTasks = [];
      if (extracted.tasks && extracted.tasks.length > 0) {
        for (const task of extracted.tasks) {
          const { data, error } = await supabase
            .from('tasks')
            .insert({
              title: task.title,
              description: `Extracted from email`,
              priority: task.priority || 'medium',
              due_date: task.due_date || null,
              created_by: userId
            })
            .select()
            .single();
          
          if (!error && data) {
            createdTasks.push(data);
          }
        }
      }

      // Create events in database
      const createdEvents = [];
      if (extracted.events && extracted.events.length > 0) {
        for (const event of extracted.events) {
          const { data, error } = await supabase
            .from('calendar_events')
            .insert({
              title: event.title,
              description: `Extracted from email`,
              start_time: event.start_time,
              end_time: event.end_time || event.start_time,
              user_id: userId
            })
            .select()
            .single();
          
          if (!error && data) {
            createdEvents.push(data);
          }
        }
      }

      res.json({ 
        success: true, 
        tasksCreated: createdTasks.length,
        eventsCreated: createdEvents.length,
        tasks: createdTasks,
        events: createdEvents,
        summary: `Created ${createdTasks.length} tasks and ${createdEvents.length} events from your emails.`
      });
    } catch (parseError) {
      console.error('Failed to parse AI response:', response);
      res.json({ 
        success: true, 
        tasksCreated: 0,
        eventsCreated: 0,
        summary: 'No actionable items found in the emails.'
      });
    }
  } catch (error) {
    console.error('Error extracting tasks and events:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Document generation
app.post('/api/documents/generate', async (req, res) => {
  try {
    const { prompt, documentType = 'general', format = 'html' } = req.body;
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    const systemPrompt = `Generate a professional ${documentType} document based on the user's request. 
    
    Format the response as clean, well-structured ${format.toUpperCase()} with:
    - Proper headings and sections
    - Professional formatting
    - Clear structure and flow
    - Appropriate styling for ${format}
    
    User request: ${prompt}
    
    Generate a complete, production-ready document.`;

    const result = await model.generateContent(systemPrompt);
    const content = result.response.text();

    res.json({
      success: true,
      document: {
        type: documentType,
        format,
        content,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error generating document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Meeting features
app.post('/api/meetings/auto-notes', async (req, res) => {
  try {
    const { text, speaker, userId } = req.body;
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    const prompt = `Generate concise meeting notes from this speech segment:
    
    Speaker: ${speaker}
    Content: "${text}"
    
    Extract:
    - Key points discussed
    - Action items mentioned
    - Important decisions
    - Follow-up items
    
    Keep it brief and actionable. Only include significant content worth noting.`;

    const result = await model.generateContent(prompt);
    const notes = result.response.text();

    res.json({ success: true, notes });
  } catch (error) {
    console.error('Error generating auto notes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/meetings/summary', async (req, res) => {
  try {
    const { transcript, participants, duration } = req.body;
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    const prompt = `Generate a comprehensive meeting summary:
    
    Participants: ${participants.join(', ')}
    Duration: ${duration} minutes
    
    Transcript:
    ${transcript}
    
    Provide:
    1. Meeting Overview (2-3 sentences)
    2. Key Discussion Points
    3. Decisions Made
    4. Action Items (with assignees if mentioned)
    5. Next Steps
    6. Follow-up Required
    
    Format as a professional meeting summary.`;

    const result = await model.generateContent(prompt);
    const summary = result.response.text();

    res.json({ success: true, summary });
  } catch (error) {
    console.error('Error generating meeting summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Workspace message processing
app.post('/api/chat/process-message', async (req, res) => {
  try {
    const { message, messageId, channelId, senderId, mentions, userId } = req.body;
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    const prompt = `Analyze this workspace message for task creation opportunities:
    
    Message: "${message}"
    Mentions: ${mentions ? mentions.join(', ') : 'none'}
    
    Determine if this message contains:
    1. A task or action item
    2. An assignment to someone
    3. A deadline or due date
    
    If a task should be created, respond with JSON:
    {
      "hasTask": true,
      "title": "brief task title",
      "description": "detailed description",
      "priority": "low|medium|high|urgent",
      "assignee": "username if mentioned, null otherwise",
      "dueDate": "YYYY-MM-DD if mentioned, null otherwise"
    }
    
    If no task is needed, respond with:
    {
      "hasTask": false
    }
    
    Only respond with valid JSON.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    try {
      const taskData = JSON.parse(response);
      
      if (!taskData.hasTask) {
        return res.json({ success: true, taskCreated: false });
      }

      // Create task in database
      const { data: task, error } = await supabase
        .from('tasks')
        .insert({
          title: taskData.title,
          description: taskData.description,
          priority: taskData.priority || 'medium',
          created_by: senderId,
          source_message_id: messageId,
          due_date: taskData.dueDate
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating task:', error);
        return res.json({ success: true, taskCreated: false });
      }

      // Assign task if assignee mentioned
      if (taskData.assignee && mentions.includes(taskData.assignee)) {
        const { data: assigneeUser } = await supabase
          .from('profiles')
          .select('id, username')
          .eq('username', taskData.assignee)
          .single();
        
        if (assigneeUser) {
          await supabase
            .from('task_assignments')
            .insert({
              task_id: task.id,
              user_id: assigneeUser.id
            });
        }
      }

      res.json({
        success: true,
        taskCreated: true,
        task: {
          id: task.id,
          title: task.title,
          assignee: taskData.assignee
        }
      });
    } catch (parseError) {
      console.error('Failed to parse AI response:', response);
      res.json({ success: true, taskCreated: false });
    }
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'AI Assistant',
    endpoints: Object.keys(API_ENDPOINTS).length,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`AI Assistant server running on http://localhost:${PORT}`);
  console.log(`Available endpoints: ${Object.keys(API_ENDPOINTS).length}`);
});