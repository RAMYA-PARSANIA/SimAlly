const express = require('express');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const cors = require('cors');
const dotenv = require('dotenv');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

const router = express.Router();

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || 'http://localhost:8000/api/google/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

// Scopes for Google APIs - expanded for more access
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/drive.readonly'
];

// Create OAuth client
const createOAuthClient = () => {
  return new OAuth2Client(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );
};

// Generate a session ID for token storage
const generateSessionId = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Get auth URL
router.get('/auth-url', async (req, res) => {
  try {
    const oAuth2Client = createOAuthClient();
    
    // Use userId as the session identifier if provided
    const userId = req.query.userId || null;
    const sessionId = userId || generateSessionId();
    
    console.log(`[${Date.now()}] Generated session ID: ${sessionId} (userId: ${userId || 'none'})`);
    
    // Generate auth URL with state parameter for OAuth flow
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      state: sessionId
    });
    
    res.json({ success: true, authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ success: false, error: 'Failed to generate auth URL' });
  }
});

// OAuth callback
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  console.log(`[${Date.now()}] Google OAuth callback triggered with code: ${code ? 'present' : 'missing'}, state: ${state || 'missing'}`);

  if (!code) {
    console.error(`[${Date.now()}] No code received in callback`);
    return res.redirect(`${FRONTEND_URL}/dashboard?google_error=true`);
  }

  try {
    const oAuth2Client = createOAuthClient();
    console.log(`[${Date.now()}] OAuth client created successfully`);

    // Get tokens with error handling
    let tokens;
    try {
      console.log(`[${Date.now()}] Attempting to exchange code for tokens`);
      const tokenResponse = await oAuth2Client.getToken(code);
      tokens = tokenResponse.tokens;
      console.log(`[${Date.now()}] Tokens received:`, tokens);
    } catch (tokenError) {
      console.error(`[${Date.now()}] Error getting tokens:`, tokenError);
      return res.redirect(`${FRONTEND_URL}/dashboard?google_error=true`);
    }

    if (!tokens) {
      console.error(`[${Date.now()}] No tokens received from Google`);
      return res.redirect(`${FRONTEND_URL}/dashboard?google_error=true`);
    }

    // Use the state parameter as the session ID/userId
    const userId = state;
    
    if (!userId) {
      console.error(`[${Date.now()}] No user ID found in state parameter`);
      return res.redirect(`${FRONTEND_URL}/dashboard?google_error=true`);
    }

    // Store tokens in Supabase
    try {
      // Call the Supabase function to store tokens
      const { data, error } = await supabase.rpc('store_gmail_tokens', {
        p_user_id: userId,
        p_access_token: tokens.access_token,
        p_refresh_token: tokens.refresh_token || null,
        p_token_type: tokens.token_type || 'Bearer',
        p_expires_at: new Date(tokens.expiry_date).toISOString(),
        p_scope: tokens.scope || null,
        p_session_id: userId
      });
      
      if (error) {
        console.error(`[${Date.now()}] Error storing tokens in Supabase:`, error);
        return res.redirect(`${FRONTEND_URL}/dashboard?google_error=true`);
      }
      
      console.log(`[${Date.now()}] Tokens stored successfully in Supabase for user: ${userId}`);
    } catch (storageError) {
      console.error(`[${Date.now()}] Error storing tokens in Supabase:`, storageError);
      return res.redirect(`${FRONTEND_URL}/dashboard?google_error=true`);
    }

    // Redirect back to frontend
    console.log(`[${Date.now()}] Redirecting to frontend with success`);
    res.redirect(`${FRONTEND_URL}/dashboard?google_connected=true`);
  } catch (error) {
    console.error(`[${Date.now()}] Error in callback:`, error);
    res.redirect(`${FRONTEND_URL}/dashboard?google_error=true`);
  }
});

// Check connection status
router.get('/status', async (req, res) => {
  // Try to get user ID from query parameter
  const userId = req.query.userId;
  
  console.log(`[${Date.now()}] Checking Google connection status for user ID: ${userId}`);

  if (!userId) {
    console.log(`[${Date.now()}] No user ID provided`);
    return res.json({ success: true, connected: false });
  }

  try {
    // Check if user has valid tokens in Supabase
    const { data, error } = await supabase.rpc('has_gmail_tokens', {
      p_user_id: userId
    });
    
    if (error) {
      console.error(`[${Date.now()}] Error checking token status in Supabase:`, error);
      return res.json({ success: true, connected: false });
    }
    
    if (!data) {
      console.log(`[${Date.now()}] No valid tokens found for user: ${userId}`);
      return res.json({ success: true, connected: false });
    }
    
    // Get tokens to check expiration
    const tokensResult = await supabase.rpc('get_gmail_tokens', {
      p_user_id: userId
    });
    
    if (tokensResult.error || !tokensResult.data || !tokensResult.data.success) {
      console.log(`[${Date.now()}] Error retrieving tokens or tokens invalid:`, tokensResult.error || 'Invalid tokens');
      return res.json({ success: true, connected: false });
    }
    
    console.log(`[${Date.now()}] Google connection status: connected for user ID: ${userId}`);
    
    // Return connection status with token info
    return res.json({ 
      success: true, 
      connected: true,
      expiresAt: tokensResult.data.expires_at
    });
  } catch (error) {
    console.error(`[${Date.now()}] Error checking Google connection status:`, error);
    return res.json({ success: true, connected: false });
  }
});

