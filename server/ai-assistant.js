const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.AI_ASSISTANT_PORT || 8001;

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
    
    console.log(`AI session initialized for user: ${userId}`);
    
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
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
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

// Agent processing endpoint
app.post('/api/chat/agent-process', async (req, res) => {
  try {
    const { message, userId, context } = req.body;
    
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
    
    // Determine intent and generate response
    const intentResult = await determineIntent(message, context);
    
    // Add to history
    session.history.push({
      role: 'user',
      content: message
    });
    
    session.history.push({
      role: 'model',
      content: intentResult.response
    });
    
    // Keep history limited to last 20 messages
    if (session.history.length > 20) {
      session.history = session.history.slice(-20);
    }
    
    res.json({
      success: true,
      agent: intentResult,
      sessionId
    });
  } catch (error) {
    console.error('Error in agent processing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process message'
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
      'https://www.googleapis.com/auth/gmail.modify'
    ];
    
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
    
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
    
    // Decode state
    const stateData = JSON.parse(Buffer.from(state.toString(), 'base64').toString());
    const userId = stateData.userId;
    
    console.log(`Gmail OAuth callback for user: ${userId}`);
    
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code.toString());
    
    console.log('Received tokens from Google:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expiry_date,
      expiryDate: tokens.expiry_date
    });
    
    // Store tokens in database
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    const { data, error } = await supabase.rpc('store_encrypted_gmail_tokens', {
      p_user_id: userId,
      p_session_token: sessionToken,
      p_access_token: tokens.access_token,
      p_refresh_token: tokens.refresh_token || null,
      p_token_type: tokens.token_type,
      p_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      p_scope: tokens.scope
    });
    
    if (error) {
      console.error('Error storing Gmail tokens:', error);
      return res.redirect(`${FRONTEND_URL}/assistant?gmail_error=true`);
    }
    
    console.log(`Gmail tokens stored securely for user ${userId}`);
    
    // Redirect back to assistant page
    res.redirect(`${FRONTEND_URL}/assistant?gmail_connected=true`);
  } catch (error) {
    console.error('Error in Gmail callback:', error);
    res.redirect(`${FRONTEND_URL}/assistant?gmail_error=true`);
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
    
    console.log(`Gmail status check for user ${userId}: checking...`);
    
    // Check if tokens exist
    const { data: tokensExist } = await supabase.rpc('check_gmail_tokens_exist', {
      p_user_id: userId
    });
    
    if (!tokensExist) {
      return res.json({
        connected: false
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
      console.error('Error getting Gmail tokens:', error || data.error);
      return res.json({
        connected: false
      });
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
    
    // Revoke tokens
    const { data, error } = await supabase.rpc('revoke_gmail_tokens', {
      p_user_id: userId
    });
    
    if (error) {
      console.error('Error revoking Gmail tokens:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to revoke Gmail tokens'
      });
    }
    
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
      console.error('Error getting Gmail tokens:', error || data.error);
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
      console.error('Error getting Gmail tokens:', error || data.error);
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
    
    // Extract body
    let body = '';
    
    if (response.data.payload.parts) {
      // Multipart message
      for (const part of response.data.payload.parts) {
        if (part.mimeType === 'text/html') {
          body = Buffer.from(part.body.data, 'base64').toString('utf-8');
          break;
        } else if (part.mimeType === 'text/plain' && !body) {
          body = Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }
    } else if (response.data.payload.body.data) {
      // Simple message
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
    
    res.json({
      success: true,
      email: {
        id,
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
      console.error('Error getting Gmail tokens:', error || data.error);
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
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
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
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
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

// Determine intent and generate response
async function determineIntent(message, context = {}) {
  try {
    // Check for Gmail-related intents
    if (/gmail|email|inbox|unread|message/i.test(message)) {
      if (!context.gmailConnected) {
        return {
          intent: 'general_chat',
          response: "I'd be happy to help with your emails, but you need to connect your Gmail account first. You can do this by clicking the 'Connect Gmail' button at the top of the page."
        };
      }
      
      if (/show|get|list|view|display/i.test(message)) {
        if (/unread/i.test(message)) {
          return {
            intent: 'endpoint_call',
            endpoint: 'gmail_get_emails',
            params: { query: 'is:unread' },
            response: '📧 Here are your unread emails:',
            result: { emails: [] } // Will be populated by the endpoint
          };
        } else {
          return {
            intent: 'endpoint_call',
            endpoint: 'gmail_get_emails',
            params: {},
            response: '📧 Here are your recent emails:',
            result: { emails: [] } // Will be populated by the endpoint
          };
        }
      }
      
      if (/search|find|look for/i.test(message)) {
        // Extract search query
        const queryMatch = message.match(/search\s+(?:for\s+)?(?:emails?\s+)?(?:about\s+|related to\s+|containing\s+|with\s+)?["']?([^"']+)["']?/i);
        const query = queryMatch ? queryMatch[1].trim() : '';
        
        return {
          intent: 'endpoint_call',
          endpoint: 'gmail_get_emails',
          params: { query },
          response: `🔍 Searching for emails about "${query}":`,
          result: { emails: [] } // Will be populated by the endpoint
        };
      }
    }
    
    // Default to general chat
    return {
      intent: 'general_chat',
      response: await generateChatResponse(message, context)
    };
  } catch (error) {
    console.error('Error determining intent:', error);
    return {
      intent: 'general_chat',
      response: "I'm sorry, I encountered an error processing your request. Please try again."
    };
  }
}

// Generate chat response
async function generateChatResponse(message, context = {}) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const systemPrompt = `
      You are SimAlly, a professional AI assistant focused on productivity and workspace management.
      Current capabilities:
      ${context.gmailConnected ? '- Gmail integration (connected)' : '- Gmail integration (not connected)'}
      - Task management
      - Calendar management
      - Meeting scheduling
      - Document generation
      
      Respond in a helpful, concise, and professional manner.
    `;
    
    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: 'System: ' + systemPrompt }]
        },
        {
          role: 'model',
          parts: [{ text: "I understand my role as SimAlly. I'll provide helpful, concise, and professional assistance with your productivity needs." }]
        }
      ]
    });
    
    const result = await chat.sendMessage(message);
    return result.response.text();
  } catch (error) {
    console.error('Error generating chat response:', error);
    return "I'm sorry, I encountered an error generating a response. Please try again.";
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
});

module.exports = app;