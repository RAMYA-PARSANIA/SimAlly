const express = require('express');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const { createClient } = require('@supabase/supabase-js');
const { SpacesServiceClient, ConferenceRecordsServiceClient } = require('@google-apps/meet');
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
  return new OAuth2Client(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );
};

// Helper function to get authenticated Google client
const getAuthenticatedClient = async (userId) => {
  try {
    // Get tokens from Supabase
    const { data: tokensData, error: tokensError } = await supabase.rpc('get_gmail_tokens', {
      p_user_id: userId
    });
    
    if (tokensError || !tokensData.success) {
      throw new Error('User not authenticated with Google');
    }
    
    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials({
      access_token: tokensData.access_token,
      refresh_token: tokensData.refresh_token,
      token_type: tokensData.token_type || 'Bearer',
      expiry_date: new Date(tokensData.expires_at).getTime()
    });
    
    return oAuth2Client;
  } catch (error) {
    throw new Error(`Authentication failed: ${error.message}`);
  }
};

// Create a new Google Meet space
router.post('/spaces/create', async (req, res) => {
  const { userId, title, description, startTime, endTime, participants } = req.body;
  
  console.log(`Creating Google Meet space for user: ${userId}`);
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  
  try {
    // Get authenticated client
    const authClient = await getAuthenticatedClient(userId);
    
    // Create Google Meet space
    const meetClient = new SpacesServiceClient({
      authClient: authClient
    });
    
    const request = {};
    const response = await meetClient.createSpace(request);
    
    console.log('Google Meet space created:', response);
    
    // Extract space details
    const spaceId = response[0].name; // Format: spaces/abc123
    const meetingUri = response[0].meetingUri;
    const meetingCode = response[0].meetingCode;
    
    // Store meeting in Supabase
    const { data: meetingData, error: meetingError } = await supabase
      .from('google_meet_spaces')
      .insert({
        space_id: spaceId,
        meeting_code: meetingCode,
        meeting_uri: meetingUri,
        title: title || 'New Meeting',
        description: description || '',
        created_by: userId,
        start_time: startTime || null,
        end_time: endTime || null,
        status: 'active'
      })
      .select()
      .single();
    
    if (meetingError) {
      console.error('Error storing meeting in Supabase:', meetingError);
      return res.status(500).json({ success: false, error: 'Failed to store meeting data' });
    }
    
    // Add participants if provided
    if (participants && participants.length > 0) {
      const participantRecords = participants.map(email => ({
        space_id: spaceId,
        email: email,
        display_name: email.split('@')[0] // Use email prefix as display name
      }));
      
      await supabase
        .from('google_meet_participants')
        .insert(participantRecords);
    }
    
    res.json({
      success: true,
      meeting: {
        id: meetingData.id,
        spaceId: spaceId,
        meetingCode: meetingCode,
        meetingUri: meetingUri,
        title: meetingData.title,
        description: meetingData.description,
        startTime: meetingData.start_time,
        endTime: meetingData.end_time,
        status: meetingData.status
      }
    });
    
  } catch (error) {
    console.error('Error creating Google Meet space:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to create meeting space' 
    });
  }
});

// Get meeting space details
router.get('/spaces/:spaceId', async (req, res) => {
  const { spaceId } = req.params;
  const { userId } = req.query;
  
  console.log(`Getting Google Meet space details: ${spaceId} for user: ${userId}`);
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  
  try {
    // Get meeting from Supabase first
    const { data: meetingData, error: meetingError } = await supabase
      .from('google_meet_spaces')
      .select(`
        *,
        participants:google_meet_participants(*),
        recordings:google_meet_recordings(*)
      `)
      .eq('space_id', spaceId)
      .single();
    
    if (meetingError) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }
    
    // Get authenticated client
    const authClient = await getAuthenticatedClient(userId);
    
    // Get space details from Google Meet API
    const meetClient = new SpacesServiceClient({
      authClient: authClient
    });
    
    const request = { name: spaceId };
    const response = await meetClient.getSpace(request);
    
    console.log('Google Meet space details:', response);
    
    res.json({
      success: true,
      meeting: {
        ...meetingData,
        googleMeetData: response[0]
      }
    });
    
  } catch (error) {
    console.error('Error getting Google Meet space:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get meeting space details' 
    });
  }
});