// Disconnect Google
router.post('/disconnect', async (req, res) => {
  const userId = req.body.userId;
  
  console.log(`[${Date.now()}] Disconnecting Google for user ID: ${userId}`);
  
  if (!userId) {
    console.log(`[${Date.now()}] No user ID provided`);
    return res.json({ success: false, error: 'User ID is required' });
  }
  
  try {
    // Revoke tokens in Supabase
    const { data, error } = await supabase.rpc('revoke_gmail_tokens', {
      p_user_id: userId
    });
    
    if (error) {
      console.error(`[${Date.now()}] Error revoking tokens in Supabase:`, error);
      return res.json({ success: false, error: 'Failed to disconnect Google account' });
    }
    
    console.log(`[${Date.now()}] Successfully revoked tokens for user: ${userId}`);
    return res.json({ success: true, message: 'Google account disconnected' });
  } catch (error) {
    console.error(`[${Date.now()}] Error disconnecting Google:`, error);
    return res.json({ success: false, error: 'Failed to disconnect Google account' });
  }
});

// Gmail API endpoints
router.get('/gmail/messages', async (req, res) => {
  const userId = req.query.userId;
  const { maxResults = 10, query = '' } = req.query;
  
  console.log(`[${Date.now()}] Fetching Gmail messages for user ID: ${userId}`);
  
  if (!userId) {
    console.log(`[${Date.now()}] No user ID provided`);
    return res.status(401).json({ success: false, error: 'User ID is required' });
  }
  
  try {
    // Get tokens from Supabase
    const tokensResult = await supabase.rpc('get_gmail_tokens', {
      p_user_id: userId
    });
    
    if (tokensResult.error || !tokensResult.data || !tokensResult.data.success) {
      console.log(`[${Date.now()}] Error retrieving tokens or tokens invalid:`, tokensResult.error || 'Invalid tokens');
      return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
    }
    
    const tokens = {
      access_token: tokensResult.data.access_token,
      refresh_token: tokensResult.data.refresh_token,
      token_type: tokensResult.data.token_type || 'Bearer',
      expiry_date: new Date(tokensResult.data.expires_at).getTime()
    };
    
    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials(tokens);
    
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
    
    console.log(`[${Date.now()}] Getting emails for userId: ${userId}, query: ${query}`);
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: parseInt(maxResults),
      q: query
    });
    
    const messages = [];
    
    // Get details for each message
    for (const message of response.data.messages || []) {
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
      
      messages.push({
        id: message.id,
        threadId: message.threadId,
        subject,
        from,
        date,
        snippet: details.data.snippet,
        isUnread: details.data.labelIds?.includes('UNREAD') || false
      });
    }
    
    res.json({ success: true, messages });
  } catch (error) {
    console.error('Error fetching Gmail messages:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch Gmail messages' });
  }
});

// Get email content
router.get('/gmail/email/:emailId', async (req, res) => {
  const userId = req.query.userId;
  const { emailId } = req.params;
  
  console.log(`[${Date.now()}] Fetching email content for user ID: ${userId}, email ID: ${emailId}`);
  
  if (!userId) {
    console.log(`[${Date.now()}] No user ID provided`);
    return res.status(401).json({ success: false, error: 'User ID is required' });
  }
  
  try {
    // Get tokens from Supabase
    const tokensResult = await supabase.rpc('get_gmail_tokens', {
      p_user_id: userId
    });
    
    if (tokensResult.error || !tokensResult.data || !tokensResult.data.success) {
      console.log(`[${Date.now()}] Error retrieving tokens or tokens invalid:`, tokensResult.error || 'Invalid tokens');
      return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
    }
    
    const tokens = {
      access_token: tokensResult.data.access_token,
      refresh_token: tokensResult.data.refresh_token,
      token_type: tokensResult.data.token_type || 'Bearer',
      expiry_date: new Date(tokensResult.data.expires_at).getTime()
    };
    
    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials(tokens);
    
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
    
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: emailId,
      format: 'full'
    });
    
    const message = response.data;
    const headers = message.payload.headers;
    const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
    const from = headers.find(h => h.name === 'From')?.value || '';
    const date = headers.find(h => h.name === 'Date')?.value || '';
    
    // Extract body content
    let body = '';
    
    // Function to extract body parts recursively
    const extractBody = (part) => {
      if (part.mimeType === 'text/html' && part.body.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.mimeType === 'text/plain' && part.body.data && !body) {
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
    if (message.payload.mimeType === 'text/html' && message.payload.body.data) {
      body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
    } else if (message.payload.parts) {
      for (const part of message.payload.parts) {
        const extractedBody = extractBody(part);
        if (extractedBody) {
          body = extractedBody;
          break;
        }
      }
    } else if (message.payload.body.data) {
      body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
    }
    
    // Check for unsubscribe link
    let unsubscribeUrl = null;
    const listUnsubscribe = headers.find(h => h.name === 'List-Unsubscribe')?.value;
    if (listUnsubscribe) {
      const match = listUnsubscribe.match(/<(https?:\/\/[^>]+)>/);
      if (match) {
        unsubscribeUrl = match[1];
      }
    }
    
    // Mark as read
    await gmail.users.messages.modify({
      userId: 'me',
      id: emailId,
      resource: {
        removeLabelIds: ['UNREAD']
      }
    });
    
    res.json({
      success: true,
      email: {
        id: message.id,
        threadId: message.threadId,
        subject,
        from,
        date,
        body,
        unsubscribeUrl,
        isUnread: message.labelIds?.includes('UNREAD') || false
      }
    });
  } catch (error) {
    console.error('Error fetching email content:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch email content' });
  }
});

// Delete emails
router.post('/delete-emails', async (req, res) => {
  const userId = req.body.userId;
  const { messageIds } = req.body;
  
  console.log(`[${Date.now()}] Deleting emails for user ID: ${userId}`);
  
  if (!userId) {
    console.log(`[${Date.now()}] No user ID provided`);
    return res.status(401).json({ success: false, error: 'User ID is required' });
  }
  
  if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
    return res.status(400).json({ success: false, error: 'No message IDs provided' });
  }
  
  try {
    // Get tokens from Supabase
    const tokensResult = await supabase.rpc('get_gmail_tokens', {
      p_user_id: userId
    });
    
    if (tokensResult.error || !tokensResult.data || !tokensResult.data.success) {
      console.log(`[${Date.now()}] Error retrieving tokens or tokens invalid:`, tokensResult.error || 'Invalid tokens');
      return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
    }
    
    const tokens = {
      access_token: tokensResult.data.access_token,
      refresh_token: tokensResult.data.refresh_token,
      token_type: tokensResult.data.token_type || 'Bearer',
      expiry_date: new Date(tokensResult.data.expires_at).getTime()
    };
    
    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials(tokens);
    
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
        console.error(`Error deleting message ${messageId}:`, error);
        failed++;
      }
    }
    
    res.json({
      success: true,
      deleted,
      failed
    });
  } catch (error) {
    console.error('Error deleting emails:', error);
    res.status(500).json({ success: false, error: 'Failed to delete emails' });
  }
});

// Get user profile
router.get('/user-profile', async (req, res) => {
  const userId = req.query.userId;
  
  console.log(`[${Date.now()}] Fetching user profile for user ID: ${userId}`);
  
  if (!userId) {
    console.log(`[${Date.now()}] No user ID provided`);
    return res.status(401).json({ success: false, error: 'User ID is required' });
  }
  
  try {
    // Get tokens from Supabase
    const tokensResult = await supabase.rpc('get_gmail_tokens', {
      p_user_id: userId
    });
    
    if (tokensResult.error || !tokensResult.data || !tokensResult.data.success) {
      console.log(`[${Date.now()}] Error retrieving tokens or tokens invalid:`, tokensResult.error || 'Invalid tokens');
      return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
    }
    
    const tokens = {
      access_token: tokensResult.data.access_token,
      refresh_token: tokensResult.data.refresh_token,
      token_type: tokensResult.data.token_type || 'Bearer',
      expiry_date: new Date(tokensResult.data.expires_at).getTime()
    };
    
    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials(tokens);
    
    const people = google.people({ version: 'v1', auth: oAuth2Client });
    
    const response = await people.people.get({
      resourceName: 'people/me',
      personFields: 'names,emailAddresses,photos'
    });
    
    const profile = {
      name: response.data.names?.[0]?.displayName || '',
      email: response.data.emailAddresses?.[0]?.value || '',
      photo: response.data.photos?.[0]?.url || ''
    };
    
    res.json({ success: true, profile });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user profile' });
  }
});

