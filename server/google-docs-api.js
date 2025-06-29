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
      Create a professional, well-structured Google Doc based on this prompt: "${prompt}"
      
      Format your response as a JSON object with the following structure:
      {
        "title": "Professional Document Title",
        "content": [
          {
            "type": "heading1",
            "text": "Main Title",
            "style": "TITLE"
          },
          {
            "type": "heading2", 
            "text": "Section Header",
            "style": "HEADING_1"
          },
          {
            "type": "paragraph",
            "text": "Regular paragraph text content with proper structure and flow.",
            "style": "NORMAL_TEXT"
          },
          {
            "type": "bullet_list",
            "items": [
              "• First bullet point with meaningful content",
              "• Second bullet point with detailed information",
              "• Third bullet point with actionable insights"
            ]
          },
          {
            "type": "heading2",
            "text": "Another Section",
            "style": "HEADING_1"
          },
          {
            "type": "paragraph",
            "text": "More detailed content...",
            "style": "NORMAL_TEXT"
          }
        ]
      }
      
      Requirements:
      - Create a professional document with clear structure
      - Include multiple sections with descriptive headings
      - Use bullet points for lists and key information
      - Ensure content is comprehensive and well-organized
      - Make it look like a professional business document
      - Include an introduction, main content sections, and conclusion if appropriate
      
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
      Create a professional Google Slides presentation based on this prompt: "${prompt}"
      
      Format your response as a JSON object with the following structure:
      {
        "title": "Professional Presentation Title",
        "slides": [
          {
            "layout": "TITLE_ONLY",
            "elements": {
              "TITLE": "Compelling Presentation Title"
            }
          },
          {
            "layout": "SECTION_HEADER",
            "elements": {
              "TITLE": "Section 1: Introduction",
              "SUBTITLE": "Setting the stage"
            }
          },
          {
            "layout": "TITLE_AND_BODY",
            "elements": {
              "TITLE": "Key Points",
              "BODY": "• First major point with detailed explanation\\n• Second important concept with context\\n• Third critical insight with implications"
            }
          },
          {
            "layout": "TITLE_AND_TWO_COLUMNS",
            "elements": {
              "TITLE": "Comparison or Analysis",
              "BODY": "Left column content:\\n• Point 1\\n• Point 2\\n\\nRight column content:\\n• Point A\\n• Point B"
            }
          },
          {
            "layout": "TITLE_AND_BODY",
            "elements": {
              "TITLE": "Next Steps",
              "BODY": "• Actionable item 1\\n• Actionable item 2\\n• Timeline and milestones"
            }
          },
          {
            "layout": "SECTION_HEADER",
            "elements": {
              "TITLE": "Thank You",
              "SUBTITLE": "Questions & Discussion"
            }
          }
        ]
      }
      
      Requirements:
      - Create 5-8 slides for a comprehensive presentation
      - Start with a title slide
      - Include section headers to organize content
      - Use varied layouts (TITLE_ONLY, SECTION_HEADER, TITLE_AND_BODY, TITLE_AND_TWO_COLUMNS)
      - Make content professional and engaging
      - Include bullet points for clarity
      - End with a conclusion or next steps slide
      - Ensure content flows logically from slide to slide
      
      Available layouts: TITLE_ONLY, SECTION_HEADER, TITLE_AND_BODY, TITLE_AND_TWO_COLUMNS, BLANK
      
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
    let currentIndex = 1; // Start after the document title
    
    // Process content elements with proper formatting
    docContent.content.forEach((element, index) => {
      if (element.type === 'heading1' || element.type === 'heading2') {
        // Insert text first
        requests.push({
          insertText: {
            location: { index: currentIndex },
            text: element.text + '\n'
          }
        });
        
        // Apply heading style
        const style = element.type === 'heading1' ? 'TITLE' : 'HEADING_1';
        requests.push({
          updateParagraphStyle: {
            range: {
              startIndex: currentIndex,
              endIndex: currentIndex + element.text.length
            },
            paragraphStyle: {
              namedStyleType: style
            },
            fields: 'namedStyleType'
          }
        });
        
        currentIndex += element.text.length + 1;
        
      } else if (element.type === 'paragraph') {
        // Insert regular paragraph
        requests.push({
          insertText: {
            location: { index: currentIndex },
            text: element.text + '\n\n'
          }
        });
        
        currentIndex += element.text.length + 2;
        
      } else if (element.type === 'bullet_list' && element.items) {
        // Insert bullet list items
        element.items.forEach(item => {
          requests.push({
            insertText: {
              location: { index: currentIndex },
              text: item + '\n'
            }
          });
          
          // Apply bullet list formatting
          requests.push({
            createParagraphBullets: {
              range: {
                startIndex: currentIndex,
                endIndex: currentIndex + item.length
              },
              bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE'
            }
          });
          
          currentIndex += item.length + 1;
        });
        
        // Add extra line after list
        requests.push({
          insertText: {
            location: { index: currentIndex },
            text: '\n'
          }
        });
        currentIndex += 1;
      }
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
    
    // Apply professional styling to document
    await applyDocumentStyling(docs, documentId);
    
    // Get document metadata
    const docInfo = await docs.documents.get({
      documentId
    });
    
    // Get document URL
    const fileInfo = await drive.files.get({
      fileId: documentId,
      fields: 'webViewLink'
    });
    
    // Apply professional styling to document
    await applyDocumentStyling(docs, documentId);
    
    res.json({
      success: true,
      document: {
        id: documentId,
        title: docContent.title,
        url: fileInfo.data.webViewLink,
        downloadUrl: `${process.env.VITE_API_URL || 'http://localhost:8000'}/api/google/docs/download-doc/${documentId}?userId=${userId}`
      }
    });
  } catch (error) {
    console.error('Error creating Google Doc:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      errors: error.errors
    });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create document',
      details: error.message 
    });
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
    
    // Step 2: Delete the default blank slide that was created automatically
    // Get the current presentation to find the default slide
    let currentPresentation = await slides.presentations.get({
      presentationId,
    });
    
    // Find and delete the default slide (usually the first one without our custom objectId)
    const defaultSlide = currentPresentation.data.slides.find(slide => 
      !slide.objectId.startsWith('slide_')
    );
    
    if (defaultSlide) {
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: {
          requests: [{
            deleteObject: {
              objectId: defaultSlide.objectId
            }
          }]
        }
      });
    }
    
    // Step 3: Get the presentation again to find placeholder IDs after deletion
    const presentation = await slides.presentations.get({
      presentationId,
    });
    
    // Step 4: Insert text into placeholders
    const textRequests = [];
    
    // Find slides with our custom objectIds
    slidesContent.slides.forEach((slide, index) => {
      const slideObjectId = `slide_${index}`;
      const slideObject = presentation.data.slides.find(s => s.objectId === slideObjectId);
      
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
    
    // Apply professional styling to presentation
    await applyPresentationStyling(slides, presentationId);
    
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
        downloadUrl: `${process.env.VITE_API_URL || 'http://localhost:8000'}/api/google/docs/download-slides/${presentationId}?userId=${userId}`
      }
    });
  } catch (error) {
    console.error('Error creating Google Slides presentation:', error);
    res.status(500).json({ success: false, error: 'Failed to create presentation' });
  }
});

// Apply professional styling to presentation
async function applyPresentationStyling(slides, presentationId) {
  try {
    const stylingRequests = [
      // Set a professional color scheme
      {
        updatePageProperties: {
          objectId: 'page',
          pageProperties: {
            colorScheme: {
              colors: [
                {
                  type: 'THEME_COLOR_TYPE_DARK1',
                  color: {
                    rgbColor: {
                      red: 0.2,
                      green: 0.2,
                      blue: 0.2
                    }
                  }
                },
                {
                  type: 'THEME_COLOR_TYPE_LIGHT1',
                  color: {
                    rgbColor: {
                      red: 1.0,
                      green: 1.0,
                      blue: 1.0
                    }
                  }
                },
                {
                  type: 'THEME_COLOR_TYPE_ACCENT1',
                  color: {
                    rgbColor: {
                      red: 0.26,
                      green: 0.53,
                      blue: 0.96
                    }
                  }
                }
              ]
            }
          },
          fields: 'colorScheme'
        }
      }
    ];

    if (stylingRequests.length > 0) {
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: {
          requests: stylingRequests
        }
      });
    }
  } catch (error) {
    console.log('Note: Could not apply advanced styling, but presentation was created successfully');
  }
}

// Apply professional styling to document
async function applyDocumentStyling(docs, documentId) {
  try {
    const stylingRequests = [
      // Add a professional header/footer style
      {
        updateDocumentStyle: {
          documentStyle: {
            marginTop: {
              magnitude: 72,
              unit: 'PT'
            },
            marginBottom: {
              magnitude: 72,
              unit: 'PT'
            },
            marginLeft: {
              magnitude: 72,
              unit: 'PT'
            },
            marginRight: {
              magnitude: 72,
              unit: 'PT'
            },
            pageSize: {
              height: {
                magnitude: 792,
                unit: 'PT'
              },
              width: {
                magnitude: 612,
                unit: 'PT'
              }
            }
          },
          fields: 'marginTop,marginBottom,marginLeft,marginRight,pageSize'
        }
      }
    ];

    if (stylingRequests.length > 0) {
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: stylingRequests
        }
      });
    }
  } catch (error) {
    console.log('Note: Could not apply advanced document styling, but document was created successfully');
  }
}

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