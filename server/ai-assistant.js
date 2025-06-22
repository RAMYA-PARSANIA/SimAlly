const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.AI_ASSISTANT_PORT || 8001;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Serve static files for PDF downloads
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

// Ensure downloads directory exists
fs.ensureDirSync(path.join(__dirname, 'downloads'));

// Initialize services
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

// Gmail OAuth2 setup
const oauth2Client = new OAuth2Client(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

// Store user sessions (in production, use Redis or database)
const userSessions = new Map();
// WARNING: gmailTokens is in-memory only. Gmail connection will be lost on server restart.
// For production, persist tokens in a database.
const gmailTokens = new Map(); // Store Gmail tokens per user

// =============================================================================
// GMAIL AUTHENTICATION & SETUP
// =============================================================================

// Gmail OAuth2 authorization URL
app.get('/api/gmail/auth-url', (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID required' });
    }

    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.compose'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: userId, // Pass userId in state for callback
      prompt: 'consent'
    });

    res.json({ success: true, authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ success: false, error: 'Failed to generate auth URL' });
  }
});

// Gmail OAuth2 callback
app.get('/auth/gmail/callback', async (req, res) => {
  try {
    const { code, state: userId } = req.query;

    if (!code || !userId) {
      return res.status(400).send('Missing authorization code or user ID');
    }

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    // Store tokens for user
    gmailTokens.set(userId, {
      ...tokens,
      expiresAt: Date.now() + (tokens.expires_in * 1000)
    });

    console.log(`Gmail connected for user ${userId}`);

    // Redirect back to frontend with success
    res.redirect(`http://localhost:5173/assistant?gmail_connected=true`);
  } catch (error) {
    console.error('Gmail OAuth callback error:', error);
    res.redirect(`http://localhost:5173/assistant?gmail_error=true`);
  }
});

// Check Gmail connection status
app.get('/api/gmail/status', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID required' });
    }

    let tokens = gmailTokens.get(userId);

    // Try to refresh token if expired and refresh_token is available
    if (tokens && tokens.expiresAt <= Date.now() && tokens.refresh_token) {
      try {
        oauth2Client.setCredentials(tokens);
        const { credentials } = await oauth2Client.refreshAccessToken();
        tokens = {
          ...credentials,
          expiresAt: Date.now() + (credentials.expires_in * 1000),
          refresh_token: tokens.refresh_token // Google may not always return refresh_token
        };
        gmailTokens.set(userId, tokens);
        console.log(`Refreshed Gmail token for user ${userId} in status check`);
      } catch (err) {
        console.error('Failed to refresh Gmail token in status check:', err);
        gmailTokens.delete(userId);
        tokens = null;
      }
    }

    const isConnected = tokens && tokens.expiresAt > Date.now();

    console.log(`Gmail status check for user ${userId}: ${isConnected ? 'connected' : 'disconnected'}`);

    res.json({ 
      success: true, 
      connected: isConnected,
      email: tokens?.email || null
    });
  } catch (error) {
    console.error('Error checking Gmail status:', error);
    res.status(500).json({ success: false, error: 'Failed to check status' });
  }
});

// (Optional) Debug endpoint to view token state for a user
app.get('/api/gmail/debug-tokens', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'User ID required' });
  res.json(gmailTokens.get(userId) || {});
});

// Disconnect Gmail
app.post('/api/gmail/disconnect', (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID required' });
    }

    gmailTokens.delete(userId);
    console.log(`Gmail disconnected for user ${userId}`);
    res.json({ success: true, message: 'Gmail disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting Gmail:', error);
    res.status(500).json({ success: false, error: 'Failed to disconnect Gmail' });
  }
});

// =============================================================================
// GMAIL API HELPERS
// =============================================================================

const getGmailClient = (userId) => {
  const tokens = gmailTokens.get(userId);
  if (!tokens || tokens.expiresAt <= Date.now()) {
    throw new Error('Gmail not connected or token expired');
  }

  const client = new OAuth2Client(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );
  
  client.setCredentials(tokens);
  return google.gmail({ version: 'v1', auth: client });
};

const refreshTokenIfNeeded = async (userId) => {
  const tokens = gmailTokens.get(userId);
  if (!tokens) return false;

  // Refresh if token expires in next 5 minutes
  if (tokens.expiresAt - Date.now() < 5 * 60 * 1000) {
    try {
      oauth2Client.setCredentials(tokens);
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      gmailTokens.set(userId, {
        ...credentials,
        expiresAt: Date.now() + (credentials.expires_in * 1000)
      });
      
      console.log(`Token refreshed for user ${userId}`);
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      gmailTokens.delete(userId);
      return false;
    }
  }
  
  return true;
};

// =============================================================================
// GMAIL EMAIL OPERATIONS
// =============================================================================

// Get unread emails
app.get('/api/gmail/unread', async (req, res) => {
  try {
    const { userId, maxResults = 20 } = req.query;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID required' });
    }

    console.log(`Fetching unread emails for user ${userId}`);

    await refreshTokenIfNeeded(userId);
    const gmail = getGmailClient(userId);

    // Get unread message IDs
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
      maxResults: parseInt(maxResults)
    });

    if (!response.data.messages) {
      return res.json({ success: true, emails: [], totalCount: 0 });
    }

    console.log(`Found ${response.data.messages.length} unread messages`);

    // Get detailed message data
    const emails = await Promise.all(
      response.data.messages.map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date']
        });

        const headers = detail.data.payload.headers;
        const getHeader = (name) => headers.find(h => h.name === name)?.value || '';

        return {
          id: msg.id,
          threadId: msg.threadId,
          from: getHeader('From'),
          subject: getHeader('Subject') || '(No Subject)',
          date: getHeader('Date'),
          snippet: detail.data.snippet,
          isUnread: true
        };
      })
    );

    console.log(`Returning ${emails.length} unread emails`);

    res.json({ 
      success: true, 
      emails,
      totalCount: response.data.resultSizeEstimate || 0
    });

  } catch (error) {
    console.error('Error fetching unread emails:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch unread emails' });
  }
});

// Search emails by sender
app.get('/api/gmail/search-by-sender', async (req, res) => {
  try {
    const { userId, sender, maxResults = 50 } = req.query;
    
    if (!userId || !sender) {
      return res.status(400).json({ success: false, error: 'User ID and sender required' });
    }

    console.log(`Searching emails from sender ${sender} for user ${userId}`);

    await refreshTokenIfNeeded(userId);
    const gmail = getGmailClient(userId);

    // Search for emails from sender
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: `from:${sender}`,
      maxResults: parseInt(maxResults)
    });

    if (!response.data.messages) {
      return res.json({ success: true, emails: [] });
    }

    console.log(`Found ${response.data.messages.length} emails from ${sender}`);

    // Get detailed message data
    const emails = await Promise.all(
      response.data.messages.map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date']
        });

        const headers = detail.data.payload.headers;
        const getHeader = (name) => headers.find(h => h.name === name)?.value || '';

        return {
          id: msg.id,
          threadId: msg.threadId,
          from: getHeader('From'),
          subject: getHeader('Subject') || '(No Subject)',
          date: getHeader('Date'),
          snippet: detail.data.snippet,
          isUnread: detail.data.labelIds?.includes('UNREAD') || false
        };
      })
    );

    res.json({ success: true, emails });

  } catch (error) {
    console.error('Error searching emails by sender:', error);
    res.status(500).json({ success: false, error: 'Failed to search emails' });
  }
});

// Get email content for summarization
app.get('/api/gmail/email-content/:messageId', async (req, res) => {
  try {
    const { userId } = req.query;
    const { messageId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID required' });
    }

    await refreshTokenIfNeeded(userId);
    const gmail = getGmailClient(userId);

    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });

    const message = response.data;
    const headers = message.payload.headers;
    const getHeader = (name) => headers.find(h => h.name === name)?.value || '';

    // Extract email body
    let body = '';
    const extractBody = (payload) => {
      if (payload.body && payload.body.data) {
        return Buffer.from(payload.body.data, 'base64').toString('utf-8');
      }
      
      if (payload.parts) {
        for (const part of payload.parts) {
          if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
            if (part.body && part.body.data) {
              return Buffer.from(part.body.data, 'base64').toString('utf-8');
            }
          }
          
          const nested = extractBody(part);
          if (nested) return nested;
        }
      }
      
      return '';
    };

    body = extractBody(message.payload) || message.snippet || '';

    res.json({
      success: true,
      email: {
        id: messageId,
        from: getHeader('From'),
        subject: getHeader('Subject'),
        date: getHeader('Date'),
        body: body.substring(0, 5000), // Limit body size
        snippet: message.snippet
      }
    });

  } catch (error) {
    console.error('Error fetching email content:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch email content' });
  }
});

// Delete emails
app.post('/api/gmail/delete-emails', async (req, res) => {
  try {
    const { userId, messageIds } = req.body;
    
    if (!userId || !messageIds || !Array.isArray(messageIds)) {
      return res.status(400).json({ success: false, error: 'User ID and message IDs required' });
    }

    console.log(`Deleting ${messageIds.length} emails for user ${userId}`);

    await refreshTokenIfNeeded(userId);
    const gmail = getGmailClient(userId);

    // Delete emails in batches
    const batchSize = 10;
    const results = [];
    
    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batch = messageIds.slice(i, i + batchSize);
      
      const batchResults = await Promise.allSettled(
        batch.map(id => 
          gmail.users.messages.delete({
            userId: 'me',
            id: id
          })
        )
      );
      
      results.push(...batchResults);
    }

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`Deleted ${successful} emails, failed ${failed}`);

    res.json({
      success: true,
      deleted: successful,
      failed: failed,
      total: messageIds.length
    });

  } catch (error) {
    console.error('Error deleting emails:', error);
    res.status(500).json({ success: false, error: 'Failed to delete emails' });
  }
});

// =============================================================================
// AI EMAIL PROCESSING
// =============================================================================

// Summarize emails
app.post('/api/gmail/summarize-emails', async (req, res) => {
  try {
    const { userId, messageIds } = req.body;
    
    if (!userId || !messageIds || !Array.isArray(messageIds)) {
      return res.status(400).json({ success: false, error: 'User ID and message IDs required' });
    }

    console.log(`Summarizing ${messageIds.length} emails for user ${userId}`);

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    // Get email contents
    const emails = [];
    for (const messageId of messageIds.slice(0, 10)) { // Limit to 10 emails
      try {
        const contentResponse = await fetch(`http://localhost:${PORT}/api/gmail/email-content/${messageId}?userId=${userId}`);
        const contentData = await contentResponse.json();
        
        if (contentData.success) {
          emails.push(contentData.email);
        }
      } catch (error) {
        console.error(`Error fetching email ${messageId}:`, error);
      }
    }

    if (emails.length === 0) {
      return res.json({ success: true, summary: 'No emails to summarize', tasks: [], events: [] });
    }

    const prompt = `
      Analyze these emails and provide:
      1. A concise summary of all emails
      2. Extract any tasks, deadlines, or action items
      3. Identify any events, meetings, or calendar items
      4. Group similar emails together
      
      Emails:
      ${emails.map((email, i) => `
        Email ${i + 1}:
        From: ${email.from}
        Subject: ${email.subject}
        Date: ${email.date}
        Content: ${email.body}
        ---
      `).join('\n')}
      
      Respond in JSON format:
      {
        "summary": "Overall summary of all emails",
        "groups": [
          {
            "category": "Category name",
            "emails": ["email subjects"],
            "summary": "Summary of this group"
          }
        ],
        "tasks": [
          {
            "title": "Task title",
            "description": "Task description",
            "priority": "low|medium|high|urgent",
            "dueDate": "YYYY-MM-DD or null",
            "source": "Email subject that mentioned this task"
          }
        ],
        "events": [
          {
            "title": "Event title",
            "description": "Event description",
            "startTime": "YYYY-MM-DD HH:mm or null",
            "endTime": "YYYY-MM-DD HH:mm or null",
            "source": "Email subject that mentioned this event"
          }
        ]
      }
    `;

    const result = await model.generateContent(prompt);
    let response = result.response.text();

    // Clean response
    response = response.replace(/^```json\s*/i, '')
      .replace(/^```\s*/gm, '')
      .replace(/```$/gm, '')
      .trim();

    try {
      const analysis = JSON.parse(response);
      console.log(`Email analysis complete: ${analysis.tasks?.length || 0} tasks, ${analysis.events?.length || 0} events`);
      res.json({ success: true, ...analysis });
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      res.json({
        success: true,
        summary: 'Successfully analyzed emails, but formatting failed',
        groups: [],
        tasks: [],
        events: []
      });
    }

  } catch (error) {
    console.error('Error summarizing emails:', error);
    res.status(500).json({ success: false, error: 'Failed to summarize emails' });
  }
});

// Extract tasks and events from emails and add to user's workspace
app.post('/api/gmail/extract-tasks-events', async (req, res) => {
  try {
    const { userId, messageIds } = req.body;
    
    if (!userId || !messageIds || !Array.isArray(messageIds)) {
      return res.status(400).json({ success: false, error: 'User ID and message IDs required' });
    }

    console.log(`Extracting tasks and events from ${messageIds.length} emails for user ${userId}`);

    // First, get the email analysis
    const summaryResponse = await fetch(`http://localhost:${PORT}/api/gmail/summarize-emails`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, messageIds })
    });

    const summaryData = await summaryResponse.json();
    
    if (!summaryData.success) {
      return res.status(500).json({ success: false, error: 'Failed to analyze emails' });
    }

    const { tasks = [], events = [] } = summaryData;
    
    // Add tasks to user's task list
    const createdTasks = [];
    for (const task of tasks) {
      try {
        const { data: newTask, error } = await supabase
          .from('tasks')
          .insert({
            title: task.title,
            description: `${task.description}\n\nSource: ${task.source}`,
            priority: task.priority || 'medium',
            due_date: task.dueDate || null,
            created_by: userId
          })
          .select()
          .single();

        if (!error) {
          createdTasks.push(newTask);
          console.log(`Created task: ${task.title}`);
        }
      } catch (error) {
        console.error('Error creating task:', error);
      }
    }

    // Add events to user's calendar
    const createdEvents = [];
    for (const event of events) {
      try {
        if (event.startTime) {
          const startTime = new Date(event.startTime);
          const endTime = event.endTime ? new Date(event.endTime) : new Date(startTime.getTime() + 60 * 60 * 1000);

          const { data: newEvent, error } = await supabase
            .from('calendar_events')
            .insert({
              title: event.title,
              description: `${event.description}\n\nSource: ${event.source}`,
              start_time: startTime.toISOString(),
              end_time: endTime.toISOString(),
              user_id: userId
            })
            .select()
            .single();

          if (!error) {
            createdEvents.push(newEvent);
            console.log(`Created event: ${event.title}`);
          }
        }
      } catch (error) {
        console.error('Error creating event:', error);
      }
    }

    console.log(`Extraction complete: ${createdTasks.length} tasks, ${createdEvents.length} events created`);

    res.json({
      success: true,
      summary: summaryData.summary,
      groups: summaryData.groups,
      tasksCreated: createdTasks.length,
      eventsCreated: createdEvents.length,
      tasks: createdTasks,
      events: createdEvents
    });

  } catch (error) {
    console.error('Error extracting tasks and events:', error);
    res.status(500).json({ success: false, error: 'Failed to extract tasks and events' });
  }
});

