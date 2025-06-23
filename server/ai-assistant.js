const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
const WorkspaceProcessor = require('./workspace-processor');
require('dotenv').config();

const app = express();
const PORT = process.env.AI_ASSISTANT_PORT || 8001;

// Initialize services
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);
const workspaceProcessor = new WorkspaceProcessor();

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Gmail OAuth2 configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

// Store Gmail tokens in Supabase
async function storeGmailTokens(userId, tokens) {
  try {
    console.log('Storing Gmail tokens for user:', userId);
    console.log('Token data received:', { 
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expires_in,
      expiryDate: tokens.expiry_date
    });

    // Calculate expiration time
    let expiresAt;
    if (tokens.expires_in) {
      // expires_in is in seconds, convert to milliseconds and add to current time
      expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));
    } else if (tokens.expiry_date) {
      expiresAt = new Date(tokens.expiry_date);
    } else {
      // Default to 1 hour from now
      expiresAt = new Date(Date.now() + (3600 * 1000));
    }

    console.log('Calculated expires_at:', expiresAt.toISOString());

    const { data, error } = await supabase
      .from('gmail_tokens')
      .upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: tokens.token_type || 'Bearer',
        expires_at: expiresAt.toISOString(),
        scope: tokens.scope
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('Supabase error storing tokens:', error);
      throw error;
    }

    console.log('Gmail tokens stored successfully for user:', userId);
    return { success: true };
  } catch (error) {
    console.error('Error storing Gmail tokens:', error);
    throw error;
  }
}

// Get Gmail tokens from Supabase
async function getGmailTokens(userId) {
  try {
    const { data, error } = await supabase
      .from('gmail_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('No Gmail tokens found for user', userId);
        return null;
      }
      throw error;
    }

    // Check if token is expired
    const now = new Date();
    const expiresAt = new Date(data.expires_at);
    
    if (expiresAt <= now) {
      console.log('Gmail token expired for user', userId);
      // Try to refresh token
      if (data.refresh_token) {
        return await refreshGmailToken(userId, data.refresh_token);
      } else {
        // Remove expired token
        await supabase
          .from('gmail_tokens')
          .delete()
          .eq('user_id', userId);
        return null;
      }
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

// Refresh Gmail token
async function refreshGmailToken(userId, refreshToken) {
  try {
    console.log('Refreshing Gmail token for user:', userId);
    
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    console.log('Token refreshed successfully');

    // Store new tokens
    await storeGmailTokens(userId, credentials);
    
    return credentials;
  } catch (error) {
    console.error('Error refreshing Gmail token:', error);
    // Remove invalid tokens
    await supabase
      .from('gmail_tokens')
      .delete()
      .eq('user_id', userId);
    return null;
  }
}

// Check Gmail connection status
async function checkGmailStatus(userId) {
  console.log('Gmail status check for user', userId + ': checking...');
  
  try {
    const tokens = await getGmailTokens(userId);
    
    if (!tokens) {
      console.log('Gmail status check for user', userId + ': disconnected');
      return { connected: false };
    }

    // Test the connection by making a simple API call
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const profile = await gmail.users.getProfile({ userId: 'me' });
    
    console.log('Gmail status check for user', userId + ': connected');
    return {
      connected: true,
      email: profile.data.emailAddress,
      unreadCount: profile.data.messagesTotal
    };
  } catch (error) {
    console.error('Gmail status check error:', error);
    console.log('Gmail status check for user', userId + ': disconnected');
    return { connected: false };
  }
}

// Routes

// Gmail OAuth routes
app.get('/api/gmail/auth-url', (req, res) => {
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID required' });
  }

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
  const { code, state: userId } = req.query;

  if (!code || !userId) {
    return res.status(400).send('Missing authorization code or user ID');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('Gmail connected for user', userId);
    
    await storeGmailTokens(userId, tokens);
    
    // Redirect back to assistant page with success
    res.redirect('http://localhost:5173/assistant?gmail_connected=true');
  } catch (error) {
    console.error('Error storing Gmail tokens:', error);
    res.status(500).send('Failed to connect Gmail');
  }
});

app.get('/api/gmail/status', async (req, res) => {
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID required' });
  }

  const status = await checkGmailStatus(userId);
  res.json(status);
});

app.post('/api/gmail/disconnect', async (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID required' });
  }

  try {
    await supabase
      .from('gmail_tokens')
      .delete()
      .eq('user_id', userId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting Gmail:', error);
    res.status(500).json({ success: false, error: 'Failed to disconnect Gmail' });
  }
});

// Workspace message processing
app.post('/api/chat/process-message', async (req, res) => {
  try {
    const result = await workspaceProcessor.processMessage(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error processing workspace message:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Channel summary
app.post('/api/workspace/channel-summary', async (req, res) => {
  try {
    const { channelId, timeframe } = req.body;
    const result = await workspaceProcessor.generateChannelSummary(channelId, timeframe);
    res.json(result);
  } catch (error) {
    console.error('Error generating channel summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Meeting notes extraction
app.post('/api/meetings/extract-notes', async (req, res) => {
  try {
    const { transcript, participants, duration } = req.body;
    const result = await workspaceProcessor.extractMeetingNotes(transcript, participants, duration);
    res.json(result);
  } catch (error) {
    console.error('Error extracting meeting notes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    services: {
      gemini: !!process.env.GEMINI_API_KEY,
      gmail: !!(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET),
      supabase: !!(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_SERVICE_ROLE_KEY)
    },
    framework: 'Express.js'
  });
});

app.listen(PORT, () => {
  console.log(`AI Assistant server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});