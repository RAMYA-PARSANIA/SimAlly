import React, { useState, useEffect } from 'react';
import { ProcessedEmail, GmailMessage } from '../types/gmail';
import { GmailService } from '../services/gmail';
import { ArrowLeft, Calendar, User, Mail, Paperclip, RefreshCw, AlertCircle } from 'lucide-react';

interface EmailViewerProps {
  email: ProcessedEmail;
  onBack: () => void;
}

const EmailViewer: React.FC<EmailViewerProps> = ({ email, onBack }) => {
  const [fullMessage, setFullMessage] = useState<GmailMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const gmailService = GmailService.getInstance();

  useEffect(() => {
    loadFullMessage();
  }, [email.id]);

  const loadFullMessage = async () => {
    try {
      setLoading(true);
      setError(null);
      const message = await gmailService.getMessage(email.id);
      setFullMessage(message);
    } catch (err) {
      setError('Failed to load email content');
      console.error('Error loading email:', err);
    } finally {
      setLoading(false);
    }
  };

  const getEmailBody = (message: GmailMessage): string => {
    if (!message.payload) return '';

    // Try to get HTML content first, then plain text
    const htmlPart = findPart(message.payload, 'text/html');
    const textPart = findPart(message.payload, 'text/plain');
    
    const part = htmlPart || textPart;
    if (!part?.body?.data) return message.snippet || '';

    try {
      // Decode base64url
      const decoded = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      return decoded;
    } catch {
      return message.snippet || '';
    }
  };

  const findPart = (payload: any, mimeType: string): any => {
    if (payload.mimeType === mimeType) {
      return payload;
    }
    
    if (payload.parts) {
      for (const part of payload.parts) {
        const found = findPart(part, mimeType);
        if (found) return found;
      }
    }
    
    return null;
  };

  const getHeader = (headers: any[], name: string): string => {
    const header = headers?.find(h => h.name.toLowerCase() === name.toLowerCase());
    return header?.value || '';
  };

  const formatFullDate = (dateString: string): string => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const hasAttachments = (message: GmailMessage): boolean => {
    const checkParts = (parts: any[]): boolean => {
      return parts?.some(part => 
        part.filename && part.filename.length > 0 ||
        (part.parts && checkParts(part.parts))
      ) || false;
    };
    
    return message.payload?.parts ? checkParts(message.payload.parts) : false;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading email...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadFullMessage}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!fullMessage) return null;

  const headers = fullMessage.payload?.headers || [];
  const subject = getHeader(headers, 'Subject') || '(No Subject)';
  const from = getHeader(headers, 'From') || 'Unknown Sender';
  const to = getHeader(headers, 'To') || '';
  const date = getHeader(headers, 'Date') || '';
  const emailBody = getEmailBody(fullMessage);
  const isHtml = findPart(fullMessage.payload, 'text/html') !== null;

  return (
    <div className="flex-1 flex flex-col bg-white h-full overflow-hidden">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to emails</span>
          </button>
          
          {hasAttachments(fullMessage) && (
            <div className="flex items-center space-x-1 text-gray-500">
              <Paperclip className="w-4 h-4" />
              <span className="text-sm">Has attachments</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">
            {subject}
          </h1>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4" />
              <span className="font-medium">From:</span>
              <span>{from}</span>
            </div>
            
            {to && (
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4" />
                <span className="font-medium">To:</span>
                <span>{to}</span>
              </div>
            )}
            
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4" />
              <span>{formatFullDate(date)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Email Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          <div className="max-w-4xl mx-auto">
            {isHtml ? (
              <div 
                className="prose prose-gray max-w-none"
                dangerouslySetInnerHTML={{ __html: emailBody }}
                style={{
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  lineHeight: '1.6',
                  color: '#374151'
                }}
              />
            ) : (
              <div className="whitespace-pre-wrap text-gray-800 leading-relaxed font-mono text-sm">
                {emailBody}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailViewer;