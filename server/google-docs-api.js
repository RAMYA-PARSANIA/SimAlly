const express = require('express');
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
const { OAuth2Client } = require('google-auth-library');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleGenAI, Modality } = require('@google/genai');
const { Readable } = require('stream');
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

// Initialize Gemini AI for image generation
const imageGenAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

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

// Content safety filter
function isContentSafe(prompt) {
  const bannedKeywords = [
    'illegal', 'drug', 'weapon', 'violence', 'harmful', 'hate', 'discriminat',
    'adult', 'sexual', 'pornographic', 'explicit', 'nude', 'nsfw',
    'terror', 'bomb', 'kill', 'murder', 'suicide', 'self-harm',
    'scam', 'fraud', 'phishing', 'malware', 'hack', 'steal',
    'racist', 'sexist', 'homophobic', 'transphobic', 'offensive'
  ];
  
  const lowerPrompt = prompt.toLowerCase();
  return !bannedKeywords.some(keyword => lowerPrompt.includes(keyword));
}

// Generate images using Gemini 2.0 Flash Preview Image Generation
async function generateImages(prompt, count = 2, drive = null) {
  try {
    const images = [];
    
    // Create image generation prompts based on the content
    const imagePrompts = [
      `Create a professional, clean, and modern illustration related to: ${prompt}. Style should be business-appropriate, minimalist, and visually appealing.`,
      `Generate a relevant diagram, chart, or infographic for: ${prompt}. Use a professional color scheme and clear visual hierarchy.`
    ].slice(0, count);

    for (let i = 0; i < imagePrompts.length; i++) {
      try {
        console.log(`Generating image ${i + 1} with prompt: ${imagePrompts[i]}`);
        
        const response = await imageGenAI.models.generateContent({
          model: "gemini-2.0-flash-preview-image-generation",
          contents: imagePrompts[i],
          config: {
            responseModalities: [Modality.TEXT, Modality.IMAGE],
          },
        });

        // Extract image from response
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const imageData = part.inlineData.data;
            
            // If drive client is provided, upload to Drive and get public URL
            if (drive) {
              try {
                const buffer = Buffer.from(imageData, 'base64');
                const fileName = `generated_image_${Date.now()}_${i + 1}.png`;
                
                // Create a readable stream from the buffer
                const stream = new Readable();
                stream.push(buffer);
                stream.push(null); // End the stream
                
                // Upload to Google Drive
                const fileMetadata = {
                  name: fileName,
                  parents: ['root'] // Upload to root folder
                };
                
                const media = {
                  mimeType: 'image/png',
                  body: stream
                };
                
                const uploadResponse = await drive.files.create({
                  requestBody: fileMetadata,
                  media: media,
                  fields: 'id,webViewLink,webContentLink'
                });
                
                // Make the file publicly viewable
                await drive.permissions.create({
                  fileId: uploadResponse.data.id,
                  requestBody: {
                    role: 'reader',
                    type: 'anyone'
                  }
                });
                
                // Get the direct image URL
                const publicUrl = `https://drive.google.com/uc?export=view&id=${uploadResponse.data.id}`;
                
                images.push({
                  url: publicUrl,
                  alt: `AI generated image ${i + 1} for ${prompt}`,
                  driveId: uploadResponse.data.id
                });
                
                console.log(`Image ${i + 1} uploaded to Drive: ${publicUrl}`);
              } catch (uploadError) {
                console.error(`Error uploading image ${i + 1} to Drive:`, uploadError);
                // Skip this image if upload fails
              }
            } else {
              // Fallback: For any case where drive client is not provided, use data URI
              const dataUri = `data:image/png;base64,${imageData}`;
              images.push({
                url: dataUri,
                alt: `AI generated image ${i + 1} for ${prompt}`,
                data: imageData
              });
            }
            break; // Only take the first image from this response
          }
        }
      } catch (error) {
        console.error(`Error generating image ${i + 1}:`, error);
        // Skip this image and continue with others
      }
    }
    
    console.log(`Successfully generated ${images.length} images`);
    return images;
  } catch (error) {
    console.error('Error in image generation:', error);
    return []; // Return empty array if generation fails completely
  }
}

