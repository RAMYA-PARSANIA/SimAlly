import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, MailOpen, Trash2, CheckSquare, Square, User, Calendar, Paperclip, AlertTriangle } from 'lucide-react';
import { ProcessedEmail } from '../types/gmail';
import GlassCard from './ui/GlassCard';
import Button from './ui/Button';

interface EmailListDisplayProps {
  emails: ProcessedEmail[];
  title: string;
  onDeleteSelected?: (emailIds: string[]) => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  loading?: boolean;
  showActions?: boolean;
}

const EmailListDisplay: React.FC<EmailListDisplayProps> = ({
  emails,
  title,
  onDeleteSelected,
  onSelectAll,
  onDeselectAll,
  loading = false,
  showActions = true
}) => {
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const toggleEmailSelection = (emailId: string) => {
    const newSelected = new Set(selectedEmails);
    if (newSelected.has(emailId)) {
      newSelected.delete(emailId);
    } else {
      newSelected.add(emailId);
    }
    setSelectedEmails(newSelected);
  };

  const selectAll = () => {
    setSelectedEmails(new Set(emails.map(email => email.id)));
    onSelectAll?.();
  };

  const deselectAll = () => {
    setSelectedEmails(new Set());
    onDeselectAll?.();
  };

  const handleDeleteSelected = () => {
    if (selectedEmails.size > 0) {
      setShowDeleteConfirm(true);
    }
  };

  const confirmDelete = () => {
    const emailIds = Array.from(selectedEmails);
    onDeleteSelected?.(emailIds);
    setSelectedEmails(new Set());
    setShowDeleteConfirm(false);
  };

  const formatSender = (from: string) => {
    // Extract name from "Name <email@domain.com>" format
    const match = from.match(/^(.+?)\s*<(.+)>$/);
    if (match) {
      return match[1].replace(/"/g, '').trim();
    }
    return from;
  };

  if (loading) {
    return (
      <div className="glass-panel p-6 rounded-lg">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-gold-text border-t-transparent rounded-full mr-3"></div>
          <span className="text-secondary">Loading emails...</span>
        </div>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="glass-panel p-6 rounded-lg text-center">
        <Mail className="w-12 h-12 text-secondary mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-bold text-primary mb-2">No emails found</h3>
        <p className="text-secondary">No emails match your criteria.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="glass-panel p-4 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-primary flex items-center">
            <Mail className="w-5 h-5 mr-2" />
            {title} ({emails.length})
          </h3>
          
          {showActions && (
            <div className="flex items-center space-x-2">
              <Button
                onClick={selectedEmails.size === emails.length ? deselectAll : selectAll}
                variant="ghost"
                size="sm"
                className="flex items-center space-x-1"
              >
                {selectedEmails.size === emails.length ? (
                  <CheckSquare className="w-4 h-4" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                <span>{selectedEmails.size === emails.length ? 'Deselect All' : 'Select All'}</span>
              </Button>
              
              {selectedEmails.size > 0 && (
                <Button
                  onClick={handleDeleteSelected}
                  variant="secondary"
                  size="sm"
                  className="flex items-center space-x-1 bg-red-500/20 border-red-500/50 hover:bg-red-500/30"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                  <span className="text-red-400">Delete ({selectedEmails.size})</span>
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          <AnimatePresence>
            {emails.map((email) => (
              <motion.div
                key={email.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`glass-panel p-3 rounded-lg cursor-pointer transition-all ${
                  selectedEmails.has(email.id) 
                    ? 'border-blue-500/50 bg-blue-500/10' 
                    : 'hover:border-gold-border'
                } ${!email.isRead ? 'border-l-4 border-l-blue-500' : ''}`}
                onClick={() => showActions && toggleEmailSelection(email.id)}
              >
                <div className="flex items-start space-x-3">
                  {showActions && (
                    <div className="flex-shrink-0 mt-1">
                      {selectedEmails.has(email.id) ? (
                        <CheckSquare className="w-4 h-4 text-blue-500" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  )}
                  
                  <div className="flex-shrink-0 mt-1">
                    {email.isRead ? (
                      <MailOpen className="w-4 h-4 text-gray-400" />
                    ) : (
                      <Mail className="w-4 h-4 text-blue-500" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <User className="w-3 h-3 text-secondary" />
                        <span className={`text-sm truncate ${
                          !email.isRead ? 'font-semibold text-primary' : 'font-medium text-secondary'
                        }`}>
                          {formatSender(email.from)}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {email.hasAttachments && (
                          <Paperclip className="w-3 h-3 text-secondary" />
                        )}
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3 text-secondary" />
                          <span className="text-xs text-secondary">{email.date}</span>
                        </div>
                      </div>
                    </div>
                    
                    <h4 className={`text-sm mb-1 truncate ${
                      !email.isRead ? 'font-semibold text-primary' : 'font-normal text-primary'
                    }`}>
                      {email.subject}
                    </h4>
                    
                    <p className="text-xs text-secondary truncate">
                      {email.snippet}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md"
          >
            <GlassCard className="p-6" goldBorder>
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-primary">Delete Emails</h3>
              </div>
              
              <p className="text-secondary mb-2">
                Are you sure you want to delete {selectedEmails.size} email{selectedEmails.size !== 1 ? 's' : ''}?
              </p>
              
              <div className="p-3 glass-panel rounded-lg bg-red-500/10 border-red-500/30 mb-6">
                <p className="text-red-400 text-sm">
                  <strong>Warning:</strong> This action cannot be undone. The selected emails will be permanently deleted from your Gmail account.
                </p>
              </div>

              <div className="flex space-x-3">
                <Button
                  onClick={() => setShowDeleteConfirm(false)}
                  variant="secondary"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmDelete}
                  variant="secondary"
                  className="flex-1 bg-red-500/20 border-red-500/50 hover:bg-red-500/30"
                >
                  <Trash2 className="w-4 h-4 mr-2 text-red-400" />
                  <span className="text-red-400">Delete</span>
                </Button>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default EmailListDisplay;