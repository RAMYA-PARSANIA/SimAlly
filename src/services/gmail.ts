import { ProcessedEmail, GmailMessage, GmailListResponse, GmailProfile } from '../types/gmail';

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

export class GmailService {
  private static instance: GmailService;
  private isInitialized = false;
  private isSignedIn = false;
  private gapi: any = null;

  private constructor() {}

  static getInstance(): GmailService {
    if (!GmailService.instance) {
      GmailService.instance = new GmailService();
    }
    return GmailService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      // Load Google API script
      if (!window.gapi) {
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => this.loadGapi().then(resolve).catch(reject);
        script.onerror = () => reject(new Error('Failed to load Google API'));
        document.head.appendChild(script);
      } else {
        this.loadGapi().then(resolve).catch(reject);
      }
    });
  }

  private async loadGapi(): Promise<void> {
    return new Promise((resolve, reject) => {
      window.gapi.load('auth2:client', {
        callback: async () => {
          try {
            await window.gapi.client.init({
              apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
              clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
              discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest'],
              scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify'
            });

            this.gapi = window.gapi;
            this.isInitialized = true;
            
            // Check if user is already signed in
            const authInstance = this.gapi.auth2.getAuthInstance();
            this.isSignedIn = authInstance.isSignedIn.get();
            
            resolve();
          } catch (error) {
            reject(error);
          }
        },
        onerror: () => reject(new Error('Failed to load Google API client'))
      });
    });
  }

  async signIn(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isSignedIn) return;

    const authInstance = this.gapi.auth2.getAuthInstance();
    await authInstance.signIn();
    this.isSignedIn = true;
  }

  async signOut(): Promise<void> {
    if (!this.isInitialized || !this.isSignedIn) return;

    const authInstance = this.gapi.auth2.getAuthInstance();
    await authInstance.signOut();
    this.isSignedIn = false;
  }

  isAuthenticated(): boolean {
    return this.isSignedIn;
  }

  async getProfile(): Promise<GmailProfile> {
    if (!this.isSignedIn) {
      throw new Error('Not authenticated');
    }

    const response = await this.gapi.client.gmail.users.getProfile({
      userId: 'me'
    });

    return response.result;
  }

  async getEmails(maxResults = 50, pageToken?: string, query = ''): Promise<{
    emails: ProcessedEmail[];
    nextPageToken?: string;
  }> {
    if (!this.isSignedIn) {
      throw new Error('Not authenticated');
    }

    try {
      // Get list of message IDs
      const listResponse = await this.gapi.client.gmail.users.messages.list({
        userId: 'me',
        maxResults,
        pageToken,
        q: query
      });

      const messageList: GmailListResponse = listResponse.result;

      if (!messageList.messages || messageList.messages.length === 0) {
        return { emails: [] };
      }

      // Get full message details for each message
      const emailPromises = messageList.messages.map(async (msg) => {
        const messageResponse = await this.gapi.client.gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full'
        });

        return this.processMessage(messageResponse.result);
      });

      const emails = await Promise.all(emailPromises);

      return {
        emails: emails.filter(email => email !== null) as ProcessedEmail[],
        nextPageToken: messageList.nextPageToken
      };
    } catch (error) {
      console.error('Error fetching emails:', error);
      throw new Error('Failed to fetch emails');
    }
  }

  async getMessage(messageId: string): Promise<GmailMessage> {
    if (!this.isSignedIn) {
      throw new Error('Not authenticated');
    }

    const response = await this.gapi.client.gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });

    return response.result;
  }

  async sendEmail(to: string, subject: string, body: string, isHtml = false): Promise<void> {
    if (!this.isSignedIn) {
      throw new Error('Not authenticated');
    }

    const email = [
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset=utf-8`,
      '',
      body
    ].join('\n');

    const encodedEmail = btoa(email).replace(/\+/g, '-').replace(/\//g, '_');

    await this.gapi.client.gmail.users.messages.send({
      userId: 'me',
      resource: {
        raw: encodedEmail
      }
    });
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    if (!this.isSignedIn) {
      throw new Error('Not authenticated');
    }

    const deletePromises = messageIds.map(id =>
      this.gapi.client.gmail.users.messages.delete({
        userId: 'me',
        id
      })
    );

    await Promise.all(deletePromises);
  }

  async markAsRead(messageIds: string[]): Promise<void> {
    if (!this.isSignedIn) {
      throw new Error('Not authenticated');
    }

    await this.gapi.client.gmail.users.messages.batchModify({
      userId: 'me',
      resource: {
        ids: messageIds,
        removeLabelIds: ['UNREAD']
      }
    });
  }

  async markAsUnread(messageIds: string[]): Promise<void> {
    if (!this.isSignedIn) {
      throw new Error('Not authenticated');
    }

    await this.gapi.client.gmail.users.messages.batchModify({
      userId: 'me',
      resource: {
        ids: messageIds,
        addLabelIds: ['UNREAD']
      }
    });
  }

  private processMessage(message: GmailMessage): ProcessedEmail | null {
    try {
      const headers = message.payload?.headers || [];
      
      const getHeader = (name: string): string => {
        const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
        return header?.value || '';
      };

      const subject = getHeader('Subject') || '(No Subject)';
      const from = getHeader('From') || 'Unknown Sender';
      const to = getHeader('To');
      const date = getHeader('Date');
      
      // Format date
      let formattedDate = '';
      if (date) {
        try {
          const dateObj = new Date(date);
          const now = new Date();
          const diffTime = now.getTime() - dateObj.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays === 0) {
            formattedDate = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } else if (diffDays < 7) {
            formattedDate = dateObj.toLocaleDateString([], { weekday: 'short' });
          } else {
            formattedDate = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
          }
        } catch {
          formattedDate = date.substring(0, 10);
        }
      }

      // Check if read
      const isRead = !message.labelIds?.includes('UNREAD');

      // Check for attachments
      const hasAttachments = this.hasAttachments(message.payload);

      return {
        id: message.id,
        subject,
        from: this.extractEmailAddress(from),
        to,
        date: formattedDate,
        snippet: message.snippet || '',
        isRead,
        hasAttachments,
        labels: message.labelIds || []
      };
    } catch (error) {
      console.error('Error processing message:', error);
      return null;
    }
  }

  private extractEmailAddress(fromHeader: string): string {
    // Extract email from "Name <email@domain.com>" format
    const emailMatch = fromHeader.match(/<(.+?)>/);
    if (emailMatch) {
      return fromHeader.replace(emailMatch[0], '').trim() || emailMatch[1];
    }
    return fromHeader;
  }

  private hasAttachments(payload: any): boolean {
    if (!payload) return false;
    
    if (payload.filename && payload.filename.length > 0) {
      return true;
    }
    
    if (payload.parts) {
      return payload.parts.some((part: any) => this.hasAttachments(part));
    }
    
    return false;
  }
}