// =============================================================================
// ENHANCED INTENT DETECTION & AGENT SYSTEM (Updated with Gmail)
// =============================================================================

app.post('/api/chat/agent-process', async (req, res) => {
  try {
    const { message, userId, context = {} } = req.body;
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    console.log(`Processing agent request for user ${userId}: ${message}`);
    
    // Enhanced intent detection with Gmail capabilities
    const intentPrompt = `
      You are SimAlly, an advanced AI agent that can help users with various tasks including Gmail management. Analyze this user message and determine the best way to help them.

      User message: "${message}"
      User context: ${JSON.stringify(context)}

      Available capabilities:
      1. Task Management - View, create, update tasks
      2. Calendar Management - View events, schedule meetings
      3. Meeting Control - Start/join video meetings
      4. Workspace Navigation - Navigate to different sections
      5. Data Analysis - Analyze user's tasks, calendar, productivity
      6. Document Generation - Create professional documents (letters, reports, resumes, proposals, memos)
      7. Gmail Management - Read, summarize, delete emails, extract tasks/events
      8. General Assistance - Answer questions, provide help

      Gmail capabilities include:
      - List unread emails
      - Search emails by sender
      - Summarize email content
      - Delete emails (bulk or selective)
      - Extract tasks and events from emails
      - Email cleanup and organization

      Respond with a comprehensive JSON that includes:
      {
        "intent": "primary_intent_category",
        "subIntent": "specific_action_needed",
        "confidence": 0.0-1.0,
        "requiresData": true/false,
        "dataQueries": ["list of data queries needed"],
        "actions": [
          {
            "type": "navigation|data_display|external_action|suggestion|document_generation|gmail_operation",
            "target": "specific_target",
            "parameters": {}
          }
        ],
        "response": "Comprehensive response with analysis and suggestions",
        "suggestions": [
          {
            "title": "Suggestion title",
            "description": "What this will do",
            "action": "action_type",
            "parameters": {}
          }
        ]
      }

      Intent categories:
      - task_management: View, create, update tasks
      - calendar_management: View calendar, schedule events
      - meeting_control: Start/join meetings
      - workspace_navigation: Navigate to different sections
      - productivity_analysis: Analyze user's productivity
      - document_generation: Create documents (letters, reports, resumes, etc.)
      - gmail_management: Email operations and management
      - general_assistance: General help and questions

      Gmail examples:
      - "Show me unread emails" → gmail_management intent, subIntent: "list_unread"
      - "Delete emails from sender@example.com" → gmail_management intent, subIntent: "search_sender"
      - "Summarize my recent emails" → gmail_management intent, subIntent: "summarize_emails"
      - "Find tasks in my emails" → gmail_management intent, subIntent: "extract_tasks"
      - "Clean up promotional emails" → gmail_management intent, subIntent: "search_sender"
    `;
    
    const result = await model.generateContent(intentPrompt);
    let response = result.response.text();

    // Remove markdown code block formatting if present
    response = response.replace(/^```json\s*/i, '')
      .replace(/^```\s*/gm, '')
      .replace(/```$/gm, '')
      .trim();

    try {
      const agentResponse = JSON.parse(response);
      
      console.log(`Agent response: intent=${agentResponse.intent}, subIntent=${agentResponse.subIntent}`);
      
      // Handle Gmail operations
      if (agentResponse.intent === 'gmail_management') {
        agentResponse.gmailOperation = {
          action: agentResponse.subIntent,
          ready: true
        };
      }
      
      // Handle document generation
      if (agentResponse.intent === 'document_generation') {
        const documentType = agentResponse.actions.find(a => a.type === 'document_generation')?.parameters?.type || 'general';
        
        agentResponse.documentGeneration = {
          prompt: message,
          type: documentType,
          ready: true
        };
      }
      
      // Fetch required data if needed
      if (agentResponse.requiresData && agentResponse.dataQueries) {
        const data = await fetchUserData(userId, agentResponse.dataQueries);
        agentResponse.data = data;
        
        // Enhance response with data analysis
        if (data) {
          const analysisResponse = await analyzeUserData(data, message, agentResponse.intent);
          agentResponse.analysis = analysisResponse;
          agentResponse.response = analysisResponse.enhancedResponse || agentResponse.response;
        }
      }
      
      res.json({
        success: true,
        agent: agentResponse
      });
    } catch (parseError) {
      console.error('Failed to parse agent response:', parseError);
      // Fallback response
      res.json({
        success: true,
        agent: {
          intent: 'general_assistance',
          subIntent: 'help',
          confidence: 0.8,
          requiresData: false,
          actions: [],
          response: 'I understand you need help. Could you please be more specific about what you\'d like me to assist you with?',
          suggestions: [
            {
              title: 'View Tasks',
              description: 'See all your current tasks and their status',
              action: 'navigate',
              parameters: { target: 'tasks' }
            },
            {
              title: 'Check Emails',
              description: 'View your unread emails',
              action: 'gmail',
              parameters: { operation: 'list_unread' }
            },
            {
              title: 'Start Meeting',
              description: 'Begin a new video meeting',
              action: 'navigate',
              parameters: { target: 'meeting' }
            },
            {
              title: 'Generate Document',
              description: 'Create a professional document',
              action: 'document',
              parameters: { type: 'general' }
            }
          ]
        }
      });
    }
  } catch (error) {
    console.error('Agent processing error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Fetch user data based on queries (updated to include Gmail)
const fetchUserData = async (userId, queries) => {
  const data = {};
  
  try {
    for (const query of queries) {
      switch (query) {
        case 'tasks':
          data.tasks = await fetchUserTasks(userId);
          break;
        case 'calendar':
          data.calendar = await fetchUserCalendar(userId);
          break;
        case 'channels':
          data.channels = await fetchUserChannels(userId);
          break;
        case 'messages':
          data.recentMessages = await fetchRecentMessages(userId);
          break;
        case 'productivity':
          data.productivity = await fetchProductivityData(userId);
          break;
        case 'gmail':
          data.gmail = await fetchGmailData(userId);
          break;
      }
    }
  } catch (error) {
    console.error('Error fetching user data:', error);
  }
  
  return data;
};

const fetchGmailData = async (userId) => {
  try {
    // Check if Gmail is connected
    const tokens = gmailTokens.get(userId);
    if (!tokens || tokens.expiresAt <= Date.now()) {
      return { connected: false };
    }

    // Get unread count
    const unreadResponse = await fetch(`http://localhost:${PORT}/api/gmail/unread?userId=${userId}&maxResults=5`);
    const unreadData = await unreadResponse.json();

    return {
      connected: true,
      unreadCount: unreadData.totalCount || 0,
      recentUnread: unreadData.emails || []
    };
  } catch (error) {
    console.error('Error fetching Gmail data:', error);
    return { connected: false };
  }
};

const fetchUserTasks = async (userId) => {
  try {
    // Get user's tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select(`
        *,
        assignments:task_assignments(
          user_id,
          user:profiles(full_name)
        )
      `)
      .or(`created_by.eq.${userId},id.in.(${await getUserTaskIds(userId)})`)
      .order('created_at', { ascending: false })
      .limit(50);

    return tasks || [];
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }
};

const fetchUserCalendar = async (userId) => {
  try {
    const { data: events } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(20);

    return events || [];
  } catch (error) {
    console.error('Error fetching calendar:', error);
    return [];
  }
};

const fetchUserChannels = async (userId) => {
  try {
    const { data: channels } = await supabase
      .from('channels')
      .select(`
        *,
        channel_members!inner(user_id)
      `)
      .eq('channel_members.user_id', userId)
      .order('created_at', { ascending: true });

    return channels || [];
  } catch (error) {
    console.error('Error fetching channels:', error);
    return [];
  }
};

const fetchRecentMessages = async (userId) => {
  try {
    // Get user's channels first
    const { data: userChannels } = await supabase
      .from('channel_members')
      .select('channel_id')
      .eq('user_id', userId);

    if (!userChannels || userChannels.length === 0) return [];

    const channelIds = userChannels.map(c => c.channel_id);

    const { data: messages } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles(full_name),
        channel:channels(name)
      `)
      .in('channel_id', channelIds)
      .order('created_at', { ascending: false })
      .limit(20);

    return messages || [];
  } catch (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
};

const fetchProductivityData = async (userId) => {
  try {
    const tasks = await fetchUserTasks(userId);
    const calendar = await fetchUserCalendar(userId);
    
    // Calculate productivity metrics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
    const overdueTasks = tasks.filter(t => 
      t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed'
    ).length;
    
    const upcomingEvents = calendar.length;
    const todayEvents = calendar.filter(e => 
      new Date(e.start_time).toDateString() === new Date().toDateString()
    ).length;

    return {
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        inProgress: inProgressTasks,
        overdue: overdueTasks,
        completionRate: totalTasks > 0 ? (completedTasks / totalTasks * 100).toFixed(1) : 0
      },
      calendar: {
        upcomingEvents,
        todayEvents
      }
    };
  } catch (error) {
    console.error('Error fetching productivity data:', error);
    return null;
  }
};

const getUserTaskIds = async (userId) => {
  const { data } = await supabase
    .from('task_assignments')
    .select('task_id')
    .eq('user_id', userId);
  
  return data?.map(t => t.task_id).join(',') || '';
};

// Analyze user data and provide insights (updated with Gmail)
const analyzeUserData = async (data, originalMessage, intent) => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    const analysisPrompt = `
      Analyze this user's data and provide intelligent insights and suggestions.
      
      Original user message: "${originalMessage}"
      Intent: ${intent}
      User data: ${JSON.stringify(data, null, 2)}
      
      Provide a comprehensive analysis with:
      1. Key insights about their current situation
      2. Specific actionable recommendations
      3. Priority items they should focus on
      4. Productivity suggestions
      5. Gmail insights if available
      6. An enhanced response that directly addresses their question with data
      
      Respond in JSON format:
      {
        "insights": [
          {
            "type": "insight_type",
            "title": "Insight title",
            "description": "Detailed insight",
            "severity": "low|medium|high"
          }
        ],
        "recommendations": [
          {
            "title": "Recommendation title",
            "description": "What to do",
            "priority": "low|medium|high",
            "action": "specific_action"
          }
        ],
        "enhancedResponse": "A comprehensive response that answers their question with data and insights"
      }
    `;
    
    const result = await model.generateContent(analysisPrompt);
    let response = result.response.text();

    // Clean output if wrapped in code blocks
    response = response
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/gm, '')
      .replace(/```$/gm, '')
      .trim();
    
    return JSON.parse(response);
  } catch (error) {
    console.error('Error analyzing user data:', error);
    return {
      insights: [],
      recommendations: [],
      enhancedResponse: "I've gathered your data but encountered an issue analyzing it. Let me help you with what I can see."
    };
  }
};

// =============================================================================
// EXISTING FUNCTIONALITY (Meeting AI, Chat, Documents, etc.)
// =============================================================================

// Chat message processing for task detection (existing functionality)
app.post('/api/chat/process-message', async (req, res) => {
  try {
    const { message, messageId, channelId, senderId, mentions = [], userId } = req.body;
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    const taskDetectionPrompt = `
      Analyze this chat message for task-related content and extract actionable items.
      
      Message: "${message}"
      Mentions: ${mentions.join(', ')}
      
      Look for:
      1. Action words (create, make, build, write, send, call, schedule, etc.)
      2. Assignments (@mentions or "assign to", "give to", etc.)
      3. Deadlines (dates, "by tomorrow", "end of week", etc.)
      4. Priority indicators (urgent, asap, high priority, etc.)
      
      If this message contains a clear task, respond with JSON:
      {
        "hasTask": true,
        "task": {
          "title": "Brief task title (max 100 chars)",
          "description": "Detailed description if available",
          "priority": "low|medium|high|urgent",
          "assignee": "mentioned username or null",
          "dueDate": "YYYY-MM-DD or null",
          "keywords": ["relevant", "keywords"]
        }
      }
      
      If no clear task is found, respond with:
      {
        "hasTask": false
      }
      
      Examples:
      - "Can someone create a report for the meeting?" → hasTask: true
      - "@john please send the files by Friday" → hasTask: true, assignee: "john", dueDate: calculated
      - "How's everyone doing?" → hasTask: false
    `;
    
    const result = await model.generateContent(taskDetectionPrompt);
    const response = result.response.text();
    
    try {
      const taskData = JSON.parse(response);
      
      if (taskData.hasTask) {
        // Create task in database
        const taskResult = await createTaskFromMessage(taskData.task, senderId, messageId, mentions);
        
        if (taskResult.success) {
          res.json({
            success: true,
            taskCreated: true,
            task: taskResult.task
          });
        } else {
          res.json({
            success: true,
            taskCreated: false,
            error: taskResult.error
          });
        }
      } else {
        res.json({
          success: true,
          taskCreated: false
        });
      }
    } catch (parseError) {
      console.error('Failed to parse task detection response:', parseError);
      res.json({
        success: true,
        taskCreated: false,
        error: 'Failed to process message for tasks'
      });
    }
  } catch (error) {
    console.error('Message processing error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const createTaskFromMessage = async (taskData, createdBy, sourceMessageId, mentions) => {
  try {
    // Create the task
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        title: taskData.title,
        description: taskData.description || null,
        priority: taskData.priority || 'medium',
        due_date: taskData.dueDate || null,
        created_by: createdBy,
        source_message_id: sourceMessageId
      })
      .select()
      .single();

    if (taskError) {
      console.error('Error creating task:', taskError);
      return { success: false, error: taskError.message };
    }

    // Handle assignments
    if (taskData.assignee && mentions.length > 0) {
      // Find user by mention
      const { data: users } = await supabase
        .from('profiles')
        .select('id, full_name')
        .ilike('full_name', `%${taskData.assignee}%`);

      if (users && users.length > 0) {
        const assigneeId = users[0].id;
        
        // Create task assignment
        await supabase
          .from('task_assignments')
          .insert({
            task_id: task.id,
            user_id: assigneeId
          });

        // Create calendar event if due date exists
        if (taskData.dueDate) {
          const dueDateTime = new Date(taskData.dueDate);
          dueDateTime.setHours(17, 0, 0, 0); // Set to 5 PM

          await supabase
            .from('calendar_events')
            .insert({
              title: `Task Due: ${task.title}`,
              description: task.description,
              start_time: dueDateTime.toISOString(),
              end_time: new Date(dueDateTime.getTime() + 60 * 60 * 1000).toISOString(), // 1 hour duration
              user_id: assigneeId,
              task_id: task.id
            });
        }
      }
    }

    return {
      success: true,
      task: {
        ...task,
        assignee: taskData.assignee
      }
    };
  } catch (error) {
    console.error('Error creating task from message:', error);
    return { success: false, error: error.message };
  }
};

// Legacy intent detection (for backward compatibility)
app.post('/api/chat/detect-intent', async (req, res) => {
  try {
    const { message, userId } = req.body;
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    const intentPrompt = `
      You are an intelligent intent classifier for an AI assistant that can handle:
      1. Document generation (letters, reports, resumes, proposals, memos)
      2. Gmail management (read, summarize, delete emails)
      3. General chat/questions
      
      Analyze this user message and determine the intent, extract parameters, and provide a helpful response.
      
      User message: "${message}"
      
      Respond in this exact JSON format:
      {
        "intent": "one of: document_generation, gmail_management, chat",
        "confidence": 0.0-1.0,
        "parameters": {
          // Extract relevant parameters based on intent
          // For document_generation: {"type": "letter|report|resume|proposal|memo|general", "content": "description"}
          // For gmail_management: {"action": "list_unread|search_sender|summarize|delete|cleanup", "target": "specific target if any"}
          // For chat: {}
        },
        "response": "A helpful response to the user explaining what you'll do or asking for clarification"
      }
      
      Examples:
      - "Create a business letter" → document_generation intent with type "letter"
      - "Show me unread emails" → gmail_management intent with action "list_unread"
      - "Delete emails from spam@example.com" → gmail_management intent with action "delete", target "spam@example.com"
      - "What's the weather today?" → chat intent
      
      Be intelligent about parameter extraction and provide clear, helpful responses.
    `;
    
    const result = await model.generateContent(intentPrompt);
    const response = result.response.text();
    
    try {
      const intentData = JSON.parse(response);
      
      // If it's a chat intent, get a proper chat response
      if (intentData.intent === 'chat') {
        const chatResponse = await getChatResponse(message, userId);
        intentData.response = chatResponse;
      }
      
      res.json(intentData);
    } catch (parseError) {
      console.error('Failed to parse intent response:', parseError);
      // Fallback to chat
      const chatResponse = await getChatResponse(message, userId);
      res.json({
        intent: 'chat',
        confidence: 1.0,
        parameters: {},
        response: chatResponse
      });
    }
  } catch (error) {
    console.error('Intent detection error:', error);
    res.status(500).json({
      intent: 'chat',
      confidence: 0.5,
      parameters: {},
      response: 'I apologize, but I encountered an error. Please try again.'
    });
  }
});

// Get chat response for general questions
const getChatResponse = async (message, userId) => {
  try {
    const userSession = userSessions.get(userId) || {};
    const conversationHistory = userSession.chatHistory || [];
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    // Build conversation context
    let conversationContext = '';
    if (conversationHistory.length > 0) {
      conversationContext = conversationHistory
        .slice(-10) // Keep last 10 messages for context
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');
    }
    
    const prompt = `
      You are SimAlly, a professional AI assistant. You are helpful, knowledgeable, and maintain a professional yet friendly tone.
      You can help with document generation, Gmail management, and general questions.
      
      ${conversationContext ? `Previous conversation:\n${conversationContext}\n\n` : ''}
      
      User: ${message}
      
      Provide a helpful, accurate, and professional response. Keep it concise but informative.
    `;
    
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    // Store conversation in user session
    if (!userSession.chatHistory) {
      userSession.chatHistory = [];
    }
    
    userSession.chatHistory.push(
      { role: 'user', content: message, timestamp: new Date() },
      { role: 'assistant', content: response, timestamp: new Date() }
    );
    
    // Keep only last 50 messages
    if (userSession.chatHistory.length > 50) {
      userSession.chatHistory = userSession.chatHistory.slice(-50);
    }
    
    userSessions.set(userId, userSession);
    
    return response;
  } catch (error) {
    console.error('Chat response error:', error);
    return 'I apologize, but I encountered an error processing your request. Please try again.';
  }
};

// Meeting AI functionality (existing)
app.post('/api/meetings/auto-notes', async (req, res) => {
  try {
    const { text, speaker, userId } = req.body;
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const prompt = `
      Analyze this meeting transcript segment and extract key points, action items, or important information:
      
      Speaker: ${speaker}
      Text: "${text}"
      
      If this contains important information, action items, decisions, or key points, format them as bullet points.
      If it's just casual conversation, return "NO_NOTES".
      
      Focus on:
      - Action items
      - Decisions made
      - Important announcements
      - Key discussion points
      - Deadlines or dates mentioned
    `;
    
    const result = await model.generateContent(prompt);
    const notes = result.response.text().trim();
    
    if (notes !== 'NO_NOTES') {
      res.json({ success: true, notes });
    } else {
      res.json({ success: true, notes: null });
    }
  } catch (error) {
    console.error('Auto notes generation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate meeting summary
app.post('/api/meetings/summary', async (req, res) => {
  try {
    const { transcript, participants, duration } = req.body;
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const prompt = `
      Generate a comprehensive meeting summary based on this transcript:
      
      Duration: ${duration} minutes
      Participants: ${participants.join(', ')}
      
      Transcript:
      ${transcript}
      
      Provide a structured summary with:
      1. Meeting Overview
      2. Key Discussion Points
      3. Decisions Made
      4. Action Items (with responsible parties if mentioned)
      5. Next Steps
      
      Keep it professional and concise.
    `;
    
    const result = await model.generateContent(prompt);
    const summary = result.response.text();
    
    res.json({ success: true, summary });
  } catch (error) {
    console.error('Generate summary error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generic chatbot (existing)
app.post('/api/chat', async (req, res) => {
  try {
    const { message, userId, conversationHistory = [] } = req.body;
    const response = await getChatResponse(message, userId);
    res.json({ success: true, response });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get chat history
app.get('/api/chat/history', (req, res) => {
  try {
    const { userId } = req.query;
    const userSession = userSessions.get(userId);
    
    res.json({ 
      success: true, 
      history: userSession?.chatHistory || [] 
    });
  } catch (error) {
    console.error('Get chat history error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear chat history
app.delete('/api/chat/history', (req, res) => {
  try {
    const { userId } = req.body;
    const userSession = userSessions.get(userId);
    
    if (userSession) {
      userSession.chatHistory = [];
      userSessions.set(userId, userSession);
    }
    
    res.json({ success: true, message: 'Chat history cleared' });
  } catch (error) {
    console.error('Clear chat history error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Document generation (existing)
app.post('/api/documents/generate', async (req, res) => {
  try {
    const { prompt, documentType = 'general', format = 'html' } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ success: false, error: 'Document prompt is required' });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Choose prompt based on requested format
    const generationPrompt = format === 'pdfmake' ? `
      You are a document automation expert. Generate a valid, clean PDFMake document definition object (in pure JSON) for the following request:

      Request: "${prompt}"
      Document Type: "${documentType}"

      Return only a valid JSON structure that can be passed to pdfmake.createPdf(docDefinition).download().
    ` : `
      You are an expert document designer. Generate a modern, professional HTML layout for the following:

      Request: "${prompt}"
      Document Type: "${documentType}"

      Requirements:
      - Use semantic HTML structure (header, section, article)
      - Use inline styles or Tailwind CSS class names (optional)
      - Include placeholder images or icons using public links
      - Use dummy values if user data is missing
      - Ensure HTML is clean and ready to convert to PDF using html2pdf.js
      - No script tags. No markdown. No LaTeX.
      Return only the HTML as a string (no explanation).
    `;

    const result = await model.generateContent(generationPrompt);
    let content = result.response.text().trim();

    // Clean output if wrapped in code blocks
    content = content
      .replace(/^```(html|json)\s*/gm, '')
      .replace(/```$/gm, '')
      .trim();

    // PDFMake specific: ensure it's a valid JSON object
    if (format === 'pdfmake') {
      content = content.replace(/([{,])\s*([^"\s]+)\s*:/g, '$1"$2":'); // Quote keys
    }

    // Fallback for empty content
    if (!content) {
      return res.status(400).json({ success: false, error: 'No content generated. Please try a different prompt.' });
    }

    res.json({
      success: true,
      document: {
        content,
        message: `Document generated successfully as ${format === 'pdfmake' ? 'PDFMake JSON' : 'HTML'}`
      }
    });
  } catch (error) {
    console.error('Document generation error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate document' });
  }
});

// =============================================================================
// HEALTH CHECK & SERVER
// =============================================================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    services: {
      meetings: 'ready',
      chatbot: 'ready',
      intentDetection: 'ready',
      taskDetection: 'ready',
      agentSystem: 'ready',
      documentGeneration: 'ready',
      gmailIntegration: 'ready',
      supabase: 'ready'
    },
    activeSessions: userSessions.size,
    gmailConnections: gmailTokens.size
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'SimAlly AI Assistant Backend',
    version: '10.0.0',
    services: [
      'Advanced AI Agent', 
      'Gmail Integration', 
      'Document Generation', 
      'Meeting AI', 
      'Intent Detection', 
      'Task Detection', 
      'Workspace Chat', 
      'Data Analysis'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`AI Assistant Backend running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log('Features: Advanced AI Agent, Gmail Integration, Document Generation, Intent Detection, Meeting AI, Task Detection, Workspace Chat, Data Analysis');
});

module.exports = app;