// List all meetings for a user
router.get('/spaces', async (req, res) => {
  const { userId } = req.query;
  
  console.log(`Listing Google Meet spaces for user: ${userId}`);
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  
  try {
    // Get meetings from Supabase
    const { data: meetings, error: meetingsError } = await supabase
      .from('google_meet_spaces')
      .select(`
        *,
        participants:google_meet_participants(*),
        recordings:google_meet_recordings(*)
      `)
      .or(`created_by.eq.${userId},participants.user_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    
    if (meetingsError) {
      console.error('Error fetching meetings from Supabase:', meetingsError);
      return res.status(500).json({ success: false, error: 'Failed to fetch meetings' });
    }
    
    res.json({
      success: true,
      meetings: meetings || []
    });
    
  } catch (error) {
    console.error('Error listing Google Meet spaces:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to list meetings' 
    });
  }
});

// End an active conference
router.post('/spaces/:spaceId/end', async (req, res) => {
  const { spaceId } = req.params;
  const { userId } = req.body;
  
  console.log(`Ending Google Meet conference: ${spaceId} by user: ${userId}`);
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  
  try {
    // Check if user has permission to end this meeting
    const { data: meetingData, error: meetingError } = await supabase
      .from('google_meet_spaces')
      .select('*')
      .eq('space_id', spaceId)
      .eq('created_by', userId)
      .single();
    
    if (meetingError) {
      return res.status(403).json({ success: false, error: 'Permission denied or meeting not found' });
    }
    
    // Get authenticated client
    const authClient = await getAuthenticatedClient(userId);
    
    // End the conference
    const meetClient = new SpacesServiceClient({
      authClient: authClient
    });
    
    const request = { name: spaceId };
    await meetClient.endActiveConference(request);
    
    // Update meeting status in Supabase
    await supabase
      .from('google_meet_spaces')
      .update({ status: 'ended' })
      .eq('space_id', spaceId);
    
    console.log('Google Meet conference ended successfully');
    
    res.json({
      success: true,
      message: 'Conference ended successfully'
    });
    
  } catch (error) {
    console.error('Error ending Google Meet conference:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to end conference' 
    });
  }
});

// List conference records
router.get('/conferences', async (req, res) => {
  const { userId } = req.query;
  
  console.log(`Listing conference records for user: ${userId}`);
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  
  try {
    // Get authenticated client
    const authClient = await getAuthenticatedClient(userId);
    
    // List conference records
    const meetClient = new ConferenceRecordsServiceClient({
      authClient: authClient
    });
    
    const request = {};
    const conferences = [];
    
    const iterable = meetClient.listConferenceRecordsAsync(request);
    for await (const response of iterable) {
      conferences.push(response);
    }
    
    console.log(`Found ${conferences.length} conference records`);
    
    res.json({
      success: true,
      conferences: conferences
    });
    
  } catch (error) {
    console.error('Error listing conference records:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to list conference records' 
    });
  }
});

// Get recordings for a conference
router.get('/conferences/:conferenceId/recordings', async (req, res) => {
  const { conferenceId } = req.params;
  const { userId } = req.query;
  
  console.log(`Getting recordings for conference: ${conferenceId} for user: ${userId}`);
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  
  try {
    // Get authenticated client
    const authClient = await getAuthenticatedClient(userId);
    
    // List recordings
    const meetClient = new ConferenceRecordsServiceClient({
      authClient: authClient
    });
    
    const request = { parent: `conferenceRecords/${conferenceId}` };
    const recordings = [];
    
    const iterable = meetClient.listRecordingsAsync(request);
    for await (const response of iterable) {
      recordings.push(response);
    }
    
    console.log(`Found ${recordings.length} recordings`);
    
    res.json({
      success: true,
      recordings: recordings
    });
    
  } catch (error) {
    console.error('Error getting conference recordings:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get recordings' 
    });
  }
});

// Get transcripts for a conference
router.get('/conferences/:conferenceId/transcripts', async (req, res) => {
  const { conferenceId } = req.params;
  const { userId } = req.query;
  
  console.log(`Getting transcripts for conference: ${conferenceId} for user: ${userId}`);
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  
  try {
    // Get authenticated client
    const authClient = await getAuthenticatedClient(userId);
    
    // List transcripts
    const meetClient = new ConferenceRecordsServiceClient({
      authClient: authClient
    });
    
    const request = { parent: `conferenceRecords/${conferenceId}` };
    const transcripts = [];
    
    const iterable = meetClient.listTranscriptsAsync(request);
    for await (const response of iterable) {
      transcripts.push(response);
    }
    
    console.log(`Found ${transcripts.length} transcripts`);
    
    res.json({
      success: true,
      transcripts: transcripts
    });
    
  } catch (error) {
    console.error('Error getting conference transcripts:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get transcripts' 
    });
  }
});

// Delete a meeting space
router.delete('/spaces/:spaceId', async (req, res) => {
  const { spaceId } = req.params;
  const { userId } = req.body;
  
  console.log(`Deleting Google Meet space: ${spaceId} by user: ${userId}`);
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  
  try {
    // Check if user has permission to delete this meeting
    const { data: meetingData, error: meetingError } = await supabase
      .from('google_meet_spaces')
      .select('*')
      .eq('space_id', spaceId)
      .eq('created_by', userId)
      .single();
    
    if (meetingError) {
      return res.status(403).json({ success: false, error: 'Permission denied or meeting not found' });
    }
    
    // Update meeting status to cancelled in Supabase
    await supabase
      .from('google_meet_spaces')
      .update({ status: 'cancelled' })
      .eq('space_id', spaceId);
    
    console.log('Google Meet space marked as cancelled');
    
    res.json({
      success: true,
      message: 'Meeting cancelled successfully'
    });
    
  } catch (error) {
    console.error('Error deleting Google Meet space:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to cancel meeting' 
    });
  }
});

module.exports = { router };