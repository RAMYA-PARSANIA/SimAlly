const express = require('express');
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
const { OAuth2Client } = require('google-auth-library');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');
const dotenv = require('dotenv');
const crypto = require('crypto');

dotenv.config();

const router = express.Router();

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || 'http://localhost:8000/api/google/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Create OAuth client
const createOAuthClient = () => {
  return new OAuth2Client(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );
};

// Generate Google Docs content with AI
async function generateDocContent(prompt) {
  try {
    const result = await model.generateContent(`
      Create content for a Google Doc based on this prompt: "${prompt}"
      
      Format your response as a JSON object with the following structure:
      {
        "title": "Document Title",
        "content": [
          {
            "paragraph": {
              "elements": [
                {
                  "textRun": {
                    "content": "Text content here",
                    "textStyle": {} // Optional styling
                  }
                }
              ]
            }
          },
          // More elements as needed (paragraphs, lists, tables, etc.)
        ]
      }
      
      Follow Google Docs API structure. Include proper formatting, headings, and organization.
      Only respond with valid JSON - no markdown formatting or code blocks.
    `);
    
    let responseText = result.response.text();
    
    // Clean up the response text - remove markdown code blocks if present
    responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
    
    return JSON.parse(responseText);
  } catch (error) {
    console.error('Error generating doc content:', error);
    throw new Error('Failed to generate document content');
  }
}

// Generate Google Slides content with AI
async function generateSlidesContent(prompt) {
  try {
    const result = await model.generateContent(`
      Create content for a Google Slides presentation based on this prompt: "${prompt}"
      
      Format your response as a JSON object with the following structure:
      {
        "title": "Presentation Title",
        "slides": [
          {
            "layout": "TITLE",
            "elements": {
              "TITLE": "Slide Title",
              "SUBTITLE": "Optional subtitle"
            }
          },
          {
            "layout": 'TITLE_AND_BODY',
            "elements": {
              "TITLE": "Slide Title",
              "BODY": "• Bullet point 1\\n• Bullet point 2\\n• Bullet point 3"
            }
          }
        ]
      }
      
      Use placeholder types (TITLE, BODY, SUBTITLE, etc.) as keys in the "elements" object.
      Use appropriate slide layouts from the Google Slides API (e.g., TITLE, TITLE_AND_BODY, SECTION_HEADER, BLANK).
      Only respond with valid JSON - no markdown formatting or code blocks.
    `);
    
    let responseText = result.response.text();
    
    // Clean up the response text - remove markdown code blocks if present
    responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
    
    return JSON.parse(responseText);
  } catch (error) {
    console.error('Error generating slides content:', error);
    throw new Error('Failed to generate presentation content');
  }
}

// Create a Google Doc
router.post('/create-doc', async (req, res) => {
  const { userId, prompt } = req.body;
  
  if (!userId || !prompt) {
    return res.status(400).json({ success: false, error: 'User ID and prompt are required' });
  }
  
  try {
    // Get tokens from Supabase
    const { data: tokensData, error: tokensError } = await supabase.rpc('get_gmail_tokens', {
      p_user_id: userId
    });
    
    if (tokensError || !tokensData.success) {
      console.error('Error retrieving tokens:', tokensError || tokensData.error);
      return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
    }
    
    // Generate document content using AI
    const docContent = await generateDocContent(prompt);
    
    // Set up OAuth client
    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials({
      access_token: tokensData.access_token,
      refresh_token: tokensData.refresh_token,
      token_type: tokensData.token_type,
      expiry_date: new Date(tokensData.expires_at).getTime()
    });
    
    // Create Google Docs client
    const docs = google.docs({ version: 'v1', auth: oAuth2Client });
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });
    
    // Create a new document
    const createResponse = await docs.documents.create({
      requestBody: {
        title: docContent.title
      }
    });
    
    const documentId = createResponse.data.documentId;
    
    // Prepare requests to update document content
    const requests = [];
    
    // Process content elements
    docContent.content.forEach(element => {
      if (element.paragraph) {
        const paragraph = {
          insertText: {
            location: {
              index: 1
            },
            text: element.paragraph.elements.map(el => el.textRun.content).join('') + '\n'
          }
        };
        requests.push(paragraph);
      }
      // Add more element types as needed (lists, tables, etc.)
    });
    
    // Update the document with content
    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests
        }
      });
    }
    
    // Get document metadata
    const docInfo = await docs.documents.get({
      documentId
    });
    
    // Get document URL
    const fileInfo = await drive.files.get({
      fileId: documentId,
      fields: 'webViewLink'
    });
    
    res.json({
      success: true,
      document: {
        id: documentId,
        title: docContent.title,
        url: fileInfo.data.webViewLink,
        downloadUrl: `${process.env.BACKEND_URL || 'http://localhost:8000'}/api/google/docs/download-doc/${documentId}?userId=${userId}`
      }
    });
  } catch (error) {
    console.error('Error creating Google Doc:', error);
    res.status(500).json({ success: false, error: 'Failed to create document' });
  }
});

// Create a Google Slides presentation
router.post('/create-slides', async (req, res) => {
  const { userId, prompt } = req.body;
  
  if (!userId || !prompt) {
    return res.status(400).json({ success: false, error: 'User ID and prompt are required' });
  }
  
  try {
    // Get tokens from Supabase
    const { data: tokensData, error: tokensError } = await supabase.rpc('get_gmail_tokens', {
      p_user_id: userId
    });
    
    if (tokensError || !tokensData.success) {
      console.error('Error retrieving tokens:', tokensError || tokensData.error);
      return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
    }
    
    // Generate slides content using AI
    const slidesContent = await generateSlidesContent(prompt);
    
    // Set up OAuth client
    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials({
      access_token: tokensData.access_token,
      refresh_token: tokensData.refresh_token,
      token_type: tokensData.token_type,
      expiry_date: new Date(tokensData.expires_at).getTime()
    });
    
    // Create Google Slides client
    const slides = google.slides({ version: 'v1', auth: oAuth2Client });
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });
    
    // Create a new presentation
    const createResponse = await slides.presentations.create({
      requestBody: {
        title: slidesContent.title
      }
    });
    
    const presentationId = createResponse.data.presentationId;
    
    // Step 1: Create all slides first
    const createSlideRequests = [];
    
    slidesContent.slides.forEach((slide, index) => {
      createSlideRequests.push({
        createSlide: {
          objectId: `slide_${index}`,
          slideLayoutReference: {
            predefinedLayout: slide.layout,
          },
        },
      });
    });
    
    // Create slides first
    if (createSlideRequests.length > 0) {
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: {
          requests: createSlideRequests
        }
      });
    }
    
    // Step 2: Get the presentation to find placeholder IDs
    const presentation = await slides.presentations.get({
      presentationId,
    });
    
    // Step 3: Insert text into placeholders
    const textRequests = [];
    
    slidesContent.slides.forEach((slide, index) => {
      const slideObject = presentation.data.slides[index + 1]; // +1 because index 0 is the title slide created by default
      
      if (slideObject && slideObject.pageElements) {
        slideObject.pageElements.forEach((element) => {
          if (element.shape && element.shape.placeholder) {
            const placeholderType = element.shape.placeholder.type;
            
            if (placeholderType === 'TITLE' && slide.elements.TITLE) {
              textRequests.push({
                insertText: {
                  objectId: element.objectId,
                  text: slide.elements.TITLE,
                },
              });
            } else if (placeholderType === 'SUBTITLE' && slide.elements.SUBTITLE) {
              textRequests.push({
                insertText: {
                  objectId: element.objectId,
                  text: slide.elements.SUBTITLE,
                },
              });
            } else if (placeholderType === 'BODY' && slide.elements.BODY) {
              textRequests.push({
                insertText: {
                  objectId: element.objectId,
                  text: slide.elements.BODY,
                },
              });
            } else if (placeholderType === 'CENTERED_TITLE' && slide.elements.TITLE) {
              textRequests.push({
                insertText: {
                  objectId: element.objectId,
                  text: slide.elements.TITLE,
                },
              });
            }
          }
        });
      }
    });
    
    // Update the presentation with text content
    if (textRequests.length > 0) {
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: {
          requests: textRequests
        }
      });
    }
    
    // Get presentation URL
    const fileInfo = await drive.files.get({
      fileId: presentationId,
      fields: 'webViewLink'
    });
    
    res.json({
      success: true,
      presentation: {
        id: presentationId,
        title: slidesContent.title,
        url: fileInfo.data.webViewLink,
        downloadUrl: `${process.env.BACKEND_URL || 'http://localhost:8000'}/api/google/docs/download-slides/${presentationId}?userId=${userId}`
      }
    });
  } catch (error) {
    console.error('Error creating Google Slides presentation:', error);
    res.status(500).json({ success: false, error: 'Failed to create presentation' });
  }
});

