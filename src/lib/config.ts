// Configuration for API endpoints and URLs
export const config = {
  // Frontend URL
  APP_URL: import.meta.env.VITE_APP_URL || 'http://localhost:5173',
  
  // Backend API URLs
  API_URL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  AI_API_URL: import.meta.env.VITE_AI_API_URL || 'http://localhost:8001',
  MEDIA_API_URL: import.meta.env.VITE_MEDIA_API_URL || 'http://localhost:3001',
  WORKSPACE_API_URL: import.meta.env.VITE_WORKSPACE_API_URL || 'http://localhost:8002',
  
  // Supabase
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
} as const;

// Helper functions for building API URLs
export const apiEndpoints = {
  // Game API
  createRiddleConversation: () => `${config.API_URL}/api/create-riddle-conversation`,
  createTwentyQuestionsUserAsks: () => `${config.API_URL}/api/create-twenty-questions-user-asks`,
  createTwentyQuestionsAiAsks: () => `${config.API_URL}/api/create-twenty-questions-ai-asks`,
  endConversation: () => `${config.API_URL}/api/end-conversation`,
  healthCheck: () => `${config.API_URL}/api/health`,
  
  // AI Assistant API
  aiChatAgent: () => `${config.AI_API_URL}/api/chat/agent-process`,
  aiChatGeneral: () => `${config.AI_API_URL}/api/chat/general`,
  gmailStatus: (userId: string) => `${config.AI_API_URL}/api/gmail/status?userId=${userId}`,
  gmailAuthUrl: (userId: string) => `${config.AI_API_URL}/api/gmail/auth-url?userId=${userId}`,
  gmailDisconnect: () => `${config.AI_API_URL}/api/gmail/disconnect`,
  gmailDeleteEmails: () => `${config.AI_API_URL}/api/gmail/delete-emails`,
  gmailEmail: (emailId: string, userId: string) => `${config.AI_API_URL}/api/gmail/email/${emailId}?userId=${userId}`,
  meetingAutoNotes: () => `${config.AI_API_URL}/api/meetings/auto-notes`,
  meetingSummary: () => `${config.AI_API_URL}/api/meetings/summary`,
  
  // Media API
  mediaHealth: () => `${config.MEDIA_API_URL}/api/media/health`,
  mediaRooms: () => `${config.MEDIA_API_URL}/api/media/rooms`,
  
  // Workspace API
  workspaceProcessMessage: () => `${config.WORKSPACE_API_URL}/api/workspace/process-message`,
  workspaceSummarizeChannel: () => `${config.WORKSPACE_API_URL}/api/workspace/summarize-channel`,
  workspaceChannels: () => `${config.WORKSPACE_API_URL}/api/workspace/channels`,
  workspaceChannelJoin: (channelId: string) => `${config.WORKSPACE_API_URL}/api/workspace/channels/${channelId}/join`,
  workspaceChannelLeave: (channelId: string) => `${config.WORKSPACE_API_URL}/api/workspace/channels/${channelId}/leave`,
  workspaceChannelDelete: (channelId: string) => `${config.WORKSPACE_API_URL}/api/workspace/channels/${channelId}`,
  workspaceChannelsList: (userId: string) => `${config.WORKSPACE_API_URL}/api/workspace/channels/${userId}`,
  workspaceMessageEdit: (messageId: string) => `${config.WORKSPACE_API_URL}/api/workspace/messages/${messageId}`,
  workspaceMessageDelete: (messageId: string) => `${config.WORKSPACE_API_URL}/api/workspace/messages/${messageId}`,
  workspaceTaskDelete: (taskId: string) => `${config.WORKSPACE_API_URL}/api/workspace/tasks/${taskId}`,
  workspaceHealth: () => `${config.WORKSPACE_API_URL}/api/workspace/health`,
} as const;