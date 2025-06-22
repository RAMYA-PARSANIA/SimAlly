import React from 'react';
import { ProcessedEmail } from '../types/gmail';
import { Mail, MailOpen, CheckSquare, Square } from 'lucide-react';

interface EmailItemProps {
  email: ProcessedEmail;
  onClick: (email: ProcessedEmail) => void;
  isSelected?: boolean;
  isSelectionMode?: boolean;
}

const EmailItem: React.FC<EmailItemProps> = ({ 
  email, 
  onClick, 
  isSelected = false, 
  isSelectionMode = false 
}) => {
  return (
    <div
      onClick={() => onClick(email)}
      className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
        !email.isRead ? 'bg-blue-50' : ''
      } ${isSelected ? 'bg-blue-100 border-blue-200' : ''}`}
    >
      <div className="flex items-start space-x-3">
        {isSelectionMode && (
          <div className="flex-shrink-0 mt-1">
            {isSelected ? (
              <CheckSquare className="w-5 h-5 text-blue-600" />
            ) : (
              <Square className="w-5 h-5 text-gray-400" />
            )}
          </div>
        )}
        
        <div className="flex-shrink-0 mt-1">
          {email.isRead ? (
            <MailOpen className="w-5 h-5 text-gray-400" />
          ) : (
            <Mail className="w-5 h-5 text-blue-600" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <p className={`text-sm truncate ${!email.isRead ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
              {email.from}
            </p>
            <p className="text-xs text-gray-500 flex-shrink-0 ml-2">
              {email.date}
            </p>
          </div>
          
          <h3 className={`text-sm mb-1 truncate ${!email.isRead ? 'font-semibold text-gray-900' : 'font-normal text-gray-800'}`}>
            {email.subject}
          </h3>
          
          <p className="text-sm text-gray-600 truncate">
            {email.snippet}
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmailItem;