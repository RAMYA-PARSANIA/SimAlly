const express = require('express');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const cors = require('cors');
const dotenv = require('dotenv');
const crypto = require('crypto');

dotenv.config();

const router = express.Router();

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || 'http://localhost:8000/api/google/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

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

// Store tokens temporarily in memory (in production, use a database)
const tokenStore = new Map();

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
router.get('/auth-url', (req, res) => {
  try {
    const oAuth2Client = createOAuthClient();
    
    // Use userId as the session identifier if provided
    const userId = req.query.userId || null;
    const sessionId = userId || generateSessionId();
    
    console.log(`[${Date.now()}] Generated session ID: ${sessionId} (userId: ${userId || 'none'})`);
    
    // Store session ID in cookie
    res.cookie('google_session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: 'lax' // Changed from 'None' to 'lax' for better compatibility
    });
    
    // Also store in state parameter for OAuth flow
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

    // Use the state parameter as the session ID
    // This ensures consistency between the auth request and callback
    const sessionId = state;
    
    if (!sessionId) {
      console.error(`[${Date.now()}] No session ID found in state parameter`);
      return res.redirect(`${FRONTEND_URL}/dashboard?google_error=true`);
    }

    // Store tokens with session ID
    console.log(`[${Date.now()}] Storing tokens for session ID: ${sessionId}`);
    tokenStore.set(sessionId, tokens);
    
    // If sessionId is a UUID (userId), also store with that key for direct access
    if (sessionId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      console.log(`[${Date.now()}] Also storing tokens with userId: ${sessionId}`);
      tokenStore.set(sessionId, tokens);
    }

    // Also set the cookie again to ensure it's consistent
    res.cookie('google_session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: 'lax'
    });

    // Redirect back to frontend
    console.log(`[${Date.now()}] Redirecting to frontend with success`);
    res.redirect(`${FRONTEND_URL}/dashboard?google_connected=true`);
  } catch (error) {
    console.error(`[${Date.now()}] Error in callback:`, error);
    res.redirect(`${FRONTEND_URL}/dashboard?google_error=true`);
  }
});

// Check connection status
router.get('/status', (req, res) => {
  // Try to get session ID from multiple sources
  const cookieSessionId = req.cookies.google_session_id;
  const queryUserId = req.query.userId;
  
  // Use userId as primary identifier if provided
  const sessionId = queryUserId || cookieSessionId;
  
  console.log(`[${Date.now()}] Checking Google connection status for session ID: ${sessionId}`);
  console.log(`[${Date.now()}] Cookie session ID: ${cookieSessionId}, Query userId: ${queryUserId}`);

  if (!sessionId) {
    console.log(`[${Date.now()}] No session ID found`);
    return res.json({ success: true, connected: false });
  }
  
  // Check both the sessionId and userId keys in tokenStore
  let tokens = tokenStore.get(sessionId);
  
  // If tokens not found with sessionId, try with userId
  if (!tokens && queryUserId) {
    console.log(`[${Date.now()}] Tokens not found with sessionId, trying userId: ${queryUserId}`);
    tokens = tokenStore.get(queryUserId);
  }
  
  if (!tokens) {
    console.log(`[${Date.now()}] No tokens found for session ID: ${sessionId}`);
    return res.json({ success: true, connected: false });
  }

  console.log(`[${Date.now()}] Tokens retrieved for session ID: ${sessionId}`, tokens);

  // Check if token is expired
  const isExpired = tokens.expiry_date && tokens.expiry_date < Date.now();
  console.log(`[${Date.now()}] Token expiry status for session ID: ${sessionId}: ${isExpired}`);

  if (isExpired && !tokens.refresh_token) {
    console.log(`[${Date.now()}] Token expired and no refresh token available for session ID: ${sessionId}`);
    tokenStore.delete(sessionId);
    if (queryUserId) tokenStore.delete(queryUserId);
    return res.json({ success: true, connected: false });
  }

  console.log(`[${Date.now()}] Google connection status: connected for session ID: ${sessionId}`);
  res.json({ 
    success: true, 
    connected: true,
    token: tokens.access_token,
    expiresAt: tokens.expiry_date
  });
});

