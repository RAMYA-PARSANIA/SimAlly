const express = require('express');
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

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

// Create OAuth client
const createOAuthClient = () => {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );
};

// Create a meeting
router.post('/meetings/create', async (req, res) => {
  const userId = req.body.userId;
  const { title, description, startTime, duration, attendees } = req.body;
  
  console.log(`[${Date.now()}] Creating meeting for user ID: ${userId}`);
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  
  if (!startTime) {
    return res.status(400).json({ success: false, error: 'Start time is required' });
  }
  
  try {
    // Check if user has Gmail tokens
    const { data: hasTokens, error: checkError } = await supabase.rpc('has_gmail_tokens', {
      p_user_id: userId
    });
    
    if (checkError || !hasTokens) {
      console.error(`[${Date.now()}] User does not have Gmail tokens:`, checkError || 'No tokens found');
      return res.status(401).json({ 
        success: false, 
        error: 'Not connected to Google. Please connect your Google account first.' 
      });
    }
    
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
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to create meeting' 
    });
  }
});

// Get all meetings
router.get('/meetings', async (req, res) => {
  const userId = req.query.userId;
  
  console.log(`[${Date.now()}] Fetching meetings for user ID: ${userId}`);
  
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
  
  console.log(`[${Date.now()}] Fetching meeting ${meetingId} for user ID: ${userId}`);
  
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
  
  console.log(`[${Date.now()}] Deleting meeting ${meetingId} for user ID: ${userId}`);
  
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
    
    // Check if user has Gmail tokens
    const { data: hasTokens, error: checkError } = await supabase.rpc('has_gmail_tokens', {
      p_user_id: userId
    });
    
    if (checkError || !hasTokens) {
      console.error(`[${Date.now()}] User does not have Gmail tokens:`, checkError || 'No tokens found');
      return res.status(401).json({ 
        success: false, 
        error: 'Not connected to Google. Please connect your Google account first.' 
      });
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

module.exports = router;