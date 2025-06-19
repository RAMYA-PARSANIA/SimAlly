const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();

const app = express();
const PORT = process.env.AI_ASSISTANT_PORT || 8001;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Gmail OAuth2 setup
const oauth2Client = new OAuth2Client(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

// Store user sessions (in production, use Redis or database)
const userSessions = new Map();

// Store active meetings
const activeMeetings = new Map();

// =============================================================================
// INTENT DETECTION & ROUTING
// =============================================================================

// Advanced intent detection with Gemini AI
app.post('/api/chat/detect-intent', async (req, res) => {
  try {
    const { message, userId } = req.body;
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    const intentPrompt = `
      You are an intelligent intent classifier for an AI assistant that can handle:
      1. Gmail operations (send, read, delete, unsubscribe, compose help)
      2. Meeting assistance (start meeting, join meeting, transcribe, take notes, summarize)
      3. General chat/questions
      
      Analyze this user message and determine the intent, extract parameters, and provide a helpful response.
      
      User message: "${message}"
      
      Respond in this exact JSON format:
      {
        "intent": "one of: gmail_send, gmail_read, gmail_delete, gmail_unsubscribe, gmail_compose_help, meeting_start, meeting_join, meeting_transcribe, meeting_notes, meeting_summary, chat",
        "confidence": 0.0-1.0,
        "parameters": {
          // Extract relevant parameters based on intent
          // For gmail_send: {"to": "email", "subject": "subject", "body": "body"}
          // For gmail_read: {"count": number, "query": "search terms"}
          // For meeting_start: {"title": "meeting title", "participants": ["emails"]}
          // For meeting_join: {"meetingId": "meeting id or code"}
          // For chat: {}
        },
        "response": "A helpful response to the user explaining what you'll do or asking for clarification"
      }
      
      Examples:
      - "Send an email to john@example.com about the meeting" → gmail_send intent
      - "Start a meeting with my team" → meeting_start intent
      - "Join meeting room 123" → meeting_join intent
      - "Take notes during this meeting" → meeting_notes intent
      - "What's the weather today?" → chat intent
      
      Be intelligent about parameter extraction and provide clear, helpful responses.
    `;
    
    const result = await model.generateContent(intentPrompt);
    const response = result.response.text();
    
    try {
      const intentData = JSON.parse(response);
      
      // If it's a chat intent, get a proper chat response
      if (intentData.intent === 'chat') {
        const chatResponse = await getChatResponse(message, userId);
        intentData.response = chatResponse;
      }
      
      res.json(intentData);
    } catch (parseError) {
      console.error('Failed to parse intent response:', parseError);
      // Fallback to chat
      const chatResponse = await getChatResponse(message, userId);
      res.json({
        intent: 'chat',
        confidence: 1.0,
        parameters: {},
        response: chatResponse
      });
    }
  } catch (error) {
    console.error('Intent detection error:', error);
    res.status(500).json({
      intent: 'chat',
      confidence: 0.5,
      parameters: {},
      response: 'I apologize, but I encountered an error. Please try again.'
    });
  }
});

// Get chat response for general questions
const getChatResponse = async (message, userId) => {
  try {
    const userSession = userSessions.get(userId) || {};
    const conversationHistory = userSession.chatHistory || [];
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    // Build conversation context
    let conversationContext = '';
    if (conversationHistory.length > 0) {
      conversationContext = conversationHistory
        .slice(-10) // Keep last 10 messages for context
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');
    }
    
    const prompt = `
      You are SimAlly, a professional AI assistant. You are helpful, knowledgeable, and maintain a professional yet friendly tone.
      You can help with Gmail management, video meetings, and general questions.
      
      ${conversationContext ? `Previous conversation:\n${conversationContext}\n\n` : ''}
      
      User: ${message}
      
      Provide a helpful, accurate, and professional response. Keep it concise but informative.
    `;
    
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    // Store conversation in user session
    if (!userSession.chatHistory) {
      userSession.chatHistory = [];
    }
    
    userSession.chatHistory.push(
      { role: 'user', content: message, timestamp: new Date() },
      { role: 'assistant', content: response, timestamp: new Date() }
    );
    
    // Keep only last 50 messages
    if (userSession.chatHistory.length > 50) {
      userSession.chatHistory = userSession.chatHistory.slice(-50);
    }
    
    userSessions.set(userId, userSession);
    
    return response;
  } catch (error) {
    console.error('Chat response error:', error);
    return 'I apologize, but I encountered an error processing your request. Please try again.';
  }
};

// =============================================================================
// GMAIL FUNCTIONALITY
// =============================================================================

// Gmail OAuth - Get authorization URL
app.get('/api/gmail/auth-url', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify'
    ],
  });
  
  res.json({ authUrl });
});

