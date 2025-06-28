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
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:8000/api/google/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Scopes for Google APIs
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events'
];

// Store tokens temporarily (in production, use a database)
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
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: 'lax'
    });
    
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
  
  if (!code) {
    return res.redirect(`${FRONTEND_URL}/dashboard?google_error=true`);
  }
  
  try {
    const oAuth2Client = createOAuthClient();
    const { tokens } = await oAuth2Client.getToken(code);
    
    // Store tokens with session ID
    tokenStore.set(state, tokens);
    
    // Redirect back to frontend
    res.redirect(`${FRONTEND_URL}/dashboard?google_connected=true`);
  } catch (error) {
    console.error('Error getting tokens:', error);
    res.redirect(`${FRONTEND_URL}/dashboard?google_error=true`);
  }
});

// Check connection status
router.get('/status', (req, res) => {
  const sessionId = req.cookies.google_session_id;
  
  if (!sessionId || !tokenStore.has(sessionId)) {
    return res.json({ success: true, connected: false });
  }
  
  const tokens = tokenStore.get(sessionId);
  
  // Check if token is expired
  const isExpired = tokens.expiry_date && tokens.expiry_date < Date.now();
  
  if (isExpired && !tokens.refresh_token) {
    tokenStore.delete(sessionId);
    return res.json({ success: true, connected: false });
  }
  
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

module.exports = router;