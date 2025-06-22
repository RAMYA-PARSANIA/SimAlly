export interface ProcessedEmail {
  id: string;
  subject: string;
  from: string;
  to?: string;
  date: string;
  snippet: string;
  isRead: boolean;
  hasAttachments: boolean;
  labels: string[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: any[];
    mimeType: string;
  };
  internalDate: string;
}

export interface GmailResponse {
  messages: GmailMessage[];
  nextPageToken?: string;
  resultSizeEstimate: number;
}

export interface EmailSearchResult {
  emails: ProcessedEmail[];
  nextPageToken?: string;
  totalCount: number;
  query: string;
}