class GmailService {
  private static instance: GmailService;
  private accessToken: string | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): GmailService {
    if (!GmailService.instance) {
      GmailService.instance = new GmailService();
    }
    return GmailService.instance;
  }

  async initialize(): Promise<boolean> {
    try {
      // Load Google API
      if (!window.gapi) {
        await this.loadGoogleAPI();
      }

      await new Promise((resolve) => {
        window.gapi.load('auth2:client', resolve);
      });

      await window.gapi.client.init({
        apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
        clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest'],
        scope: 'https://www.googleapis.com/auth/gmail.modify'
      });

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Gmail service initialization failed:', error);
      return false;
    }
  }

  private loadGoogleAPI(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.gapi) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google API'));
      document.head.appendChild(script);
    });
  }

  async signIn(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const authInstance = window.gapi.auth2.getAuthInstance();
      const user = await authInstance.signIn();
      this.accessToken = user.getAuthResponse().access_token;
      return true;
    } catch (error) {
      console.error('Gmail sign in failed:', error);
      return false;
    }
  }

  async isSignedIn(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const authInstance = window.gapi.auth2.getAuthInstance();
    return authInstance.isSignedIn.get();
  }

  async searchEmails(query: string, maxResults: number = 20): Promise<EmailSearchResult> {
    try {
      if (!await this.isSignedIn()) {
        throw new Error('Not signed in to Gmail');
      }

      const response = await window.gapi.client.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: maxResults
      });

      const messages = response.result.messages || [];
      const emails: ProcessedEmail[] = [];

      // Get detailed info for each message
      for (const message of messages.slice(0, Math.min(10, messages.length))) {
        try {
          const detailResponse = await window.gapi.client.gmail.users.messages.get({
            userId: 'me',
            id: message.id
          });

          const email = this.processGmailMessage(detailResponse.result);
          emails.push(email);
        } catch (error) {
          console.error('Error fetching message details:', error);
        }
      }

      return {
        emails,
        nextPageToken: response.result.nextPageToken,
        totalCount: response.result.resultSizeEstimate || 0,
        query
      };
    } catch (error) {
      console.error('Error searching emails:', error);
      throw error;
    }
  }

  async getUnreadEmails(maxResults: number = 20): Promise<EmailSearchResult> {
    return this.searchEmails('is:unread', maxResults);
  }

  async getEmailsFromSender(sender: string, maxResults: number = 20): Promise<EmailSearchResult> {
    return this.searchEmails(`from:${sender}`, maxResults);
  }

  async deleteEmails(emailIds: string[]): Promise<boolean> {
    try {
      if (!await this.isSignedIn()) {
        throw new Error('Not signed in to Gmail');
      }

      const deletePromises = emailIds.map(id =>
        window.gapi.client.gmail.users.messages.delete({
          userId: 'me',
          id: id
        })
      );

      await Promise.all(deletePromises);
      return true;
    } catch (error) {
      console.error('Error deleting emails:', error);
      throw error;
    }
  }

  async sendEmail(to: string, subject: string, body: string): Promise<boolean> {
    try {
      if (!await this.isSignedIn()) {
        throw new Error('Not signed in to Gmail');
      }

      const email = [
        `To: ${to}`,
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        body
      ].join('\n');

      const encodedEmail = btoa(email).replace(/\+/g, '-').replace(/\//g, '_');

      await window.gapi.client.gmail.users.messages.send({
        userId: 'me',
        resource: {
          raw: encodedEmail
        }
      });

      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  private processGmailMessage(message: any): ProcessedEmail {
    const headers = message.payload?.headers || [];
    const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const subject = getHeader('Subject') || '(No Subject)';
    const from = getHeader('From') || 'Unknown Sender';
    const to = getHeader('To');
    const date = getHeader('Date');
    const isRead = !message.labelIds?.includes('UNREAD');
    const hasAttachments = this.checkForAttachments(message.payload);

    return {
      id: message.id,
      subject,
      from,
      to,
      date: this.formatDate(date),
      snippet: message.snippet || '',
      isRead,
      hasAttachments,
      labels: message.labelIds || []
    };
  }

  private checkForAttachments(payload: any): boolean {
    if (!payload) return false;
    
    if (payload.parts) {
      return payload.parts.some((part: any) => 
        part.filename && part.filename.length > 0
      );
    }
    
    return false;
  }

  private formatDate(dateString: string): string {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        return 'Today';
      } else if (diffDays === 2) {
        return 'Yesterday';
      } else if (diffDays <= 7) {
        return `${diffDays - 1} days ago`;
      } else {
        return date.toLocaleDateString();
      }
    } catch {
      return dateString;
    }
  }
}

export { GmailService };
export type { ProcessedEmail, EmailSearchResult };