// Gmail OAuth - Handle callback
app.post('/api/gmail/auth-callback', async (req, res) => {
  try {
    const { code, userId } = req.body;
    const { tokens } = await oauth2Client.getAccessToken(code);
    
    // Store tokens for user
    userSessions.set(userId, {
      ...userSessions.get(userId),
      gmailTokens: tokens
    });
    
    res.json({ success: true, message: 'Gmail connected successfully' });
  } catch (error) {
    console.error('Gmail auth error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send Email
app.post('/api/gmail/send', async (req, res) => {
  try {
    const { userId, to, subject, body, isHtml = false } = req.body;
    const userSession = userSessions.get(userId);
    
    if (!userSession?.gmailTokens) {
      return res.status(401).json({ success: false, error: 'Gmail not connected' });
    }
    
    oauth2Client.setCredentials(userSession.gmailTokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const emailContent = [
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset=utf-8`,
      '',
      body
    ].join('\n');
    
    const encodedEmail = Buffer.from(emailContent).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
    
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail
      }
    });
    
    res.json({ success: true, messageId: result.data.id });
  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Emails
app.get('/api/gmail/messages', async (req, res) => {
  try {
    const { userId } = req.query;
    const { maxResults = 10, query = '' } = req.query;
    const userSession = userSessions.get(userId);
    
    if (!userSession?.gmailTokens) {
      return res.status(401).json({ success: false, error: 'Gmail not connected' });
    }
    
    oauth2Client.setCredentials(userSession.gmailTokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: parseInt(maxResults),
      q: query
    });
    
    const messages = [];
    if (response.data.messages) {
      for (const message of response.data.messages.slice(0, 5)) { // Limit for performance
        const messageData = await gmail.users.messages.get({
          userId: 'me',
          id: message.id
        });
        
        const headers = messageData.data.payload.headers;
        const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
        const date = headers.find(h => h.name === 'Date')?.value || '';
        
        messages.push({
          id: message.id,
          subject,
          from,
          date,
          snippet: messageData.data.snippet
        });
      }
    }
    
    res.json({ success: true, messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete Email
app.delete('/api/gmail/messages/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.query;
    const userSession = userSessions.get(userId);
    
    if (!userSession?.gmailTokens) {
      return res.status(401).json({ success: false, error: 'Gmail not connected' });
    }
    
    oauth2Client.setCredentials(userSession.gmailTokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    await gmail.users.messages.delete({
      userId: 'me',
      id: messageId
    });
    
    res.json({ success: true, message: 'Email deleted successfully' });
  } catch (error) {
    console.error('Delete email error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Unsubscribe from newsletters (AI-powered detection)
app.post('/api/gmail/unsubscribe', async (req, res) => {
  try {
    const { userId, messageId } = req.body;
    const userSession = userSessions.get(userId);
    
    if (!userSession?.gmailTokens) {
      return res.status(401).json({ success: false, error: 'Gmail not connected' });
    }
    
    oauth2Client.setCredentials(userSession.gmailTokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Get the email content
    const messageData = await gmail.users.messages.get({
      userId: 'me',
      id: messageId
    });
    
    // Extract email body (simplified)
    let emailBody = '';
    if (messageData.data.payload.body.data) {
      emailBody = Buffer.from(messageData.data.payload.body.data, 'base64').toString();
    }
    
    // Use Gemini to find unsubscribe links
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const prompt = `
      Analyze this email content and find any unsubscribe links or instructions:
      
      ${emailBody}
      
      Return only the unsubscribe URL if found, or "NO_UNSUBSCRIBE_LINK" if none exists.
    `;
    
    const result = await model.generateContent(prompt);
    const unsubscribeInfo = result.response.text().trim();
    
    res.json({ 
      success: true, 
      unsubscribeInfo: unsubscribeInfo === 'NO_UNSUBSCRIBE_LINK' ? null : unsubscribeInfo 
    });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// AI Email Writing Assistant
app.post('/api/gmail/compose-help', async (req, res) => {
  try {
    const { prompt, context = '', tone = 'professional' } = req.body;
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const aiPrompt = `
      You are a professional email writing assistant. Help compose an email based on this request:
      
      Request: ${prompt}
      Context: ${context}
      Tone: ${tone}
      
      Provide a well-structured email with:
      1. Appropriate subject line
      2. Professional greeting
      3. Clear, concise body
      4. Appropriate closing
      
      Format your response as JSON with "subject" and "body" fields.
    `;
    
    const result = await model.generateContent(aiPrompt);
    const response = result.response.text();
    
    try {
      const emailData = JSON.parse(response);
      res.json({ success: true, ...emailData });
    } catch {
      // Fallback if JSON parsing fails
      res.json({ 
        success: true, 
        subject: 'Email Subject',
        body: response 
      });
    }
  } catch (error) {
    console.error('Email compose help error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// MEETING FUNCTIONALITY
// =============================================================================

// Create a new meeting
app.post('/api/meetings/create', async (req, res) => {
  try {
    const { userId, title, participants = [] } = req.body;
    const meetingId = `meeting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const meeting = {
      id: meetingId,
      title: title || 'Untitled Meeting',
      host: userId,
      participants: [userId, ...participants],
      createdAt: new Date(),
      isActive: true,
      transcript: [],
      notes: [],
      summary: null,
      aiEnabled: false
    };
    
    activeMeetings.set(meetingId, meeting);
    
    res.json({ 
      success: true, 
      meetingId,
      meeting: {
        id: meetingId,
        title: meeting.title,
        host: meeting.host,
        participants: meeting.participants,
        createdAt: meeting.createdAt
      }
    });
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Join a meeting
app.post('/api/meetings/join', async (req, res) => {
  try {
    const { meetingId, userId } = req.body;
    const meeting = activeMeetings.get(meetingId);
    
    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }
    
    if (!meeting.participants.includes(userId)) {
      meeting.participants.push(userId);
    }
    
    res.json({ 
      success: true, 
      meeting: {
        id: meeting.id,
        title: meeting.title,
        host: meeting.host,
        participants: meeting.participants,
        aiEnabled: meeting.aiEnabled
      }
    });
  } catch (error) {
    console.error('Join meeting error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Enable/Disable AI Assistant for meeting
app.post('/api/meetings/:meetingId/ai-toggle', async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { enabled, userId } = req.body;
    const meeting = activeMeetings.get(meetingId);
    
    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }
    
    // Only host can toggle AI
    if (meeting.host !== userId) {
      return res.status(403).json({ success: false, error: 'Only host can toggle AI assistant' });
    }
    
    meeting.aiEnabled = enabled;
    
    res.json({ 
      success: true, 
      aiEnabled: meeting.aiEnabled,
      message: `AI assistant ${enabled ? 'enabled' : 'disabled'}` 
    });
  } catch (error) {
    console.error('AI toggle error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add transcript entry
app.post('/api/meetings/:meetingId/transcript', async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { text, speaker, userId } = req.body;
    const meeting = activeMeetings.get(meetingId);
    
    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }
    
    if (!meeting.aiEnabled) {
      return res.status(400).json({ success: false, error: 'AI assistant not enabled' });
    }
    
    const transcriptEntry = {
      id: Date.now(),
      text,
      speaker: speaker || 'Unknown',
      timestamp: new Date(),
      userId
    };
    
    meeting.transcript.push(transcriptEntry);
    
    // Auto-generate notes if significant content
    if (text.length > 50) {
      await generateAutoNotes(meetingId, text, speaker);
    }
    
    res.json({ success: true, transcriptEntry });
  } catch (error) {
    console.error('Add transcript error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate automatic notes
const generateAutoNotes = async (meetingId, text, speaker) => {
  try {
    const meeting = activeMeetings.get(meetingId);
    if (!meeting) return;
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const prompt = `
      Analyze this meeting transcript segment and extract key points, action items, or important information:
      
      Speaker: ${speaker}
      Text: "${text}"
      
      If this contains important information, action items, decisions, or key points, format them as bullet points.
      If it's just casual conversation, return "NO_NOTES".
      
      Focus on:
      - Action items
      - Decisions made
      - Important announcements
      - Key discussion points
      - Deadlines or dates mentioned
    `;
    
    const result = await model.generateContent(prompt);
    const notes = result.response.text().trim();
    
    if (notes !== 'NO_NOTES') {
      meeting.notes.push({
        id: Date.now(),
        content: notes,
        timestamp: new Date(),
        source: 'auto',
        relatedTranscript: text
      });
    }
  } catch (error) {
    console.error('Auto notes generation error:', error);
  }
};

// Get meeting transcript
app.get('/api/meetings/:meetingId/transcript', async (req, res) => {
  try {
    const { meetingId } = req.params;
    const meeting = activeMeetings.get(meetingId);
    
    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }
    
    res.json({ 
      success: true, 
      transcript: meeting.transcript,
      notes: meeting.notes 
    });
  } catch (error) {
    console.error('Get transcript error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate meeting summary
app.post('/api/meetings/:meetingId/summary', async (req, res) => {
  try {
    const { meetingId } = req.params;
    const meeting = activeMeetings.get(meetingId);
    
    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    // Combine transcript for summary
    const fullTranscript = meeting.transcript
      .map(entry => `${entry.speaker}: ${entry.text}`)
      .join('\n');
    
    const prompt = `
      Generate a comprehensive meeting summary based on this transcript:
      
      Meeting: ${meeting.title}
      Duration: ${Math.round((new Date() - meeting.createdAt) / 60000)} minutes
      Participants: ${meeting.participants.length}
      
      Transcript:
      ${fullTranscript}
      
      Provide a structured summary with:
      1. Meeting Overview
      2. Key Discussion Points
      3. Decisions Made
      4. Action Items (with responsible parties if mentioned)
      5. Next Steps
      
      Format as JSON with these fields: overview, keyPoints, decisions, actionItems, nextSteps
    `;
    
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    try {
      const summary = JSON.parse(response);
      meeting.summary = {
        ...summary,
        generatedAt: new Date()
      };
      
      res.json({ success: true, summary: meeting.summary });
    } catch {
      // Fallback summary
      const fallbackSummary = {
        overview: 'Meeting completed successfully',
        keyPoints: ['Discussion held with team members'],
        decisions: ['Various topics were covered'],
        actionItems: ['Follow up on key points discussed'],
        nextSteps: ['Schedule follow-up meeting if needed'],
        generatedAt: new Date()
      };
      
      meeting.summary = fallbackSummary;
      res.json({ success: true, summary: fallbackSummary });
    }
  } catch (error) {
    console.error('Generate summary error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// End meeting
app.post('/api/meetings/:meetingId/end', async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { userId } = req.body;
    const meeting = activeMeetings.get(meetingId);
    
    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }
    
    // Only host can end meeting
    if (meeting.host !== userId) {
      return res.status(403).json({ success: false, error: 'Only host can end meeting' });
    }
    
    meeting.isActive = false;
    meeting.endedAt = new Date();
    
    // Generate final summary if AI was enabled
    if (meeting.aiEnabled && meeting.transcript.length > 0) {
      // Summary will be generated on demand
    }
    
    res.json({ 
      success: true, 
      message: 'Meeting ended successfully',
      summary: meeting.summary 
    });
  } catch (error) {
    console.error('End meeting error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get active meetings for user
app.get('/api/meetings/active', async (req, res) => {
  try {
    const { userId } = req.query;
    const userMeetings = [];
    
    for (const [id, meeting] of activeMeetings.entries()) {
      if (meeting.participants.includes(userId) && meeting.isActive) {
        userMeetings.push({
          id: meeting.id,
          title: meeting.title,
          host: meeting.host,
          participants: meeting.participants.length,
          createdAt: meeting.createdAt,
          aiEnabled: meeting.aiEnabled
        });
      }
    }
    
    res.json({ success: true, meetings: userMeetings });
  } catch (error) {
    console.error('Get active meetings error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// GENERIC CHATBOT
// =============================================================================

// Chat with AI (legacy endpoint for direct chat)
app.post('/api/chat', async (req, res) => {
  try {
    const { message, userId, conversationHistory = [] } = req.body;
    const response = await getChatResponse(message, userId);
    res.json({ success: true, response });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get chat history
app.get('/api/chat/history', (req, res) => {
  try {
    const { userId } = req.query;
    const userSession = userSessions.get(userId);
    
    res.json({ 
      success: true, 
      history: userSession?.chatHistory || [] 
    });
  } catch (error) {
    console.error('Get chat history error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear chat history
app.delete('/api/chat/history', (req, res) => {
  try {
    const { userId } = req.body;
    const userSession = userSessions.get(userId);
    
    if (userSession) {
      userSession.chatHistory = [];
      userSessions.set(userId, userSession);
    }
    
    res.json({ success: true, message: 'Chat history cleared' });
  } catch (error) {
    console.error('Clear chat history error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// HEALTH CHECK & SERVER
// =============================================================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    services: {
      gmail: 'ready',
      meetings: 'ready',
      chatbot: 'ready',
      intentDetection: 'ready'
    },
    activeSessions: userSessions.size,
    activeMeetings: activeMeetings.size
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'SimAlly AI Assistant Backend',
    version: '3.0.0',
    services: ['Gmail', 'Video Meetings', 'AI Assistant', 'Intent Detection']
  });
});

app.listen(PORT, () => {
  console.log(`AI Assistant Backend running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log('Features: Intent Detection, Gmail, Video Meetings, AI Assistant');
});

module.exports = app;