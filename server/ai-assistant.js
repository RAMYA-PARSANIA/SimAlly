const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const { createClient } = require('@supabase/supabase-js');
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

// =============================================================================
// ENHANCED INTENT DETECTION & AGENT SYSTEM
// =============================================================================

app.post('/api/chat/agent-process', async (req, res) => {
  try {
    const { message, userId, context = {}, files = [] } = req.body;
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    // Enhanced intent detection with Gmail operations
    const intentPrompt = `
      You are SimAlly, an advanced AI agent that can help users with various tasks. Analyze this user message and determine the best way to help them.

      User message: "${message}"
      User context: ${JSON.stringify(context)}
      Files attached: ${files.length > 0 ? 'Yes' : 'No'}

      Available capabilities:
      1. Task Management - View, create, update tasks
      2. Calendar Management - View events, schedule meetings
      3. Meeting Control - Start/join video meetings
      4. Gmail Operations - List, search, delete, send emails (WITHIN ASSISTANT UI)
      5. Workspace Navigation - Navigate to different sections
      6. Data Analysis - Analyze user's tasks, calendar, productivity
      7. Document Generation - Create professional documents (letters, reports, resumes, proposals, memos)
      8. General Assistance - Answer questions, provide help

      IMPORTANT: For Gmail operations, NEVER navigate away from assistant. Always show email data in the assistant UI itself.

      Respond with a comprehensive JSON that includes:
      {
        "intent": "primary_intent_category",
        "subIntent": "specific_action_needed",
        "confidence": 0.0-1.0,
        "requiresData": true/false,
        "dataQueries": ["list of data queries needed"],
        "gmailOperation": {
          "type": "list_unread|search_sender|delete_emails|send_email|none",
          "parameters": {
            "query": "search query for emails",
            "sender": "sender email/name",
            "recipient": "email recipient",
            "subject": "email subject",
            "body": "email body"
          }
        },
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
      - gmail_operations: Email management (list, search, delete, send)
      - task_management: View, create, update tasks
      - calendar_management: View calendar, schedule events
      - meeting_control: Start/join meetings
      - workspace_navigation: Navigate to different sections
      - productivity_analysis: Analyze user's productivity
      - document_generation: Create documents (letters, reports, resumes, etc.)
      - general_assistance: General help and questions

      Gmail operation examples:
      - "Show me unread emails" → gmail_operations intent, type: "list_unread"
      - "List emails from john@example.com" → gmail_operations intent, type: "search_sender", sender: "john@example.com"
      - "Delete emails from spam@company.com" → gmail_operations intent, type: "delete_emails", sender: "spam@company.com"
      - "Send email to sarah about meeting" → gmail_operations intent, type: "send_email"

      Examples:
      - "What tasks do I need to do?" → task_management intent, requiresData: true, show tasks with analysis
      - "Start a meeting" → meeting_control intent, navigate to meeting page
      - "Show unread emails" → gmail_operations intent, list unread emails in UI
      - "Delete emails from newsletter@company.com" → gmail_operations intent, show emails and ask for confirmation
      - "Create a business letter to complain about service" → document_generation intent, generate letter
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
      
      // Handle document generation
      if (agentResponse.intent === 'document_generation') {
        const documentType = agentResponse.actions.find(a => a.type === 'document_generation')?.parameters?.type || 'general';
        
        agentResponse.documentGeneration = {
          prompt: message,
          type: documentType,
          ready: true
        };
      }
      
      // Handle Gmail operations
      if (agentResponse.intent === 'gmail_operations' && agentResponse.gmailOperation) {
        agentResponse.requiresGmailData = true;
        agentResponse.gmailQuery = agentResponse.gmailOperation;
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
              parameters: { type: 'list_unread' }
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

// =============================================================================
// REAL GMAIL API INTEGRATION
// =============================================================================

// Gmail OAuth - Get authorization URL
app.get('/api/gmail/auth-url', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify'
    ],
  });
  
  res.json({ authUrl });
});

// Gmail OAuth - Handle callback
app.post('/api/gmail/auth-callback', async (req, res) => {
  try {
    const { code, userId } = req.body;
    const { tokens } = await oauth2Client.getAccessToken(code);
    
    // Store tokens for user
    userSessions.set(userId, {
      ...userSessions.get(userId),
      gmailTokens: tokens
    });
    
    res.json({ success: true, message: 'Gmail connected successfully' });
  } catch (error) {
    console.error('Gmail auth error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check Gmail connection status
app.get('/api/gmail/status', (req, res) => {
  const { userId } = req.query;
  const userSession = userSessions.get(userId);
  
  res.json({
    connected: !!(userSession?.gmailTokens),
    needsAuth: !(userSession?.gmailTokens)
  });
});

// Real Gmail operations endpoint
app.post('/api/gmail/operation', async (req, res) => {
  try {
    const { operation, parameters, userId } = req.body;
    const userSession = userSessions.get(userId);
    
    if (!userSession?.gmailTokens) {
      return res.status(401).json({
        success: false,
        error: 'Gmail not connected. Please connect your Gmail account first.',
        needsAuth: true
      });
    }
    
    // Set up Gmail API client
    oauth2Client.setCredentials(userSession.gmailTokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    let result = {};
    
    switch (operation.type) {
      case 'list_unread':
        result = await getUnreadEmails(gmail);
        break;
        
      case 'search_sender':
        const sender = parameters.sender || parameters.query;
        result = await searchEmailsBySender(gmail, sender);
        break;
        
      case 'search_query':
        result = await searchEmails(gmail, parameters.query);
        break;
        
      default:
        result = { emails: [], totalCount: 0, query: '' };
    }
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Gmail operation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Real Gmail delete operation
app.post('/api/gmail/delete', async (req, res) => {
  try {
    const { emailIds, userId } = req.body;
    const userSession = userSessions.get(userId);
    
    if (!userSession?.gmailTokens) {
      return res.status(401).json({
        success: false,
        error: 'Gmail not connected'
      });
    }
    
    oauth2Client.setCredentials(userSession.gmailTokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Delete emails one by one
    const deletePromises = emailIds.map(id =>
      gmail.users.messages.delete({
        userId: 'me',
        id: id
      })
    );
    
    await Promise.all(deletePromises);
    
    res.json({
      success: true,
      deletedCount: emailIds.length,
      message: `Successfully deleted ${emailIds.length} email${emailIds.length !== 1 ? 's' : ''}`
    });
  } catch (error) {
    console.error('Gmail delete error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Send Email
app.post('/api/gmail/send', async (req, res) => {
  try {
    const { userId, to, subject, body, isHtml = false } = req.body;
    const userSession = userSessions.get(userId);
    
    if (!userSession?.gmailTokens) {
      return res.status(401).json({ success: false, error: 'Gmail not connected' });
    }
    
    oauth2Client.setCredentials(userSession.gmailTokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const emailContent = [
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset=utf-8`,
      '',
      body
    ].join('\n');
    
    const encodedEmail = Buffer.from(emailContent).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
    
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail
      }
    });
    
    res.json({ success: true, messageId: result.data.id });
  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// GMAIL HELPER FUNCTIONS
