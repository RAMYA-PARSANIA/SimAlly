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

// =============================================================================
// INTENT DETECTION & ROUTING
// =============================================================================

// Advanced intent detection with Gemini AI
app.post('/api/chat/detect-intent', async (req, res) => {
  try {
    const { message, userId } = req.body;
    
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    const intentPrompt = `
      You are an intelligent intent classifier for an AI assistant that can handle:
      1. Gmail operations (send, read, delete, unsubscribe, compose help)
      2. Zoom meeting assistance (start session, translate, get summary, end session)
      3. General chat/questions
      
      Analyze this user message and determine the intent, extract parameters, and provide a helpful response.
      
      User message: "${message}"
      
      Respond in this exact JSON format:
      {
        "intent": "one of: gmail_send, gmail_read, gmail_delete, gmail_unsubscribe, gmail_compose_help, zoom_start, zoom_translate, zoom_summary, zoom_end, chat",
        "confidence": 0.0-1.0,
        "parameters": {
          // Extract relevant parameters based on intent
          // For gmail_send: {"to": "email", "subject": "subject", "body": "body"}
          // For gmail_read: {"count": number, "query": "search terms"}
          // For gmail_delete: {"messageId": "id or description"}
          // For zoom_translate: {"text": "text to translate", "language": "target language"}
          // For zoom_start: {"meetingId": "meeting identifier"}
          // For chat: {}
        },
        "response": "A helpful response to the user explaining what you'll do or asking for clarification"
      }
      
      Examples:
      - "Send an email to john@example.com about the meeting" → gmail_send intent
      - "Check my latest emails" → gmail_read intent
      - "Delete the spam email from yesterday" → gmail_delete intent
      - "Help me write a professional email" → gmail_compose_help intent
      - "Start a Zoom session" → zoom_start intent
      - "Translate 'hello' to Spanish" → zoom_translate intent
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
    
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
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
      You can help with Gmail management, Zoom meetings, and general questions.
      
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
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
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
    
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
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
// ZOOM FUNCTIONALITY
// =============================================================================

// Store active Zoom sessions
const zoomSessions = new Map();

// Start Zoom session monitoring
app.post('/api/zoom/start-session', (req, res) => {
  try {
    const { userId, meetingId } = req.body;
    const sessionId = `${userId}_${meetingId}_${Date.now()}`;
    
    zoomSessions.set(sessionId, {
      userId,
      meetingId,
      startTime: new Date(),
      transcript: [],
      translations: [],
      suggestions: []
    });
    
    res.json({ success: true, sessionId });
  } catch (error) {
    console.error('Start Zoom session error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Real-time translation
app.post('/api/zoom/translate', async (req, res) => {
  try {
    const { sessionId, text, targetLanguage = 'en' } = req.body;
    const session = zoomSessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const prompt = `
      Translate the following text to ${targetLanguage}. 
      Provide only the translation, no explanations:
      
      "${text}"
    `;
    
    const result = await model.generateContent(prompt);
    const translation = result.response.text().trim();
    
    // Store translation
    session.translations.push({
      original: text,
      translated: translation,
      targetLanguage,
      timestamp: new Date()
    });
    
    res.json({ success: true, translation });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Meeting suggestions
app.post('/api/zoom/suggestions', async (req, res) => {
  try {
    const { sessionId, context, currentSpeaker } = req.body;
    const session = zoomSessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const prompt = `
      Based on this meeting context, provide helpful suggestions for the current speaker:
      
      Context: ${context}
      Current Speaker: ${currentSpeaker}
      
      Provide 3 brief, actionable suggestions in JSON format:
      {
        "suggestions": [
          "suggestion 1",
          "suggestion 2", 
          "suggestion 3"
        ]
      }
    `;
    
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    try {
      const suggestions = JSON.parse(response);
      session.suggestions.push({
        context,
        suggestions: suggestions.suggestions,
        timestamp: new Date()
      });
      
      res.json({ success: true, ...suggestions });
    } catch {
      res.json({ 
        success: true, 
        suggestions: ['Focus on key points', 'Ask clarifying questions', 'Summarize next steps'] 
      });
    }
  } catch (error) {
    console.error('Suggestions error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate meeting summary
app.post('/api/zoom/summary', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = zoomSessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const prompt = `
      Generate a comprehensive meeting summary based on this session data:
      
      Meeting Duration: ${Math.round((new Date() - session.startTime) / 60000)} minutes
      Translations Made: ${session.translations.length}
      Suggestions Given: ${session.suggestions.length}
      
      Recent Context: ${session.suggestions.map(s => s.context).join(' ')}
      
      Provide a structured summary with:
      1. Meeting Overview
      2. Key Discussion Points
      3. Action Items
      4. Next Steps
      
      Format as JSON with these fields: overview, keyPoints, actionItems, nextSteps
    `;
    
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    try {
      const summary = JSON.parse(response);
      res.json({ success: true, ...summary });
    } catch {
      res.json({ 
        success: true, 
        overview: 'Meeting completed successfully',
        keyPoints: ['Discussion held', 'Points covered'],
        actionItems: ['Follow up on decisions'],
        nextSteps: ['Schedule next meeting']
      });
    }
  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// End Zoom session
app.post('/api/zoom/end-session', (req, res) => {
  try {
    const { sessionId } = req.body;
    zoomSessions.delete(sessionId);
    res.json({ success: true, message: 'Session ended successfully' });
  } catch (error) {
    console.error('End session error:', error);
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
      zoom: 'ready',
      chatbot: 'ready',
      intentDetection: 'ready'
    },
    activeSessions: userSessions.size,
    activeZoomSessions: zoomSessions.size
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'SimAlly AI Assistant Backend',
    version: '2.0.0',
    services: ['Gmail', 'Zoom', 'Chatbot', 'Intent Detection']
  });
});

app.listen(PORT, () => {
  console.log(`AI Assistant Backend running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log('Features: Intent Detection, Gmail, Zoom, Chatbot');
});

module.exports = app;