// Get a list of user's documents
router.get('/docs', async (req, res) => {
  const userId = req.query.userId;
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  
  try {
    // Get tokens from Supabase
    const { data: tokensData, error: tokensError } = await supabase.rpc('get_gmail_tokens', {
      p_user_id: userId
    });
    
    if (tokensError || !tokensData.success) {
      console.error('Error retrieving tokens:', tokensError || tokensData.error);
      return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
    }
    
    // Set up OAuth client
    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials({
      access_token: tokensData.access_token,
      refresh_token: tokensData.refresh_token,
      token_type: tokensData.token_type,
      expiry_date: new Date(tokensData.expires_at).getTime()
    });
    
    // Create Google Drive client
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });
    
    // Get list of documents
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.document'",
      fields: 'files(id, name, webViewLink, createdTime, modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: 10
    });
    
    res.json({
      success: true,
      documents: response.data.files
    });
  } catch (error) {
    console.error('Error fetching Google Docs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch documents' });
  }
});

// Get a list of user's presentations
router.get('/slides', async (req, res) => {
  const userId = req.query.userId;
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  
  try {
    // Get tokens from Supabase
    const { data: tokensData, error: tokensError } = await supabase.rpc('get_gmail_tokens', {
      p_user_id: userId
    });
    
    if (tokensError || !tokensData.success) {
      console.error('Error retrieving tokens:', tokensError || tokensData.error);
      return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
    }
    
    // Set up OAuth client
    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials({
      access_token: tokensData.access_token,
      refresh_token: tokensData.refresh_token,
      token_type: tokensData.token_type,
      expiry_date: new Date(tokensData.expires_at).getTime()
    });
    
    // Create Google Drive client
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });
    
    // Get list of presentations
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.presentation'",
      fields: 'files(id, name, webViewLink, createdTime, modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: 10
    });
    
    res.json({
      success: true,
      presentations: response.data.files
    });
  } catch (error) {
    console.error('Error fetching Google Slides:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch presentations' });
  }
});

// Download a Google Slides presentation as PowerPoint
router.get('/download-slides/:presentationId', async (req, res) => {
  const { presentationId } = req.params;
  const userId = req.query.userId;
  
  if (!userId || !presentationId) {
    return res.status(400).json({ success: false, error: 'User ID and presentation ID are required' });
  }
  
  try {
    // Get tokens from Supabase
    const { data: tokensData, error: tokensError } = await supabase.rpc('get_gmail_tokens', {
      p_user_id: userId
    });
    
    if (tokensError || !tokensData.success) {
      console.error('Error retrieving tokens:', tokensError || tokensData.error);
      return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
    }
    
    // Set up OAuth client
    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials({
      access_token: tokensData.access_token,
      refresh_token: tokensData.refresh_token,
      token_type: tokensData.token_type,
      expiry_date: new Date(tokensData.expires_at).getTime()
    });
    
    // Create Google Drive client
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });
    
    // Get presentation metadata
    const fileInfo = await drive.files.get({
      fileId: presentationId,
      fields: 'name'
    });
    
    // Export as PowerPoint (.pptx)
    const exportResponse = await drive.files.export({
      fileId: presentationId,
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    }, { responseType: 'stream' });
    
    // Set response headers for download
    const filename = `${fileInfo.data.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pptx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Pipe the stream to the response
    exportResponse.data.pipe(res);
    
  } catch (error) {
    console.error('Error downloading Google Slides presentation:', error);
    res.status(500).json({ success: false, error: 'Failed to download presentation' });
  }
});

// Download a Google Doc as Word document
router.get('/download-doc/:documentId', async (req, res) => {
  const { documentId } = req.params;
  const userId = req.query.userId;
  
  if (!userId || !documentId) {
    return res.status(400).json({ success: false, error: 'User ID and document ID are required' });
  }
  
  try {
    // Get tokens from Supabase
    const { data: tokensData, error: tokensError } = await supabase.rpc('get_gmail_tokens', {
      p_user_id: userId
    });
    
    if (tokensError || !tokensData.success) {
      console.error('Error retrieving tokens:', tokensError || tokensData.error);
      return res.status(401).json({ success: false, error: 'Not authenticated with Google' });
    }
    
    // Set up OAuth client
    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials({
      access_token: tokensData.access_token,
      refresh_token: tokensData.refresh_token,
      token_type: tokensData.token_type,
      expiry_date: new Date(tokensData.expires_at).getTime()
    });
    
    // Create Google Drive client
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });
    
    // Get document metadata
    const fileInfo = await drive.files.get({
      fileId: documentId,
      fields: 'name'
    });
    
    // Export as Word document (.docx)
    const exportResponse = await drive.files.export({
      fileId: documentId,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }, { responseType: 'stream' });
    
    // Set response headers for download
    const filename = `${fileInfo.data.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Pipe the stream to the response
    exportResponse.data.pipe(res);
    
  } catch (error) {
    console.error('Error downloading Google Doc:', error);
    res.status(500).json({ success: false, error: 'Failed to download document' });
  }
});

module.exports = { router };