// Get drive files
router.get('/drive/files', async (req, res) => {
  const userId = req.query.userId;
  const { maxResults = 10, query = '' } = req.query;
  
  console.log(`[${Date.now()}] Fetching Drive files for user ID: ${userId}`);
  
  if (!userId) {
    console.log(`[${Date.now()}] No user ID provided`);
    return res.status(401).json({ success: false, error: 'User ID is required' });
  }
  
  try {
    // Get tokens from Supabase
    const tokensResult = await supabase.rpc('get_gmail_tokens', {
      p_user_id: userId
    });
    
    if (tokensResult.error || !tokensResult.data || !tokensResult.data.success) {
      console.log(`[${Date.now()}] Error retrieving tokens or tokens invalid:`, tokensResult.error || 'Invalid tokens');
      return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
    }
    
    const tokens = {
      access_token: tokensResult.data.access_token,
      refresh_token: tokensResult.data.refresh_token,
      token_type: tokensResult.data.token_type || 'Bearer',
      expiry_date: new Date(tokensResult.data.expires_at).getTime()
    };
    
    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials(tokens);
    
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });
    
    const response = await drive.files.list({
      pageSize: parseInt(maxResults),
      q: query ? `name contains '${query}'` : '',
      fields: 'files(id, name, mimeType, webViewLink, iconLink, createdTime, modifiedTime, size)'
    });
    
    res.json({
      success: true,
      files: response.data.files || []
    });
  } catch (error) {
    console.error('Error fetching Drive files:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch Drive files' });
  }
});

// Refresh token if expired
router.post('/refresh-token', async (req, res) => {
  const userId = req.body.userId;
  
  console.log(`[${Date.now()}] Refreshing token for user ID: ${userId}`);
  
  if (!userId) {
    console.log(`[${Date.now()}] No user ID provided`);
    return res.status(401).json({ success: false, error: 'User ID is required' });
  }
  
  try {
    // Get tokens from Supabase
    const tokensResult = await supabase.rpc('get_gmail_tokens', {
      p_user_id: userId
    });
    
    if (tokensResult.error || !tokensResult.data || !tokensResult.data.success) {
      console.log(`[${Date.now()}] Error retrieving tokens or tokens invalid:`, tokensResult.error || 'Invalid tokens');
      return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
    }
    
    const tokens = {
      access_token: tokensResult.data.access_token,
      refresh_token: tokensResult.data.refresh_token,
      token_type: tokensResult.data.token_type || 'Bearer',
      expiry_date: new Date(tokensResult.data.expires_at).getTime()
    };
    
    if (!tokens.refresh_token) {
      return res.status(400).json({ success: false, error: 'No refresh token available' });
    }
    
    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials(tokens);
    
    const { credentials } = await oAuth2Client.refreshAccessToken();
    
    // Update stored tokens in Supabase
    const { data, error } = await supabase.rpc('store_gmail_tokens', {
      p_user_id: userId,
      p_access_token: credentials.access_token,
      p_refresh_token: credentials.refresh_token || tokens.refresh_token,
      p_token_type: credentials.token_type || 'Bearer',
      p_expires_at: new Date(credentials.expiry_date).toISOString(),
      p_scope: credentials.scope || tokens.scope,
      p_session_id: userId
    });
    
    if (error) {
      console.error(`[${Date.now()}] Error storing refreshed tokens in Supabase:`, error);
      return res.status(500).json({ success: false, error: 'Failed to refresh token' });
    }
    
    res.json({
      success: true,
      token: credentials.access_token,
      expiresAt: credentials.expiry_date
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({ success: false, error: 'Failed to refresh token' });
  }
});

// Endpoint to get unread emails
router.get('/gmail/unread', async (req, res) => {
  const userId = req.query.userId;
  
  console.log(`[${Date.now()}] Fetching unread emails for user ID: ${userId}`);
  
  if (!userId) {
    console.log(`[${Date.now()}] No user ID provided`);
    return res.status(401).json({ success: false, error: 'User ID is required' });
  }
  
  try {
    // Get tokens from Supabase
    const tokensResult = await supabase.rpc('get_gmail_tokens', {
      p_user_id: userId
    });
    
    if (tokensResult.error || !tokensResult.data || !tokensResult.data.success) {
      console.log(`[${Date.now()}] Error retrieving tokens or tokens invalid:`, tokensResult.error || 'Invalid tokens');
      return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
    }
    
    const tokens = {
      access_token: tokensResult.data.access_token,
      refresh_token: tokensResult.data.refresh_token,
      token_type: tokensResult.data.token_type || 'Bearer',
      expiry_date: new Date(tokensResult.data.expires_at).getTime()
    };
    
    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials(tokens);
    
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 20,
      q: 'is:unread'
    });
    
    const messages = [];
    
    // Get details for each message
    for (const message of response.data.messages || []) {
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
      
      messages.push({
        id: message.id,
        threadId: message.threadId,
        subject,
        from,
        date,
        snippet: details.data.snippet,
        isUnread: true
      });
    }
    
    res.json({ success: true, messages });
  } catch (error) {
    console.error('Error fetching unread emails:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch unread emails' });
  }
});

module.exports = { router };