// =============================================================================

async function getUnreadEmails(gmail) {
  try {
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
      maxResults: 20
    });
    
    const messages = response.data.messages || [];
    const emails = await Promise.all(
      messages.slice(0, 10).map(msg => getEmailDetails(gmail, msg.id))
    );
    
    return {
      emails: emails.filter(email => email !== null),
      totalCount: response.data.resultSizeEstimate || 0,
      query: 'is:unread'
    };
  } catch (error) {
    console.error('Error getting unread emails:', error);
    throw error;
  }
}

async function searchEmailsBySender(gmail, sender) {
  try {
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: `from:${sender}`,
      maxResults: 20
    });
    
    const messages = response.data.messages || [];
    const emails = await Promise.all(
      messages.slice(0, 10).map(msg => getEmailDetails(gmail, msg.id))
    );
    
    return {
      emails: emails.filter(email => email !== null),
      totalCount: response.data.resultSizeEstimate || 0,
      query: `from:${sender}`
    };
  } catch (error) {
    console.error('Error searching emails by sender:', error);
    throw error;
  }
}

async function searchEmails(gmail, query) {
  try {
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 20
    });
    
    const messages = response.data.messages || [];
    const emails = await Promise.all(
      messages.slice(0, 10).map(msg => getEmailDetails(gmail, msg.id))
    );
    
    return {
      emails: emails.filter(email => email !== null),
      totalCount: response.data.resultSizeEstimate || 0,
      query: query
    };
  } catch (error) {
    console.error('Error searching emails:', error);
    throw error;
  }
}

