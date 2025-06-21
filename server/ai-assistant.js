const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.AI_ASSISTANT_PORT || 8001;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Initialize services
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

// Gmail OAuth2 setup
const oauth2Client = new OAuth2Client(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

// Store user sessions (in production, use Redis or database)
const userSessions = new Map();

// =============================================================================
// CHAT MESSAGE PROCESSING FOR TASK DETECTION
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
// INTENT DETECTION & ROUTING (existing functionality)
// =============================================================================

app.post('/api/chat/detect-intent', async (req, res) => {
  try {
    const { message, userId } = req.body;
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    const intentPrompt = `
      You are an intelligent intent classifier for an AI assistant that can handle:
      1. Gmail operations (send, read, delete, unsubscribe, compose help)
      2. General chat/questions
      
      Analyze this user message and determine the intent, extract parameters, and provide a helpful response.
      
      User message: "${message}"
      
      Respond in this exact JSON format:
      {
        "intent": "one of: gmail_send, gmail_read, gmail_delete, gmail_unsubscribe, gmail_compose_help, chat",
        "confidence": 0.0-1.0,
        "parameters": {
          // Extract relevant parameters based on intent
          // For gmail_send: {"to": "email", "subject": "subject", "body": "body"}
          // For gmail_read: {"count": number, "query": "search terms"}
          // For chat: {}
        },
        "response": "A helpful response to the user explaining what you'll do or asking for clarification"
      }
      
      Examples:
      - "Send an email to john@example.com about the meeting" → gmail_send intent
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
      You can help with Gmail management and general questions.
      
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
// GMAIL FUNCTIONALITY (existing)
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

// Get Emails
app.get('/api/gmail/messages', async (req, res) => {
  try {
    const { userId } = req.query;
    const { maxResults = 10, query = '' } = req.query;
    const userSession = userSessions.get(userId);
    
    if (!userSession?.gmailTokens) {
      return res.status(401).json({ success: false, error: 'Gmail not connected' });
    }
    
    oauth2Client.setCredentials(userSession.gmailTokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: parseInt(maxResults),
      q: query
    });
    
    const messages = [];
    if (response.data.messages) {
      for (const message of response.data.messages.slice(0, 5)) { // Limit for performance
        const messageData = await gmail.users.messages.get({
          userId: 'me',
          id: message.id
        });
        
        const headers = messageData.data.payload.headers;
        const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
        const date = headers.find(h => h.name === 'Date')?.value || '';
        
        messages.push({
          id: message.id,
          subject,
          from,
          date,
          snippet: messageData.data.snippet
        });
      }
    }
    
    res.json({ success: true, messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete Email
app.delete('/api/gmail/messages/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.query;
    const userSession = userSessions.get(userId);
    
    if (!userSession?.gmailTokens) {
      return res.status(401).json({ success: false, error: 'Gmail not connected' });
    }
    
    oauth2Client.setCredentials(userSession.gmailTokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    await gmail.users.messages.delete({
      userId: 'me',
      id: messageId
    });
    
    res.json({ success: true, message: 'Email deleted successfully' });
  } catch (error) {
    console.error('Delete email error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Unsubscribe from newsletters (AI-powered detection)
app.post('/api/gmail/unsubscribe', async (req, res) => {
  try {
    const { userId, messageId } = req.body;
    const userSession = userSessions.get(userId);
    
    if (!userSession?.gmailTokens) {
      return res.status(401).json({ success: false, error: 'Gmail not connected' });
    }
    
    oauth2Client.setCredentials(userSession.gmailTokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Get the email content
    const messageData = await gmail.users.messages.get({
      userId: 'me',
      id: messageId
    });
    
    // Extract email body (simplified)
    let emailBody = '';
    if (messageData.data.payload.body.data) {
      emailBody = Buffer.from(messageData.data.payload.body.data, 'base64').toString();
    }
    
    // Use Gemini to find unsubscribe links
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const prompt = `
      Analyze this email content and find any unsubscribe links or instructions:
      
      ${emailBody}
      
      Return only the unsubscribe URL if found, or "NO_UNSUBSCRIBE_LINK" if none exists.
    `;
    
    const result = await model.generateContent(prompt);
    const unsubscribeInfo = result.response.text().trim();
    
    res.json({ 
      success: true, 
      unsubscribeInfo: unsubscribeInfo === 'NO_UNSUBSCRIBE_LINK' ? null : unsubscribeInfo 
    });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// AI Email Writing Assistant
app.post('/api/gmail/compose-help', async (req, res) => {
  try {
    const { prompt, context = '', tone = 'professional' } = req.body;
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const aiPrompt = `
      You are a professional email writing assistant. Help compose an email based on this request:
      
      Request: ${prompt}
      Context: ${context}
      Tone: ${tone}
      
      Provide a well-structured email with:
      1. Appropriate subject line
      2. Professional greeting
      3. Clear, concise body
      4. Appropriate closing
      
      Format your response as JSON with "subject" and "body" fields.
    `;
    
    const result = await model.generateContent(aiPrompt);
    const response = result.response.text();
    
    try {
      const emailData = JSON.parse(response);
      res.json({ success: true, ...emailData });
    } catch {
      // Fallback if JSON parsing fails
      res.json({ 
        success: true, 
        subject: 'Email Subject',
        body: response 
      });
    }
  } catch (error) {
    console.error('Email compose help error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

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

// =============================================================================
// HEALTH CHECK & SERVER
// =============================================================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    services: {
      gmail: 'ready',
      meetings: 'ready',
      chatbot: 'ready',
      intentDetection: 'ready',
      taskDetection: 'ready',
      supabase: 'ready'
    },
    activeSessions: userSessions.size
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'SimAlly AI Assistant Backend',
    version: '4.0.0',
    services: ['Gmail', 'Meeting AI', 'AI Assistant', 'Intent Detection', 'Task Detection', 'Workspace Chat']
  });
});

app.listen(PORT, () => {
  console.log(`AI Assistant Backend running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log('Features: Intent Detection, Gmail, Meeting AI, AI Assistant, Task Detection, Workspace Chat');
});

module.exports = app;