// Generate Google Docs content with AI and images
async function generateDocContent(prompt) {
  try {
    // Check content safety
    if (!isContentSafe(prompt)) {
      throw new Error('Content not allowed. Please ensure your request is appropriate and legal.');
    }

    // Don't generate images here - they'll be generated later with Drive client
    
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
            "type": "image_placeholder",
            "position": "after_intro"
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
          },
          {
            "type": "image_placeholder",
            "position": "mid_document"
          },
          {
            "type": "paragraph",
            "text": "Conclusion or summary content...",
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
      - Include image_placeholder elements where images would enhance the content
      - Include an introduction, main content sections, and conclusion if appropriate
      
      Only respond with valid JSON - no markdown formatting or code blocks.
    `);
    
    let responseText = result.response.text();
    
    // Clean up the response text - remove markdown code blocks if present
    responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
    
    const content = JSON.parse(responseText);
    // Images will be added later when we have the drive client
    
    return content;
  } catch (error) {
    console.error('Error generating doc content:', error);
    throw new Error('Failed to generate document content');
  }
}

// Generate Google Slides content with AI and images
async function generateSlidesContent(prompt) {
  try {
    // Check content safety
    if (!isContentSafe(prompt)) {
      throw new Error('Content not allowed. Please ensure your request is appropriate and legal.');
    }

    // Don't generate images here - they'll be generated later with Drive client
    
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
            "layout": "TITLE_AND_BODY",
            "elements": {
              "TITLE": "Visual Content",
              "BODY": "• Key insights\\n• Supporting data\\n• Enhanced understanding",
              "hasImage": true
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
              "TITLE": "Implementation Strategy",
              "BODY": "• Step-by-step approach\\n• Timeline and milestones\\n• Resource planning",
              "hasImage": true
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
      - Create 6-8 slides for a comprehensive presentation
      - Start with a title slide
      - Include section headers to organize content
      - Use varied layouts (TITLE_ONLY, SECTION_HEADER, TITLE_AND_BODY, TITLE_AND_TWO_COLUMNS)
      - Make content professional and engaging
      - Include bullet points for clarity
      - Mark 2 slides with "hasImage": true where images would enhance the content
      - End with a conclusion or next steps slide
      - Ensure content flows logically from slide to slide
      
      Available layouts: TITLE_ONLY, SECTION_HEADER, TITLE_AND_BODY, TITLE_AND_TWO_COLUMNS, BLANK
      
      Only respond with valid JSON - no markdown formatting or code blocks.
    `);
    
    let responseText = result.response.text();
    
    // Clean up the response text - remove markdown code blocks if present
    responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
    
    const content = JSON.parse(responseText);
    // Images will be added later when we have the drive client
    
    return content;
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
    
    // Generate images with Drive upload for docs (to avoid URL length limits)
    docContent.images = await generateImages(prompt, 2, drive);
    
    // Create a new document (remove template functionality)
    const createResponse = await docs.documents.create({
      requestBody: {
        title: docContent.title
      }
    });
    
    const documentId = createResponse.data.documentId;
    
    // Prepare requests to update document content with images
    const requests = [];
    let currentIndex = 1; // Start after the document title
    let imageIndex = 0;
    
    // Process content elements with proper formatting and images
    for (const element of docContent.content) {
      if (element.type === 'heading1' || element.type === 'heading2') {
        // Process text formatting for headings
        const textLength = processTextFormatting(element.text + '\n', currentIndex, requests);
        
        // Apply heading style
        const style = element.type === 'heading1' ? 'TITLE' : 'HEADING_1';
        requests.push({
          updateParagraphStyle: {
            range: {
              startIndex: currentIndex,
              endIndex: currentIndex + textLength - 1 // -1 to exclude the newline
            },
            paragraphStyle: {
              namedStyleType: style
            },
            fields: 'namedStyleType'
          }
        });
        
        currentIndex += textLength;
        
      } else if (element.type === 'paragraph') {
        // Process text formatting for paragraphs
        const textLength = processTextFormatting(element.text + '\n\n', currentIndex, requests);
        currentIndex += textLength;
        
      } else if (element.type === 'image_placeholder' && docContent.images && imageIndex < docContent.images.length) {
        const image = docContent.images[imageIndex];
        if (image && image.url) {
            // Add spacing before image for better layout
            requests.push({
                insertText: {
                    location: { index: currentIndex },
                    text: '\n'
                }
            });
            currentIndex += 1;
            
            // Insert image with better sizing - larger and more professional
            requests.push({
                insertInlineImage: {
                    location: { index: currentIndex },
                    uri: image.url, // Now uses Drive URL which is much shorter
                    objectSize: {
                        height: { magnitude: 360, unit: 'PT' }, // Increased from 300 to 360
                        width: { magnitude: 480, unit: 'PT' }   // Increased from 400 to 480
                    }
                }
            });
            
            // Add proper spacing after image to prevent text overlap
            requests.push({
                insertText: {
                    location: { index: currentIndex + 1 },
                    text: '\n\n\n'  // More spacing to prevent overlap
                }
            });
            
            currentIndex += 4; // Account for image and spacing
            imageIndex++;
        }
        
      } else if (element.type === 'bullet_list' && element.items) {
        // Insert bullet list items with formatting
        element.items.forEach(item => {
          const startIndexForItem = currentIndex;
          const textLength = processTextFormatting(item + '\n', currentIndex, requests);
          
          // Apply bullet list formatting
          requests.push({
            createParagraphBullets: {
              range: {
                startIndex: startIndexForItem,
                endIndex: startIndexForItem + textLength - 1 // -1 to exclude newline
              },
              bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE'
            }
          });
          
          currentIndex += textLength;
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
    }
    
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
    
    // Generate images with Drive upload for slides (to avoid URL length limits)
    slidesContent.images = await generateImages(prompt, 2, drive);
    
    // Create a new presentation (remove template functionality)
    const createResponse = await slides.presentations.create({
      requestBody: {
        title: slidesContent.title
      }
    });
    
    const presentationId = createResponse.data.presentationId;
    
    // Step 1: Create all slides first
    const createSlideRequests = slidesContent.slides.map((slide, index) => ({
        createSlide: {
          objectId: `slide_${index}`,
          slideLayoutReference: {
            predefinedLayout: slide.layout,
          },
        },
    }));
    
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
    
    // Step 4: Insert text into placeholders and add images
    const updateRequests = [];
    let imageIndex = 0;
    
    // Find slides with our custom objectIds
    for (let i = 0; i < slidesContent.slides.length; i++) {
        const slideContent = slidesContent.slides[i];
        const slideObjectId = `slide_${i}`;
        const slideObject = presentation.data.slides.find(s => s.objectId === slideObjectId);

        if (slideObject && slideObject.pageElements) {
            slideObject.pageElements.forEach((element) => {
                if (element.shape && element.shape.placeholder) {
                    const placeholderType = element.shape.placeholder.type;
                    if (placeholderType === 'TITLE' && slideContent.elements.TITLE) {
                        updateRequests.push({ insertText: { objectId: element.objectId, text: cleanMarkdownText(slideContent.elements.TITLE) } });
                        // Add bold formatting for titles
                        if (slideContent.elements.TITLE.includes('**')) {
                            addSlideTextFormatting(updateRequests, element.objectId, slideContent.elements.TITLE);
                        }
                    } else if (placeholderType === 'SUBTITLE' && slideContent.elements.SUBTITLE) {
                        updateRequests.push({ insertText: { objectId: element.objectId, text: cleanMarkdownText(slideContent.elements.SUBTITLE) } });
                        if (slideContent.elements.SUBTITLE.includes('**')) {
                            addSlideTextFormatting(updateRequests, element.objectId, slideContent.elements.SUBTITLE);
                        }
                    } else if (placeholderType === 'BODY' && slideContent.elements.BODY) {
                        updateRequests.push({ insertText: { objectId: element.objectId, text: cleanMarkdownText(slideContent.elements.BODY) } });
                        if (slideContent.elements.BODY.includes('**')) {
                            addSlideTextFormatting(updateRequests, element.objectId, slideContent.elements.BODY);
                        }
                    } else if (placeholderType === 'CENTERED_TITLE' && slideContent.elements.TITLE) {
                        updateRequests.push({ insertText: { objectId: element.objectId, text: cleanMarkdownText(slideContent.elements.TITLE) } });
                        if (slideContent.elements.TITLE.includes('**')) {
                            addSlideTextFormatting(updateRequests, element.objectId, slideContent.elements.TITLE);
                        }
                    }
                }
            });

            // If this slide should have an image, add it now
            if (slideContent.elements.hasImage && slidesContent.images && imageIndex < slidesContent.images.length) {
                const image = slidesContent.images[imageIndex];
                if (image && image.url) {
                    // Calculate better positioning based on slide layout
                    let imageTransform = {
                        scaleX: 1, 
                        scaleY: 1,
                        unit: 'EMU'
                    };
                    
                    // Make images larger and position them better
                    let imageSize = {
                        height: { magnitude: 3000000, unit: 'EMU' }, // ~3.33 inches
                        width: { magnitude: 4000000, unit: 'EMU' }   // ~4.44 inches
                    };
                    
                    // Position image based on layout type
                    if (slideContent.layout === 'TITLE_AND_BODY') {
                        // Place image in bottom right area, away from text
                        imageTransform.translateX = 4800000; // Right side but not too far
                        imageTransform.translateY = 2800000; // Lower middle area
                      } else if (slideContent.layout === 'TITLE_AND_TWO_COLUMNS') {
                        // Place image in the bottom center
                        imageTransform.translateX = 2500000; // More centered
                        imageTransform.translateY = 3200000; // Bottom area
                        imageSize.height.magnitude = 2200000; // Smaller for two-column layout
                        imageSize.width.magnitude = 2800000;
                      } else {
                        // Default positioning for other layouts - bottom right
                        imageTransform.translateX = 4500000; // Right area
                        imageTransform.translateY = 3000000; // Bottom area
                      }
                    
                    updateRequests.push({
                        createImage: {
                            objectId: `image_${i}`,
                            url: image.url,
                            elementProperties: {
                                pageObjectId: slideObjectId,
                                size: imageSize,
                                transform: imageTransform
                            }
                        }
                    });
                    imageIndex++;
                }
            }
        }
    }
    
    // Update the presentation with text and images
    if (updateRequests.length > 0) {
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: {
          requests: updateRequests
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
      // Set slide size to standard widescreen (16:9) - this is the modern standard
      {
        updatePresentationProperties: {
          presentationProperties: {
            pageSize: {
              height: {
                magnitude: 5062500,
                unit: 'EMU'
              },
              width: {
                magnitude: 9000000,
                unit: 'EMU'
              }
            }
          },
          fields: 'pageSize'
        }
      }
    ];

    // Apply the styling
    if (stylingRequests.length > 0) {
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: {
          requests: stylingRequests
        }
      });
    }
    
  } catch (error) {
    console.log('Note: Using default styling - presentation created successfully');
  }
}

// Apply professional styling to document using Google's built-in styles
async function applyDocumentStyling(docs, documentId) {
  try {
    const stylingRequests = [
      // Set professional document margins and page setup
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
            },
            // Use Google's default font that looks professional
            defaultHeaderId: 'HEADING_1',
            defaultFooterId: 'NORMAL_TEXT'
          },
          fields: 'marginTop,marginBottom,marginLeft,marginRight,pageSize'
        }
      },
      // Apply consistent font styling throughout the document
      {
        updateTextStyle: {
          range: {
            startIndex: 1,
            endIndex: -1  // Apply to entire document
          },
          textStyle: {
            fontSize: {
              magnitude: 11,
              unit: 'PT'
            },
            fontFamily: 'Arial' // Professional, readable font
          },
          fields: 'fontSize,fontFamily'
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
    console.log('Note: Using default document styling - document created successfully');
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

// Helper function to process markdown formatting and create formatting requests
function processTextFormatting(text, startIndex, requests) {
  // Clean text by removing markdown formatting
  const cleanText = text.replace(/\*\*(.*?)\*\*/g, '$1');
  
  // Insert the clean text
  requests.push({
    insertText: {
      location: { index: startIndex },
      text: cleanText
    }
  });
  
  // Find and apply bold formatting
  const boldMatches = [];
  let match;
  const boldRegex = /\*\*(.*?)\*\*/g;
  
  while ((match = boldRegex.exec(text)) !== null) {
    const beforeBold = text.substring(0, match.index).replace(/\*\*(.*?)\*\*/g, '$1');
    const boldText = match[1];
    
    boldMatches.push({
      start: startIndex + beforeBold.length,
      end: startIndex + beforeBold.length + boldText.length
    });
  }
  
  // Apply bold formatting to matched ranges
  boldMatches.forEach(range => {
    requests.push({
      updateTextStyle: {
        range: {
          startIndex: range.start,
          endIndex: range.end
        },
        textStyle: {
          bold: true
        },
        fields: 'bold'
      }
    });
  });
  
  return cleanText.length;
}

// Helper function to clean markdown formatting from text (for slides)
function cleanMarkdownText(text) {
  if (!text) return text;
  // Remove bold markdown formatting
  return text.replace(/\*\*(.*?)\*\*/g, '$1');
}

// Helper function to add text formatting for slides
function addSlideTextFormatting(updateRequests, objectId, originalText) {
  // Find bold text ranges in the original text
  const boldMatches = [];
  let match;
  const boldRegex = /\*\*(.*?)\*\*/g;
  
  while ((match = boldRegex.exec(originalText)) !== null) {
    const beforeBold = originalText.substring(0, match.index).replace(/\*\*(.*?)\*\*/g, '$1');
    const boldText = match[1];
    
    boldMatches.push({
      start: beforeBold.length,
      end: beforeBold.length + boldText.length
    });
  }
  
  // Apply bold formatting to matched ranges
  boldMatches.forEach(range => {
    updateRequests.push({
      updateTextStyle: {
        objectId: objectId,
        textRange: {
          startIndex: range.start,
          endIndex: range.end
        },
        style: {
          bold: true
        },
        fields: 'bold'
      }
    });
  });
}

module.exports = { router };