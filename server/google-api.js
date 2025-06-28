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
    const sessionId = generateSessionId();
    
    // Store session ID in cookie
    res.cookie('google_session_id', sessionId, {
      httpOnly: true,
      secure: true,
      maxAge: 30 * 24 * 60 * 30 , // 21 mins
      sameSite: 'None' // Allows cross-site cookies
    });
    
    console.log(`[${Date.now()}] Generated session ID: ${sessionId}`);
    console.log(`[${Date.now()}] Session ID in cookie during /auth-url: ${sessionId}`);
    
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
  console.log(`[${Date.now()}] Google OAuth callback triggered with code: ${code}, state: ${state}`);

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

    const sessionId = req.cookies.google_session_id;
    console.log(`[${Date.now()}] Session ID in cookie during OAuth callback: ${sessionId}`);
    if (!sessionId) {
      console.error(`[${Date.now()}] No session ID found in cookies`);
      return res.redirect(`${FRONTEND_URL}/dashboard?google_error=true`);
    }

    // Store tokens with session ID
    console.log(`[${Date.now()}] Storing tokens for session ID: ${sessionId}`);
    tokenStore.set(sessionId, tokens);
    console.log(`[${Date.now()}] Tokens received for session ID: ${sessionId}`);
    console.log(`[${Date.now()}] Session ID used for token storage during OAuth callback: ${sessionId}`);

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
  const sessionId = req.cookies.google_session_id;
  console.log(`[${Date.now()}] Checking Google connection status for session ID: ${sessionId}`);

  if (!sessionId || !tokenStore.has(sessionId)) {
    console.log(`[${Date.now()}] No session ID or tokens found for session ID: ${sessionId}`);
    return res.json({ success: true, connected: false });
  }

  const tokens = tokenStore.get(sessionId);
  console.log(`[${Date.now()}] Tokens retrieved for session ID: ${sessionId}`, tokens);

  // Check if token is expired
  const isExpired = tokens.expiry_date && tokens.expiry_date < Date.now();
  console.log(`[${Date.now()}] Token expiry status for session ID: ${sessionId}: ${isExpired}`);

  if (isExpired && !tokens.refresh_token) {
    console.log(`[${Date.now()}] Token expired and no refresh token available for session ID: ${sessionId}`);
    tokenStore.delete(sessionId);
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
  const sessionId = req.cookies.google_session_id;
  
  if (sessionId && tokenStore.has(sessionId)) {
    tokenStore.delete(sessionId);
    res.clearCookie('google_session_id');
  }
  
  res.json({ success: true, message: 'Google account disconnected' });
});

// Create a Google Meet meeting
router.post('/meetings/create', async (req, res) => {
  const sessionId = req.cookies.google_session_id;
  const { title, description, startTime, duration } = req.body;
  
  if (!sessionId || !tokenStore.has(sessionId)) {
    return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
  }
  
  try {
    const tokens = tokenStore.get(sessionId);
    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials(tokens);
    
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    
    // Calculate end time
    const start = new Date(startTime);
    const end = new Date(start.getTime() + (duration || 60) * 60000);
    
    // Create event with Google Meet conference
    const event = {
      summary: title || 'Google Meet Meeting',
      description: description || '',
      start: {
        dateTime: start.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      conferenceData: {
        createRequest: {
          requestId: crypto.randomBytes(16).toString('hex'),
          conferenceSolutionKey: {
            type: 'hangoutsMeet'
          }
        }
      }
    };
    
    const response = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      resource: event
    });
    
    // Format the response
    const meeting = {
      id: response.data.id,
      meetingId: response.data.conferenceData?.conferenceId,
      url: response.data.conferenceData?.entryPoints?.[0]?.uri || '',
      title: response.data.summary,
      description: response.data.description,
      startTime: response.data.start.dateTime,
      endTime: response.data.end.dateTime,
      status: response.data.status,
      attendees: response.data.attendees || []
    };
    
    res.json({ success: true, meeting });
  } catch (error) {
    console.error('Error creating meeting:', error);
    res.status(500).json({ success: false, error: 'Failed to create meeting' });
  }
});