// Disconnect Google
router.post('/disconnect', (req, res) => {
  // Try to get session ID from multiple sources
  const cookieSessionId = req.cookies.google_session_id;
  const bodyUserId = req.body.userId;
  
  // Use userId as primary identifier if provided
  const sessionId = bodyUserId || cookieSessionId;
  
  console.log(`[${Date.now()}] Disconnecting Google for session ID: ${sessionId}`);
  
  if (sessionId) {
    tokenStore.delete(sessionId);
    
    // If bodyUserId is provided, also delete that key
    if (bodyUserId && bodyUserId !== sessionId) {
      console.log(`[${Date.now()}] Also deleting tokens for userId: ${bodyUserId}`);
      tokenStore.delete(bodyUserId);
    }
    
    res.clearCookie('google_session_id');
    console.log(`[${Date.now()}] Deleted tokens for session ID: ${sessionId}`);
  } else {
    console.log(`[${Date.now()}] No tokens found for session ID: ${sessionId}`);
  }
  
  res.json({ success: true, message: 'Google account disconnected' });
});

// Gmail API endpoints
router.get('/gmail/messages', async (req, res) => {
  // Try to get session ID from multiple sources
  const cookieSessionId = req.cookies.google_session_id;
  const queryUserId = req.query.userId;
  
  // Use userId as primary identifier if provided
  const sessionId = queryUserId || cookieSessionId;
  
  const { maxResults = 10, query = '' } = req.query;
  
  console.log(`[${Date.now()}] Fetching Gmail messages for session ID: ${sessionId}`);
  
  // Check both the sessionId and userId keys in tokenStore
  let tokens = tokenStore.get(sessionId);
  
  // If tokens not found with sessionId, try with userId
  if (!tokens && queryUserId) {
    console.log(`[${Date.now()}] Tokens not found with sessionId, trying userId: ${queryUserId}`);
    tokens = tokenStore.get(queryUserId);
  }
  
  if (!tokens) {
    console.log(`[${Date.now()}] No tokens found for session ID: ${sessionId}`);
    return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
  }
  
  try {
    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials(tokens);
    
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
    
    console.log(`[${Date.now()}] Getting emails for userId: ${sessionId}, query: ${query}`);
    
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
  // Try to get session ID from multiple sources
  const cookieSessionId = req.cookies.google_session_id;
  const queryUserId = req.query.userId;
  
  // Use userId as primary identifier if provided
  const sessionId = queryUserId || cookieSessionId;
  
  const { emailId } = req.params;
  
  console.log(`[${Date.now()}] Fetching email content for session ID: ${sessionId}, email ID: ${emailId}`);
  
  // Check both the sessionId and userId keys in tokenStore
  let tokens = tokenStore.get(sessionId);
  
  // If tokens not found with sessionId, try with userId
  if (!tokens && queryUserId) {
    console.log(`[${Date.now()}] Tokens not found with sessionId, trying userId: ${queryUserId}`);
    tokens = tokenStore.get(queryUserId);
  }
  
  if (!tokens) {
    console.log(`[${Date.now()}] No tokens found for session ID: ${sessionId}`);
    return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
  }
  
  try {
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
router.post('/gmail/delete-emails', async (req, res) => {
  // Try to get session ID from multiple sources
  const cookieSessionId = req.cookies.google_session_id;
  const bodyUserId = req.body.userId;
  
  // Use userId as primary identifier if provided
  const sessionId = bodyUserId || cookieSessionId;
  
  const { messageIds } = req.body;
  
  console.log(`[${Date.now()}] Deleting emails for session ID: ${sessionId}`);
  
  // Check both the sessionId and userId keys in tokenStore
  let tokens = tokenStore.get(sessionId);
  
  // If tokens not found with sessionId, try with userId
  if (!tokens && bodyUserId) {
    console.log(`[${Date.now()}] Tokens not found with sessionId, trying userId: ${bodyUserId}`);
    tokens = tokenStore.get(bodyUserId);
  }
  
  if (!tokens) {
    console.log(`[${Date.now()}] No tokens found for session ID: ${sessionId}`);
    return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
  }
  
  if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
    return res.status(400).json({ success: false, error: 'No message IDs provided' });
  }
  
  try {
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
  // Try to get session ID from multiple sources
  const cookieSessionId = req.cookies.google_session_id;
  const queryUserId = req.query.userId;
  
  // Use userId as primary identifier if provided
  const sessionId = queryUserId || cookieSessionId;
  
  console.log(`[${Date.now()}] Fetching user profile for session ID: ${sessionId}`);
  
  // Check both the sessionId and userId keys in tokenStore
  let tokens = tokenStore.get(sessionId);
  
  // If tokens not found with sessionId, try with userId
  if (!tokens && queryUserId) {
    console.log(`[${Date.now()}] Tokens not found with sessionId, trying userId: ${queryUserId}`);
    tokens = tokenStore.get(queryUserId);
  }
  
  if (!tokens) {
    console.log(`[${Date.now()}] No tokens found for session ID: ${sessionId}`);
    return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
  }
  
  try {
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
  // Try to get session ID from multiple sources
  const cookieSessionId = req.cookies.google_session_id;
  const queryUserId = req.query.userId;
  
  // Use userId as primary identifier if provided
  const sessionId = queryUserId || cookieSessionId;
  
  const { maxResults = 10, query = '' } = req.query;
  
  console.log(`[${Date.now()}] Fetching Drive files for session ID: ${sessionId}`);
  
  // Check both the sessionId and userId keys in tokenStore
  let tokens = tokenStore.get(sessionId);
  
  // If tokens not found with sessionId, try with userId
  if (!tokens && queryUserId) {
    console.log(`[${Date.now()}] Tokens not found with sessionId, trying userId: ${queryUserId}`);
    tokens = tokenStore.get(queryUserId);
  }
  
  if (!tokens) {
    console.log(`[${Date.now()}] No tokens found for session ID: ${sessionId}`);
    return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
  }
  
  try {
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
  // Try to get session ID from multiple sources
  const cookieSessionId = req.cookies.google_session_id;
  const bodyUserId = req.body.userId;
  
  // Use userId as primary identifier if provided
  const sessionId = bodyUserId || cookieSessionId;
  
  console.log(`[${Date.now()}] Refreshing token for session ID: ${sessionId}`);
  
  // Check both the sessionId and userId keys in tokenStore
  let tokens = tokenStore.get(sessionId);
  
  // If tokens not found with sessionId, try with userId
  if (!tokens && bodyUserId) {
    console.log(`[${Date.now()}] Tokens not found with sessionId, trying userId: ${bodyUserId}`);
    tokens = tokenStore.get(bodyUserId);
  }
  
  if (!tokens) {
    console.log(`[${Date.now()}] No tokens found for session ID: ${sessionId}`);
    return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
  }
  
  try {
    if (!tokens.refresh_token) {
      return res.status(400).json({ success: false, error: 'No refresh token available' });
    }
    
    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials(tokens);
    
    const { credentials } = await oAuth2Client.refreshAccessToken();
    
    // Update stored tokens for both sessionId and userId
    tokenStore.set(sessionId, credentials);
    if (bodyUserId && bodyUserId !== sessionId) {
      tokenStore.set(bodyUserId, credentials);
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
  // Try to get session ID from multiple sources
  const cookieSessionId = req.cookies.google_session_id;
  const queryUserId = req.query.userId;
  
  // Use userId as primary identifier if provided
  const sessionId = queryUserId || cookieSessionId;
  
  console.log(`[${Date.now()}] Fetching unread emails for session ID: ${sessionId}`);
  
  // Check both the sessionId and userId keys in tokenStore
  let tokens = tokenStore.get(sessionId);
  
  // If tokens not found with sessionId, try with userId
  if (!tokens && queryUserId) {
    console.log(`[${Date.now()}] Tokens not found with sessionId, trying userId: ${queryUserId}`);
    tokens = tokenStore.get(queryUserId);
  }
  
  if (!tokens) {
    console.log(`[${Date.now()}] No tokens found for session ID: ${sessionId}`);
    return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
  }
  
  try {
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

module.exports = { router, tokenStore };