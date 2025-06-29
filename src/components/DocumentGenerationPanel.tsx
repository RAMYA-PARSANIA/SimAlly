import React, { useState, useEffect } from 'react';
import { FileText, Presentation, Plus, Download, ExternalLink, Loader2, Search, Calendar, Clock, Filter, RefreshCw, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import GlassCard from './ui/GlassCard';
import Button from './ui/Button';

interface Document {
  id: string;
  name: string;
  webViewLink: string;
  createdTime: string;
  modifiedTime: string;
}

interface Presentation {
  id: string;
  name: string;
  webViewLink: string;
  createdTime: string;
  modifiedTime: string;
}

const DocumentGenerationPanel: React.FC = () => {
  const { user, isGoogleConnected } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDocModal, setShowCreateDocModal] = useState(false);
  const [showCreateSlidesModal, setShowCreateSlidesModal] = useState(false);
  const [docPrompt, setDocPrompt] = useState('');
  const [slidesPrompt, setSlidesPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'docs' | 'slides'>('docs');
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);

  useEffect(() => {
    if (user && isGoogleConnected) {
      loadDocuments();
      loadPresentations();
    } else {
      setLoading(false);
    }
  }, [user, isGoogleConnected]);

  const loadDocuments = async () => {
    if (!user) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/google/docs/docs?userId=${user.id}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setDocuments(data.documents);
        }
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPresentations = async () => {
    if (!user) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/google/docs/slides?userId=${user.id}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPresentations(data.presentations);
        }
      }
    } catch (error) {
      console.error('Error loading presentations:', error);
    }
  };

  const handleCreateDoc = async () => {
    if (!user || !docPrompt.trim()) return;
    
    setIsGenerating(true);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/google/docs/create-doc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          userId: user.id,
          prompt: docPrompt
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        showNotification('success', 'Document created successfully!');
        setDocPrompt('');
        setShowCreateDocModal(false);
        loadDocuments();
      } else {
        showNotification('error', data.error || 'Failed to create document');
      }
    } catch (error) {
      console.error('Error creating document:', error);
      showNotification('error', 'Failed to create document');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateSlides = async () => {
    if (!user || !slidesPrompt.trim()) return;
    
    setIsGenerating(true);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/google/docs/create-slides`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          userId: user.id,
          prompt: slidesPrompt
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        showNotification('success', 'Presentation created successfully!');
        setSlidesPrompt('');
        setShowCreateSlidesModal(false);
        loadPresentations();
      } else {
        showNotification('error', data.error || 'Failed to create presentation');
      }
    } catch (error) {
      console.error('Error creating presentation:', error);
      showNotification('error', 'Failed to create presentation');
    } finally {
      setIsGenerating(false);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const filteredDocuments = documents.filter(doc => 
    doc.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPresentations = presentations.filter(pres => 
    pres.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && !isGoogleConnected) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-gold-text border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="glass-panel border-b silver-border p-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold gradient-gold-silver">Document Generation</h2>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1 glass-panel rounded-lg p-1">
              <button
                onClick={() => setActiveTab('docs')}
                className={`px-3 py-1 rounded-md text-sm transition-all ${
                  activeTab === 'docs'
                    ? 'bg-gradient-gold-silver text-white'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                Documents
              </button>
              <button
                onClick={() => setActiveTab('slides')}
                className={`px-3 py-1 rounded-md text-sm transition-all ${
                  activeTab === 'slides'
                    ? 'bg-gradient-gold-silver text-white'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                Presentations
              </button>
            </div>
            
            <Button
              onClick={() => activeTab === 'docs' ? setShowCreateDocModal(true) : setShowCreateSlidesModal(true)}
              variant="premium"
              size="sm"
              className="flex items-center space-x-2"
              disabled={!isGoogleConnected}
            >
              <Plus className="w-4 h-4" />
              <span>Create {activeTab === 'docs' ? 'Document' : 'Slides'}</span>
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center space-x-4">
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-secondary" />
            <input
              type="text"
              placeholder={`Search ${activeTab === 'docs' ? 'documents' : 'presentations'}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 glass-panel rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 text-primary placeholder-secondary"
            />
          </div>
          
          <Button
            onClick={() => activeTab === 'docs' ? loadDocuments() : loadPresentations()}
            variant="ghost"
            size="sm"
            className="p-2"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Google Connection Status */}
      {!isGoogleConnected && (
        <div className="p-6">
          <GlassCard className="p-6 bg-yellow-500/10 border-yellow-500/30">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <FileText className="w-6 h-6 text-yellow-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-yellow-500 mb-1">Google Account Required</h3>
                <p className="text-secondary">
                  Please connect your Google account from the Dashboard to use the Document Generation feature.
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Document/Presentation List */}
      {isGoogleConnected && (
        <div className="flex-1 overflow-y-auto p-4">
          <AnimatePresence mode="wait">
            {activeTab === 'docs' && (
              <motion.div
                key="docs-tab"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                {filteredDocuments.length > 0 ? (
                  filteredDocuments.map((doc) => (
                    <GlassCard key={doc.id} className="p-4 group" hover>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-medium text-primary group-hover:gold-text transition-colors">{doc.name}</h3>
                            <div className="flex items-center space-x-4 text-xs text-secondary">
                              <span className="flex items-center">
                                <Calendar className="w-3 h-3 mr-1" />
                                {formatDate(doc.createdTime)}
                              </span>
                              <span className="flex items-center">
                                <Clock className="w-3 h-3 mr-1" />
                                Last modified: {formatDate(doc.modifiedTime)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            onClick={() => window.open(doc.webViewLink, '_blank')}
                            variant="secondary"
                            size="sm"
                            className="flex items-center space-x-2"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>Open</span>
                          </Button>
                        </div>
                      </div>
                    </GlassCard>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-secondary mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-bold text-primary mb-2">No documents found</h3>
                    <p className="text-secondary mb-4">
                      {searchTerm ? 'No documents match your search criteria' : 'Create your first document to get started'}
                    </p>
                    <Button
                      onClick={() => setShowCreateDocModal(true)}
                      variant="secondary"
                      size="sm"
                    >
                      Create Document
                    </Button>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'slides' && (
              <motion.div
                key="slides-tab"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                {filteredPresentations.length > 0 ? (
                  filteredPresentations.map((presentation) => (
                    <GlassCard key={presentation.id} className="p-4 group" hover>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center">
                            <Presentation className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-medium text-primary group-hover:gold-text transition-colors">{presentation.name}</h3>
                            <div className="flex items-center space-x-4 text-xs text-secondary">
                              <span className="flex items-center">
                                <Calendar className="w-3 h-3 mr-1" />
                                {formatDate(presentation.createdTime)}
                              </span>
                              <span className="flex items-center">
                                <Clock className="w-3 h-3 mr-1" />
                                Last modified: {formatDate(presentation.modifiedTime)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            onClick={() => window.open(presentation.webViewLink, '_blank')}
                            variant="secondary"
                            size="sm"
                            className="flex items-center space-x-2"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>Open</span>
                          </Button>
                        </div>
                      </div>
                    </GlassCard>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <Presentation className="w-12 h-12 text-secondary mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-bold text-primary mb-2">No presentations found</h3>
                    <p className="text-secondary mb-4">
                      {searchTerm ? 'No presentations match your search criteria' : 'Create your first presentation to get started'}
                    </p>
                    <Button
                      onClick={() => setShowCreateSlidesModal(true)}
                      variant="secondary"
                      size="sm"
                    >
                      Create Presentation
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Create Document Modal */}
      <AnimatePresence>
        {showCreateDocModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md"
            >
              <GlassCard className="p-6" goldBorder>
                <h3 className="text-xl font-bold gradient-gold-silver mb-6">
                  Create New Document
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-primary mb-2">
                      What would you like to create?
                    </label>
                    <textarea
                      value={docPrompt}
                      onChange={(e) => setDocPrompt(e.target.value)}
                      placeholder="Describe the document you want to create. For example: 'Create a project proposal for a mobile app that helps users track their fitness goals.'"
                      className="w-full glass-panel rounded-lg px-4 py-3 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                      rows={6}
                      autoFocus
                    />
                    <p className="text-xs text-secondary mt-2">
                      Be specific about the content, structure, and purpose of your document.
                    </p>
                  </div>

                  <div className="p-3 glass-panel rounded-lg bg-blue-500/10 border-blue-500/30">
                    <p className="text-blue-400 text-sm">
                      AI will generate a complete document based on your description. The document will be created in your Google Drive.
                    </p>
                  </div>
                </div>

                <div className="flex space-x-4 mt-6">
                  <Button
                    onClick={() => setShowCreateDocModal(false)}
                    variant="secondary"
                    className="flex-1"
                    disabled={isGenerating}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateDoc}
                    variant="premium"
                    className="flex-1"
                    disabled={!docPrompt.trim() || isGenerating}
                  >
                    {isGenerating ? (
                      <div className="flex items-center justify-center">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        <span>Generating...</span>
                      </div>
                    ) : (
                      'Create Document'
                    )}
                  </Button>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Slides Modal */}
      <AnimatePresence>
        {showCreateSlidesModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md"
            >
              <GlassCard className="p-6" goldBorder>
                <h3 className="text-xl font-bold gradient-gold-silver mb-6">
                  Create New Presentation
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-primary mb-2">
                      What would you like to present?
                    </label>
                    <textarea
                      value={slidesPrompt}
                      onChange={(e) => setSlidesPrompt(e.target.value)}
                      placeholder="Describe the presentation you want to create. For example: 'Create a 10-slide presentation about renewable energy sources, their benefits, and global adoption trends.'"
                      className="w-full glass-panel rounded-lg px-4 py-3 text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                      rows={6}
                      autoFocus
                    />
                    <p className="text-xs text-secondary mt-2">
                      Include details about the topic, number of slides, key points, and target audience.
                    </p>
                  </div>

                  <div className="p-3 glass-panel rounded-lg bg-orange-500/10 border-orange-500/30">
                    <p className="text-orange-400 text-sm">
                      AI will generate a complete presentation based on your description. The slides will be created in your Google Drive.
                    </p>
                  </div>
                </div>

                <div className="flex space-x-4 mt-6">
                  <Button
                    onClick={() => setShowCreateSlidesModal(false)}
                    variant="secondary"
                    className="flex-1"
                    disabled={isGenerating}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateSlides}
                    variant="premium"
                    className="flex-1"
                    disabled={!slidesPrompt.trim() || isGenerating}
                  >
                    {isGenerating ? (
                      <div className="flex items-center justify-center">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        <span>Generating...</span>
                      </div>
                    ) : (
                      'Create Presentation'
                    )}
                  </Button>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-4 right-4 z-50 glass-panel p-4 rounded-lg shadow-lg ${
              notification.type === 'success' 
                ? 'bg-green-500/10 border-green-500/30' 
                : 'bg-red-500/10 border-red-500/30'
            }`}
          >
            <p className={notification.type === 'success' ? 'text-green-500' : 'text-red-500'}>
              {notification.message}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DocumentGenerationPanel;