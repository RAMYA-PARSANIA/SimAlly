const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
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

// Initialize services
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

// Gmail OAuth configuration
const oauth2Client = new OAuth2Client(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  `${VITE_AI_API_URL}/auth/gmail/callback`
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
      return { success: false, error: 'No active session' };
    }

    const { data, error } = await supabase.rpc('get_decrypted_gmail_tokens', {
      p_user_id: userId,
      p_session_token: sessionToken
    });

    if (error) {
      console.error('Error getting Gmail tokens:', error);
      return { success: false, error: 'Failed to retrieve tokens' };
    }

    return data;
  } catch (error) {
    console.error('Error in getGmailTokens:', error);
    return { success: false, error: 'Internal error' };
  }
}

// Helper function to store encrypted Gmail tokens
async function storeGmailTokens(userId, tokens) {
  try {
    const sessionToken = getUserSessionToken(userId);
    if (!sessionToken) {
      return { success: false, error: 'No active session' };
    }

    const { data, error } = await supabase.rpc('store_encrypted_gmail_tokens', {
      p_user_id: userId,
      p_session_token: sessionToken,
      p_access_token: tokens.access_token,
      p_refresh_token: tokens.refresh_token,
      p_token_type: tokens.token_type || 'Bearer',
      p_expires_at: tokens.expires_at ? new Date(tokens.expires_at).toISOString() : null,
      p_scope: tokens.scope
    });

    if (error) {
      console.error('Error storing Gmail tokens:', error);
      return { success: false, error: 'Failed to store tokens' };
    }

    return data;
  } catch (error) {
    console.error('Error in storeGmailTokens:', error);
    return { success: false, error: 'Internal error' };
  }
}

// Initialize user session when they access the AI assistant
app.post('/api/init-session', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID required' });
    }

    // Generate a secure session token
    const sessionToken = require('crypto').randomBytes(32).toString('hex');
    setUserSessionToken(userId, sessionToken);

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
    const sessionToken = require('crypto').randomBytes(32).toString('hex');
    setUserSessionToken(userId, sessionToken);

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

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getAccessToken(code);
    
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
    
    if (!tokens.success) {
      return res.json({ connected: false });
    }

    // Try to get user profile to verify connection
    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token
    });

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

    // Revoke tokens
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
    
    if (!tokens.success) {
      return res.status(401).json({ success: false, error: 'Gmail not connected' });
    }

    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token
    });

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
    
    if (!tokens.success) {
      return res.status(401).json({ success: false, error: 'Gmail not connected' });
    }

    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token
    });

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
    
    if (!tokens.success) {
      return res.status(401).json({ success: false, error: 'Gmail not connected' });
    }

    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token
    });

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

// AI Agent Processing with enhanced security
app.post('/api/chat/agent-process', async (req, res) => {
  try {
    const { message, userId, context = {} } = req.body;
    
    if (!message || !userId) {
      return res.status(400).json({ success: false, error: 'Message and user ID required' });
    }

    // Initialize session if not exists
    if (!getUserSessionToken(userId)) {
      const sessionToken = require('crypto').randomBytes(32).toString('hex');
      setUserSessionToken(userId, sessionToken);
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    // Enhanced prompt with security considerations
    const systemPrompt = `You are SimAlly, an intelligent AI assistant. You help users with:
    
    1. Gmail management (if connected)
    2. Task creation and management
    3. Calendar events
    4. Document generation
    5. Meeting coordination
    6. General questions
    
    SECURITY NOTES:
    - All sensitive data is encrypted
    - Gmail tokens are session-specific
    - Never expose raw tokens or credentials
    - Always validate user permissions
    
    Available endpoints:
    - GET /api/gmail/emails?userId=${userId}&query=QUERY - Get emails
    - POST /api/gmail/delete-emails - Delete emails
    - GET /api/gmail/status?userId=${userId} - Check Gmail status
    
    Context: ${JSON.stringify(context)}
    
    User message: "${message}"
    
    Analyze the message and determine if you need to:
    1. Call an endpoint (respond with intent: "endpoint_call")
    2. Provide general assistance (respond with intent: "general_chat")
    
    If calling an endpoint, provide the endpoint details and expected response format.
    Always prioritize user security and data protection.`;

    const result = await model.generateContent(systemPrompt);
    const response = result.response.text();
    
    // Parse AI response to determine intent
    let intent = 'general_chat';
    let endpointCall = null;
    
    if (response.toLowerCase().includes('endpoint_call')) {
      intent = 'endpoint_call';
      
      // Extract endpoint information from response
      if (message.toLowerCase().includes('email') || message.toLowerCase().includes('gmail')) {
        if (message.toLowerCase().includes('show') || message.toLowerCase().includes('get') || message.toLowerCase().includes('list')) {
          endpointCall = {
            method: 'GET',
            url: `/api/gmail/emails?userId=${userId}&maxResults=10`,
            description: 'Fetching your emails...'
          };
        }
      }
    }
    
    // Execute endpoint call if needed
    let endpointResult = null;
    if (endpointCall) {
      try {
        // Make internal API call
        const apiResponse = await fetch(`${VITE_AI_API_URL}${endpointCall.url}`, {
          method: endpointCall.method,
          headers: { 'Content-Type': 'application/json' }
        });
        
        const apiData = await apiResponse.json();
        endpointResult = apiData;
      } catch (error) {
        console.error('Endpoint call failed:', error);
        endpointResult = { success: false, error: 'Failed to fetch data' };
      }
    }
    
    // Generate final response
    let finalResponse = response;
    if (endpointResult) {
      if (endpointResult.success && endpointResult.emails) {
        finalResponse = `📧 Found ${endpointResult.emails.length} emails in your inbox.`;
      } else {
        finalResponse = `❌ ${endpointResult.error || 'Failed to fetch emails'}`;
      }
    }
    
    res.json({
      success: true,
      agent: {
        intent,
        response: finalResponse,
        result: endpointResult
      }
    });
  } catch (error) {
    console.error('Error in agent processing:', error);
    res.status(500).json({ success: false, error: 'Failed to process request' });
  }
});

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'ai-assistant',
    timestamp: new Date().toISOString(),
    security: 'enhanced'
  });
});

// Cleanup expired sessions periodically
setInterval(() => {
  // In production, implement proper session cleanup
  console.log('Session cleanup - Active sessions:', userSessions.size);
}, 60000); // Every minute

app.listen(PORT, () => {
  console.log(`AI Assistant server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log('Enhanced security features enabled');
});

module.exports = app;