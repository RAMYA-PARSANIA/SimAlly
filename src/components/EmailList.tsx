import React, { useState, useEffect, useCallback } from 'react';
import { ProcessedEmail } from '../types/gmail';
import { GmailService } from '../services/gmail';
import EmailItem from './EmailItem';
import EmailViewer from './EmailViewer';
import SearchBar from './SearchBar';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import { RefreshCw, AlertCircle, Trash2, CheckSquare, Square } from 'lucide-react';

interface EmailListProps {
  currentView: string;
}

const EmailList: React.FC<EmailListProps> = ({ currentView }) => {
  const [emails, setEmails] = useState<ProcessedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [selectedEmail, setSelectedEmail] = useState<ProcessedEmail | null>(null);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const gmailService = GmailService.getInstance();

  const buildQuery = useCallback((view: string, search: string) => {
    let query = search;
    
    switch (view) {
      case 'inbox':
        query += ' in:inbox';
        break;
      case 'sent':
        query += ' in:sent';
        break;
      case 'archived':
        query += ' has:nouserlabels -in:Sent -in:Chat -in:Draft -in:Inbox';
        break;
      case 'trash':
        query += ' in:trash';
        break;
    }
    
    return query.trim();
  }, []);

  const loadEmails = useCallback(async (query: string = '', pageToken?: string, append = false) => {
    try {
      setLoading(!append);
      setError(null);
      
      const fullQuery = buildQuery(currentView, query);
      const result = await gmailService.getEmails(50, pageToken, fullQuery);
      
      if (append) {
        setEmails(prev => [...prev, ...result.emails]);
      } else {
        setEmails(result.emails);
      }
      
      setNextPageToken(result.nextPageToken);
    } catch (err) {
      setError('Failed to load emails. Please try again.');
      console.error('Error loading emails:', err);
    } finally {
      setLoading(false);
    }
  }, [currentView, buildQuery, gmailService]);

  useEffect(() => {
    setSelectedEmail(null); // Clear selected email when view changes
    setSelectedEmails(new Set()); // Clear selections
    setIsSelectionMode(false); // Exit selection mode
    loadEmails(searchQuery);
  }, [loadEmails, searchQuery]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setSelectedEmail(null); // Clear selected email when searching
    setSelectedEmails(new Set()); // Clear selections
    setIsSelectionMode(false); // Exit selection mode
  };

  const handleEmailClick = (email: ProcessedEmail) => {
    if (isSelectionMode) {
      toggleEmailSelection(email.id);
    } else {
      setSelectedEmail(email);
    }
  };

  const handleBackToList = () => {
    setSelectedEmail(null);
  };

  const handleRefresh = () => {
    setSelectedEmail(null);
    setSelectedEmails(new Set());
    setIsSelectionMode(false);
    loadEmails(searchQuery);
  };

  const handleLoadMore = () => {
    if (nextPageToken) {
      loadEmails(searchQuery, nextPageToken, true);
    }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedEmails(new Set());
  };

  const toggleEmailSelection = (emailId: string) => {
    const newSelected = new Set(selectedEmails);
    if (newSelected.has(emailId)) {
      newSelected.delete(emailId);
    } else {
      newSelected.add(emailId);
    }
    setSelectedEmails(newSelected);
  };

  const selectAllEmails = () => {
    if (selectedEmails.size === emails.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(emails.map(email => email.id)));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedEmails.size > 0) {
      setShowDeleteDialog(true);
    }
  };

  const confirmDelete = async () => {
    try {
      setDeleting(true);
      const emailIds = Array.from(selectedEmails);
      await gmailService.deleteMessages(emailIds);
      
      // Remove deleted emails from the list
      setEmails(prev => prev.filter(email => !selectedEmails.has(email.id)));
      setSelectedEmails(new Set());
      setIsSelectionMode(false);
      setShowDeleteDialog(false);
    } catch (err) {
      setError('Failed to delete emails. Please try again.');
      console.error('Error deleting emails:', err);
    } finally {
      setDeleting(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteDialog(false);
  };

  // Show email viewer if an email is selected
  if (selectedEmail) {
    return <EmailViewer email={selectedEmail} onBack={handleBackToList} />;
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 capitalize">
            {currentView}
          </h2>
          <div className="flex items-center space-x-2">
            {isSelectionMode && (
              <>
                <button
                  onClick={selectAllEmails}
                  className="flex items-center space-x-1 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {selectedEmails.size === emails.length ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  <span>Select All</span>
                </button>
                <button
                  onClick={handleDeleteSelected}
                  disabled={selectedEmails.size === 0}
                  className="flex items-center space-x-1 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete ({selectedEmails.size})</span>
                </button>
              </>
            )}
            <button
              onClick={toggleSelectionMode}
              className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                isSelectionMode 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              {isSelectionMode ? 'Cancel' : 'Select'}
            </button>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        <SearchBar onSearch={handleSearch} isLoading={loading} />
      </div>

      {/* Email List - Scrollable */}
      <div className="flex-1 overflow-y-auto bg-white">
        {loading && emails.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        ) : emails.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-500">No emails found</p>
          </div>
        ) : (
          <div>
            {emails.map((email) => (
              <EmailItem
                key={email.id}
                email={email}
                onClick={handleEmailClick}
                isSelected={selectedEmails.has(email.id)}
                isSelectionMode={isSelectionMode}
              />
            ))}
            
            {nextPageToken && (
              <div className="p-4 text-center border-t border-gray-100">
                <button
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showDeleteDialog && (
        <DeleteConfirmDialog
          count={selectedEmails.size}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
          isDeleting={deleting}
        />
      )}
    </div>
  );
};

export default EmailList;