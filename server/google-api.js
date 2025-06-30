const express = require('express');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const cors = require('cors');
const dotenv = require('dotenv');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

const router = express.Router();

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || 'http://localhost:8000/api/google/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Scopes for Google APIs - expanded for more access
const SCOPES = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/presentations'
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
router.get('/auth-url', async (req, res) => {
  try {
    const oAuth2Client = createOAuthClient();
    
    // Use userId as the session identifier if provided
    const userId = req.query.userId || null;
    const sessionId = userId || generateSessionId();
    
    //console.log(`[${Date.now()}] Generated session ID: ${sessionId} (userId: ${userId || 'none'})`);
    
    // Store session ID in state parameter for OAuth flow
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
  //console.log(`[${Date.now()}] Google OAuth callback triggered with code: ${code ? 'present' : 'missing'}, state: ${state || 'missing'}`);

  if (!code) {
    console.error(`[${Date.now()}] No code received in callback`);
    return res.redirect(`${FRONTEND_URL}/dashboard?google_error=true`);
  }

  try {
    const oAuth2Client = createOAuthClient();
    //console.log(`[${Date.now()}] OAuth client created successfully`);

    // Get tokens with error handling
    let tokens;
    try {
      //console.log(`[${Date.now()}] Attempting to exchange code for tokens`);
      const tokenResponse = await oAuth2Client.getToken(code);
      tokens = tokenResponse.tokens;
      //console.log(`[${Date.now()}] Tokens received:`, tokens);
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
    const userId = state;
    
    if (!userId) {
      console.error(`[${Date.now()}] No user ID found in state parameter`);
      return res.redirect(`${FRONTEND_URL}/dashboard?google_error=true`);
    }

    // Store tokens in Supabase with encryption
    try {
      // Generate a unique session ID
      const sessionId = generateSessionId();
      
      // Store tokens in Supabase
      const { data, error } = await supabase.rpc('store_gmail_tokens', {
        p_user_id: userId,
        p_access_token: tokens.access_token,
        p_refresh_token: tokens.refresh_token || null,
        p_token_type: tokens.token_type || 'Bearer',
        p_expires_at: new Date(tokens.expiry_date).toISOString(),
        p_scope: tokens.scope || '',
        p_session_id: sessionId
      });
      
      if (error) {
        console.error(`[${Date.now()}] Error storing tokens in Supabase:`, error);
        return res.redirect(`${FRONTEND_URL}/dashboard?google_error=true`);
      }
      
      //console.log(`[${Date.now()}] Tokens stored successfully in Supabase for user ${userId}`);
    } catch (storageError) {
      console.error(`[${Date.now()}] Error storing tokens:`, storageError);
      return res.redirect(`${FRONTEND_URL}/dashboard?google_error=true`);
    }

    // Also store in memory for immediate use
    tokenStore.set(userId, tokens);

    // Redirect back to frontend
    //console.log(`[${Date.now()}] Redirecting to frontend with success`);
    res.redirect(`${FRONTEND_URL}/dashboard?google_connected=true`);
  } catch (error) {
    console.error(`[${Date.now()}] Error in callback:`, error);
    res.redirect(`${FRONTEND_URL}/dashboard?google_error=true`);
  }
});

// Check connection status
router.get('/status', async (req, res) => {
  // Try to get user ID from query
  const userId = req.query.userId;
  
  //console.log(`[${Date.now()}] Checking Google connection status for user ID: ${userId}`);

  if (!userId) {
    //console.log(`[${Date.now()}] No user ID provided`);
    return res.json({ success: true, connected: false });
  }

  try {
    // Check if tokens exist in Supabase
    const { data, error } = await supabase.rpc('has_gmail_tokens', {
      p_user_id: userId
    });
    
    if (error) {
      console.error(`[${Date.now()}] Error checking token existence:`, error);
      return res.json({ success: true, connected: false });
    }
    
    const connected = data || false;
    
    if (connected) {
      // Get tokens from Supabase
      const { data: tokensData, error: tokensError } = await supabase.rpc('get_gmail_tokens', {
        p_user_id: userId
      });
      
      if (tokensError || !tokensData.success) {
        console.error(`[${Date.now()}] Error retrieving tokens:`, tokensError || tokensData.error);
        return res.json({ success: true, connected: false });
      }
      
      // Check if token is expired
      const expiresAt = new Date(tokensData.expires_at);
      const isExpired = expiresAt < new Date();
      //console.log(`[${Date.now()}] Token expiry status for user ID: ${userId}: ${isExpired}`);
      
      if (isExpired && !tokensData.refresh_token) {
        //console.log(`[${Date.now()}] Token expired and no refresh token available for user ID: ${userId}`);
        
        // Revoke expired tokens
        await supabase.rpc('revoke_gmail_tokens', {
          p_user_id: userId
        });
        
        return res.json({ success: true, connected: false });
      }
      
      // If we have a refresh token and the token is expired, we should refresh it
      // This would be implemented in a production environment
      
      //console.log(`[${Date.now()}] Google connection status: connected for user ID: ${userId}`);
      return res.json({ 
        success: true, 
        connected: true,
        token: tokensData.access_token,
        expiresAt: tokensData.expires_at
      });
    } else {
      //console.log(`[${Date.now()}] No tokens found for user ID: ${userId}`);
      return res.json({ success: true, connected: false });
    }
  } catch (err) {
    console.error(`[${Date.now()}] Error checking Google connection status:`, err);
    return res.json({ success: true, connected: false });
  }
});

// Disconnect Google
router.post('/disconnect', async (req, res) => {
  const userId = req.body.userId;
  
  //console.log(`[${Date.now()}] Disconnecting Google for user ID: ${userId}`);
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  
  try {
    // Revoke tokens in Supabase
    const { data, error } = await supabase.rpc('revoke_gmail_tokens', {
      p_user_id: userId
    });
    
    if (error) {
      console.error(`[${Date.now()}] Error revoking tokens:`, error);
      return res.status(500).json({ success: false, error: 'Failed to disconnect Google account' });
    }
    
    // Also remove from memory cache
    if (tokenStore.has(userId)) {
      tokenStore.delete(userId);
      //console.log(`[${Date.now()}] Deleted tokens from memory for user ID: ${userId}`);
    } else {
      //console.log(`[${Date.now()}] No tokens found in memory for user ID: ${userId}`);
    }
    
    res.json({ success: true, message: 'Google account disconnected' });
  } catch (error) {
    console.error(`[${Date.now()}] Error disconnecting Google:`, error);
    res.status(500).json({ success: false, error: 'Failed to disconnect Google account' });
  }
});

// Gmail API endpoints
router.get('/gmail/messages', async (req, res) => {
  const userId = req.query.userId;
  const { maxResults = 10, query = '' } = req.query;
  
  //console.log(`[${Date.now()}] Fetching Gmail messages for user ID: ${userId}`);
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  
  try {
    // Get tokens from Supabase
    const { data: tokensData, error: tokensError } = await supabase.rpc('get_gmail_tokens', {
      p_user_id: userId
    });
    
    if (tokensError || !tokensData.success) {
      console.error(`[${Date.now()}] Error retrieving tokens:`, tokensError || tokensData.error);
      return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
    }
    
    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials({
      access_token: tokensData.access_token,
      refresh_token: tokensData.refresh_token,
      token_type: tokensData.token_type,
      expiry_date: new Date(tokensData.expires_at).getTime()
    });
    
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
  const userId = req.query.userId;
  const { emailId } = req.params;
  
  //console.log(`[${Date.now()}] Fetching email content for user ID: ${userId}, email ID: ${emailId}`);
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  
  try {
    // Get tokens from Supabase
    const { data: tokensData, error: tokensError } = await supabase.rpc('get_gmail_tokens', {
      p_user_id: userId
    });
    
    if (tokensError || !tokensData.success) {
      console.error(`[${Date.now()}] Error retrieving tokens:`, tokensError || tokensData.error);
      return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
    }
    
    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials({
      access_token: tokensData.access_token,
      refresh_token: tokensData.refresh_token,
      token_type: tokensData.token_type,
      expiry_date: new Date(tokensData.expires_at).getTime()
    });
    
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
  const userId = req.body.userId;
  const { messageIds } = req.body;
  
  //console.log(`[${Date.now()}] Deleting emails for user ID: ${userId}`);
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  
  if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
    return res.status(400).json({ success: false, error: 'No message IDs provided' });
  }
  
  try {
    // Get tokens from Supabase
    const { data: tokensData, error: tokensError } = await supabase.rpc('get_gmail_tokens', {
      p_user_id: userId
    });
    
    if (tokensError || !tokensData.success) {
      console.error(`[${Date.now()}] Error retrieving tokens:`, tokensError || tokensData.error);
      return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
    }
    
    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials({
      access_token: tokensData.access_token,
      refresh_token: tokensData.refresh_token,
      token_type: tokensData.token_type,
      expiry_date: new Date(tokensData.expires_at).getTime()
    });
    
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

// Meeting API endpoints
// Create a meeting
router.post('/meetings/create', async (req, res) => {
  const userId = req.body.userId;
  const { title, description, startTime, duration, attendees } = req.body;
  
  //console.log(`[${Date.now()}] Creating meeting for user ID: ${userId}`);
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  
  if (!startTime) {
    return res.status(400).json({ success: false, error: 'Start time is required' });
  }
  
  try {
    // Get tokens from Supabase
    const { data: tokensData, error: tokensError } = await supabase.rpc('get_gmail_tokens', {
      p_user_id: userId
    });
    
    if (tokensError || !tokensData.success) {
      console.error(`[${Date.now()}] Error retrieving tokens:`, tokensError || tokensData.error);
      return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
    }
    
    // Get user profile to get email
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();
    
    if (!userProfile) {
      return res.status(404).json({ success: false, error: 'User profile not found' });
    }
    
    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials({
      access_token: tokensData.access_token,
      refresh_token: tokensData.refresh_token,
      token_type: tokensData.token_type,
      expiry_date: new Date(tokensData.expires_at).getTime()
    });
    
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    
    // Calculate end time based on duration (in minutes)
    const startDateTime = new Date(startTime);
    const endDateTime = new Date(startDateTime.getTime() + (duration || 60) * 60000);
    
    // Create meeting with Google Meet link
    const event = {
      summary: title || 'New Meeting',
      description: description || '',
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'UTC'
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'UTC'
      },
      conferenceData: {
        createRequest: {
          requestId: crypto.randomBytes(16).toString('hex'),
          conferenceSolutionKey: {
            type: 'hangoutsMeet'
          }
        }
      },
      attendees: attendees ? attendees.map(email => ({ email })) : []
    };
    
    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      conferenceDataVersion: 1,
      sendUpdates: 'all'
    });
    
    const createdEvent = response.data;
    
    // Extract Google Meet link
    const meetLink = createdEvent.hangoutLink || '';
    
    // Store meeting in Supabase
    const { data: meetingData, error: meetingError } = await supabase
      .from('meetings')
      .insert({
        title: createdEvent.summary,
        description: createdEvent.description,
        start_time: createdEvent.start.dateTime,
        end_time: createdEvent.end.dateTime,
        user_email: userProfile.username,
        google_event_id: createdEvent.id,
        google_meet_link: meetLink,
        participants: attendees || []
      })
      .select()
      .single();
    
    if (meetingError) {
      console.error(`[${Date.now()}] Error storing meeting in Supabase:`, meetingError);
      // Continue anyway since the Google Calendar event was created
    }
    
    res.json({
      success: true,
      meeting: {
        id: meetingData?.id || createdEvent.id,
        meetingId: createdEvent.id,
        url: meetLink,
        title: createdEvent.summary,
        description: createdEvent.description,
        startTime: createdEvent.start.dateTime,
        endTime: createdEvent.end.dateTime,
        status: createdEvent.status,
        attendees: createdEvent.attendees || []
      }
    });
  } catch (error) {
    console.error('Error creating meeting:', error);
    res.status(500).json({ success: false, error: 'Failed to create meeting' });
  }
});

// Get all meetings
router.get('/meetings', async (req, res) => {
  const userId = req.query.userId;
  
  //console.log(`[${Date.now()}] Fetching meetings for user ID: ${userId}`);
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  
  try {
    // Get user profile to get email
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();
    
    if (!userProfile) {
      return res.status(404).json({ success: false, error: 'User profile not found' });
    }
    
    // Get meetings from Supabase
    const { data: meetings, error: meetingsError } = await supabase
      .from('meetings')
      .select('*')
      .eq('user_email', userProfile.username)
      .order('start_time', { ascending: false });
    
    if (meetingsError) {
      console.error(`[${Date.now()}] Error fetching meetings from Supabase:`, meetingsError);
      return res.status(500).json({ success: false, error: 'Failed to fetch meetings' });
    }
    
    // Format meetings for frontend
    const formattedMeetings = meetings.map(meeting => ({
      id: meeting.id,
      meetingId: meeting.google_event_id,
      url: meeting.google_meet_link,
      title: meeting.title,
      description: meeting.description,
      startTime: meeting.start_time,
      endTime: meeting.end_time,
      status: 'confirmed',
      attendees: meeting.participants?.map(email => ({ email })) || []
    }));
    
    res.json({
      success: true,
      meetings: formattedMeetings
    });
  } catch (error) {
    console.error('Error fetching meetings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch meetings' });
  }
});

// Get a specific meeting
router.get('/meetings/:meetingId', async (req, res) => {
  const userId = req.query.userId;
  const { meetingId } = req.params;
  
  //console.log(`[${Date.now()}] Fetching meeting ${meetingId} for user ID: ${userId}`);
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  
  try {
    // Get meeting from Supabase
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .single();
    
    if (meetingError) {
      console.error(`[${Date.now()}] Error fetching meeting from Supabase:`, meetingError);
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }
    
    // Format meeting for frontend
    const formattedMeeting = {
      id: meeting.id,
      meetingId: meeting.google_event_id,
      url: meeting.google_meet_link,
      title: meeting.title,
      description: meeting.description,
      startTime: meeting.start_time,
      endTime: meeting.end_time,
      status: 'confirmed',
      attendees: meeting.participants?.map(email => ({ email })) || []
    };
    
    res.json({
      success: true,
      meeting: formattedMeeting
    });
  } catch (error) {
    console.error('Error fetching meeting:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch meeting' });
  }
});

// Delete a meeting
router.delete('/meetings/:meetingId', async (req, res) => {
  const userId = req.query.userId;
  const { meetingId } = req.params;
  
  //console.log(`[${Date.now()}] Deleting meeting ${meetingId} for user ID: ${userId}`);
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  
  try {
    // Get meeting from Supabase
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('google_event_id')
      .eq('id', meetingId)
      .single();
    
    if (meetingError) {
      console.error(`[${Date.now()}] Error fetching meeting from Supabase:`, meetingError);
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }
    
    // Get tokens from Supabase
    const { data: tokensData, error: tokensError } = await supabase.rpc('get_gmail_tokens', {
      p_user_id: userId
    });
    
    if (tokensError || !tokensData.success) {
      console.error(`[${Date.now()}] Error retrieving tokens:`, tokensError || tokensData.error);
      return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
    }
    
    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials({
      access_token: tokensData.access_token,
      refresh_token: tokensData.refresh_token,
      token_type: tokensData.token_type,
      expiry_date: new Date(tokensData.expires_at).getTime()
    });
    
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    
    // Delete event from Google Calendar
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: meeting.google_event_id,
      sendUpdates: 'all'
    });
    
    // Delete meeting from Supabase
    const { error: deleteError } = await supabase
      .from('meetings')
      .delete()
      .eq('id', meetingId);
    
    if (deleteError) {
      console.error(`[${Date.now()}] Error deleting meeting from Supabase:`, deleteError);
      // Continue anyway since the Google Calendar event was deleted
    }
    
    res.json({
      success: true,
      message: 'Meeting deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting meeting:', error);
    res.status(500).json({ success: false, error: 'Failed to delete meeting' });
  }
});

module.exports = { router, tokenStore };