async function getEmailDetails(gmail, messageId) {
  try {
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId
    });
    
    const message = response.data;
    const headers = message.payload?.headers || [];
    
    const getHeader = (name) => {
      const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
      return header?.value || '';
    };
    
    const subject = getHeader('Subject') || '(No Subject)';
    const from = getHeader('From') || 'Unknown Sender';
    const to = getHeader('To');
    const date = getHeader('Date');
    const isRead = !message.labelIds?.includes('UNREAD');
    const hasAttachments = checkForAttachments(message.payload);
    
    return {
      id: message.id,
      subject,
      from,
      to,
      date: formatDate(date),
      snippet: message.snippet || '',
      isRead,
      hasAttachments,
      labels: message.labelIds || []
    };
  } catch (error) {
    console.error('Error getting email details:', error);
    return null;
  }
}

function checkForAttachments(payload) {
  if (!payload) return false;
  
  if (payload.parts) {
    return payload.parts.some(part => 
      part.filename && part.filename.length > 0
    );
  }
  
  return false;
}

function formatDate(dateString) {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return 'Today';
    } else if (diffDays === 2) {
      return 'Yesterday';
    } else if (diffDays <= 7) {
      return `${diffDays - 1} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  } catch {
    return dateString;
  }
}

// Fetch user data based on queries
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
      }
    }
  } catch (error) {
    console.error('Error fetching user data:', error);
  }
  
  return data;
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

// Analyze user data and provide insights
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
      5. An enhanced response that directly addresses their question with data
      
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
    const response = result.response.text();
    
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
// CHAT MESSAGE PROCESSING FOR TASK DETECTION (existing functionality)
// =============================================================================

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

// =============================================================================
// LEGACY INTENT DETECTION (for backward compatibility)
// =============================================================================

app.post('/api/chat/detect-intent', async (req, res) => {
  try {
    const { message, userId } = req.body;
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    const intentPrompt = `
      You are an intelligent intent classifier for an AI assistant that can handle:
      1. Gmail operations (send, read, delete, unsubscribe, compose help)
      2. Document generation (letters, reports, resumes, proposals, memos)
      3. General chat/questions
      
      Analyze this user message and determine the intent, extract parameters, and provide a helpful response.
      
      User message: "${message}"
      
      Respond in this exact JSON format:
      {
        "intent": "one of: gmail_send, gmail_read, gmail_delete, gmail_unsubscribe, gmail_compose_help, document_generation, chat",
        "confidence": 0.0-1.0,
        "parameters": {
          // Extract relevant parameters based on intent
          // For gmail_send: {"to": "email", "subject": "subject", "body": "body"}
          // For gmail_read: {"count": number, "query": "search terms"}
          // For document_generation: {"type": "letter|report|resume|proposal|memo|general", "content": "description"}
          // For chat: {}
        },
        "response": "A helpful response to the user explaining what you'll do or asking for clarification"
      }
      
      Examples:
      - "Send an email to john@example.com about the meeting" → gmail_send intent
      - "Create a business letter" → document_generation intent with type "letter"
      - "Generate a project report" → document_generation intent with type "report"
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
      You can help with Gmail management, document generation, and general questions.
      
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

// =============================================================================
// MEETING AI FUNCTIONALITY (existing)
// =============================================================================

// Generate auto notes from meeting transcript
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

// =============================================================================
// GENERIC CHATBOT (existing)
// =============================================================================

// Chat with AI (legacy endpoint for direct chat)
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

// Endpoint: Generate document content (HTML or PDFMake JSON) from user prompt using Gemini
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
      - Make it visually appealing and professional
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
      gmail: 'ready (real API)',
      meetings: 'ready',
      chatbot: 'ready',
      intentDetection: 'ready',
      taskDetection: 'ready',
      agentSystem: 'ready',
      documentGeneration: 'ready',
      supabase: 'ready'
    },
    activeSessions: userSessions.size
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'SimAlly AI Assistant Backend',
    version: '8.0.0',
    services: ['Real Gmail API', 'Advanced AI Agent', 'Document Generation', 'Meeting AI', 'Intent Detection', 'Task Detection', 'Workspace Chat', 'Data Analysis']
  });
});

app.listen(PORT, () => {
  console.log(`AI Assistant Backend running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log('Features: Real Gmail API, Advanced AI Agent, Document Generation, Intent Detection, Meeting AI, Task Detection, Workspace Chat, Data Analysis');
});

module.exports = app;