// List Google Meet meetings
router.get('/meetings', async (req, res) => {
  const sessionId = req.cookies.google_session_id;
  
  if (!sessionId || !tokenStore.has(sessionId)) {
    return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
  }
  
  try {
    const tokens = tokenStore.get(sessionId);
    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials(tokens);
    
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    
    // Get events from now to 30 days in the future
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: thirtyDaysLater.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });
    
    // Filter for events with Google Meet conferences
    const meetings = response.data.items
      .filter(event => event.conferenceData?.conferenceSolution?.key?.type === 'hangoutsMeet')
      .map(event => ({
        id: event.id,
        meetingId: event.conferenceData?.conferenceId,
        url: event.conferenceData?.entryPoints?.[0]?.uri || '',
        title: event.summary,
        description: event.description,
        startTime: event.start.dateTime,
        endTime: event.end.dateTime,
        status: event.status,
        attendees: event.attendees || []
      }));
    
    res.json({ success: true, meetings });
  } catch (error) {
    console.error('Error listing meetings:', error);
    res.status(500).json({ success: false, error: 'Failed to list meetings' });
  }
});

// Get a specific meeting
router.get('/meetings/:eventId', async (req, res) => {
  const sessionId = req.cookies.google_session_id;
  const { eventId } = req.params;
  
  if (!sessionId || !tokenStore.has(sessionId)) {
    return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
  }
  
  try {
    const tokens = tokenStore.get(sessionId);
    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials(tokens);
    
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    
    const response = await calendar.events.get({
      calendarId: 'primary',
      eventId
    });
    
    const event = response.data;
    
    // Format the response
    const meeting = {
      id: event.id,
      meetingId: event.conferenceData?.conferenceId,
      url: event.conferenceData?.entryPoints?.[0]?.uri || '',
      title: event.summary,
      description: event.description,
      startTime: event.start.dateTime,
      endTime: event.end.dateTime,
      status: event.status,
      attendees: event.attendees || []
    };
    
    res.json({ success: true, meeting });
  } catch (error) {
    console.error('Error getting meeting:', error);
    res.status(500).json({ success: false, error: 'Failed to get meeting' });
  }
});

// Delete a meeting
router.delete('/meetings/:eventId', async (req, res) => {
  const sessionId = req.cookies.google_session_id;
  const { eventId } = req.params;
  
  if (!sessionId || !tokenStore.has(sessionId)) {
    return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
  }
  
  try {
    const tokens = tokenStore.get(sessionId);
    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials(tokens);
    
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    
    await calendar.events.delete({
      calendarId: 'primary',
      eventId
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting meeting:', error);
    res.status(500).json({ success: false, error: 'Failed to delete meeting' });
  }
});

// Gmail API endpoints
router.get('/gmail/messages', async (req, res) => {
  const sessionId = req.cookies.google_session_id;
  const { maxResults = 10, query = '' } = req.query;
  
  if (!sessionId || !tokenStore.has(sessionId)) {
    return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
  }
  
  try {
    const tokens = tokenStore.get(sessionId);
    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials(tokens);
    
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
    
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
  const sessionId = req.cookies.google_session_id;
  const { emailId } = req.params;
  
  if (!sessionId || !tokenStore.has(sessionId)) {
    return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
  }
  
  try {
    const tokens = tokenStore.get(sessionId);
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
  const sessionId = req.cookies.google_session_id;
  const { messageIds } = req.body;
  
  if (!sessionId || !tokenStore.has(sessionId)) {
    return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
  }
  
  if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
    return res.status(400).json({ success: false, error: 'No message IDs provided' });
  }
  
  try {
    const tokens = tokenStore.get(sessionId);
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
  const sessionId = req.cookies.google_session_id;
  
  if (!sessionId || !tokenStore.has(sessionId)) {
    return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
  }
  
  try {
    const tokens = tokenStore.get(sessionId);
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
  const sessionId = req.cookies.google_session_id;
  const { maxResults = 10, query = '' } = req.query;
  
  if (!sessionId || !tokenStore.has(sessionId)) {
    return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
  }
  
  try {
    const tokens = tokenStore.get(sessionId);
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
  const sessionId = req.cookies.google_session_id;
  
  if (!sessionId || !tokenStore.has(sessionId)) {
    return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
  }
  
  try {
    const tokens = tokenStore.get(sessionId);
    
    if (!tokens.refresh_token) {
      return res.status(400).json({ success: false, error: 'No refresh token available' });
    }
    
    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials(tokens);
    
    const { credentials } = await oAuth2Client.refreshAccessToken();
    
    // Update stored tokens
    tokenStore.set(sessionId, credentials);
    
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

module.exports = { router, tokenStore };