import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Video, X, Users, Calendar, Clock, ExternalLink, Copy, CheckCircle, Loader2, FileText, Download } from 'lucide-react';
import GlassCard from './ui/GlassCard';
import Button from './ui/Button';
import { meetingService } from '../lib/meetingService';

interface MeetingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingId: string;
  userId: string;
}

const MeetingDetailModal: React.FC<MeetingDetailModalProps> = ({ 
  isOpen, 
  onClose, 
  meetingId,
  userId
}) => {
  const [meeting, setMeeting] = useState<any>(null);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [transcripts, setTranscripts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'recordings' | 'transcripts'>('details');

  useEffect(() => {
    if (isOpen && meetingId) {
      loadMeetingDetails();
    }
  }, [isOpen, meetingId, userId]);

  const loadMeetingDetails = async () => {
    setLoading(true);
    try {
      const meetingData = await meetingService.getMeeting(meetingId, userId);
      setMeeting(meetingData);
      
      // If there's a conference record ID, load recordings and transcripts
      if (meetingData.conferenceRecordId) {
        try {
          const recordingsData = await meetingService.getRecordings(meetingData.conferenceRecordId, userId);
          setRecordings(recordingsData);
        } catch (error) {
          console.error('Failed to load recordings:', error);
        }
        
        try {
          const transcriptsData = await meetingService.getTranscripts(meetingData.conferenceRecordId, userId);
          setTranscripts(transcriptsData);
        } catch (error) {
          console.error('Failed to load transcripts:', error);
        }
      }
    } catch (error) {
      console.error('Failed to load meeting details:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyMeetingLink = async () => {
    if (!meeting) return;
    
    try {
      await navigator.clipboard.writeText(meeting.meetingUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy meeting link:', error);
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <GlassCard className="flex flex-col h-full" goldBorder>
          {loading ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-secondary mx-auto mb-4" />
                <p className="text-secondary">Loading meeting details...</p>
              </div>
            </div>
          ) : meeting ? (
            <>
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b silver-border">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                    <Video className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-primary">{meeting.title}</h2>
                    <div className="flex items-center space-x-2 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        meeting.status === 'active' ? 'text-green-500 bg-green-500/10' :
                        meeting.status === 'ended' ? 'text-gray-500 bg-gray-500/10' :
                        'text-red-500 bg-red-500/10'
                      }`}>
                        {meeting.status}
                      </span>
                      <span className="text-secondary">{meeting.meetingCode}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="text-secondary hover:text-primary p-2 rounded-lg glass-panel glass-panel-hover"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b silver-border">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`px-4 py-3 text-sm font-medium ${
                    activeTab === 'details' 
                      ? 'text-primary border-b-2 border-gold-border' 
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  Details
                </button>
                <button
                  onClick={() => setActiveTab('recordings')}
                  className={`px-4 py-3 text-sm font-medium ${
                    activeTab === 'recordings' 
                      ? 'text-primary border-b-2 border-gold-border' 
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  Recordings
                </button>
                <button
                  onClick={() => setActiveTab('transcripts')}
                  className={`px-4 py-3 text-sm font-medium ${
                    activeTab === 'transcripts' 
                      ? 'text-primary border-b-2 border-gold-border' 
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  Transcripts
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'details' && (
                  <div className="space-y-6">
                    {meeting.description && (
                      <div>
                        <h3 className="text-lg font-medium text-primary mb-2">Description</h3>
                        <p className="text-secondary">{meeting.description}</p>
                      </div>
                    )}

                    <div>
                      <h3 className="text-lg font-medium text-primary mb-3">Meeting Information</h3>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-3">
                          <Calendar className="w-5 h-5 text-secondary" />
                          <div>
                            <p className="text-sm font-medium text-primary">Created</p>
                            <p className="text-sm text-secondary">{formatDateTime(meeting.created_at)}</p>
                          </div>
                        </div>
                        
                        {meeting.startTime && (
                          <div className="flex items-center space-x-3">
                            <Clock className="w-5 h-5 text-secondary" />
                            <div>
                              <p className="text-sm font-medium text-primary">Scheduled Time</p>
                              <p className="text-sm text-secondary">
                                {formatDateTime(meeting.startTime)}
                                {meeting.endTime && ` - ${formatDateTime(meeting.endTime)}`}
                              </p>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center space-x-3">
                          <Video className="w-5 h-5 text-secondary" />
                          <div>
                            <p className="text-sm font-medium text-primary">Meeting Link</p>
                            <div className="flex items-center space-x-2">
                              <a 
                                href={meeting.meetingUri} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm text-blue-500 hover:underline truncate max-w-md"
                              >
                                {meeting.meetingUri}
                              </a>
                              <button
                                onClick={copyMeetingLink}
                                className="p-1 hover:bg-surface rounded"
                              >
                                {copied ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                  <Copy className="w-4 h-4 text-secondary" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {meeting.participants && meeting.participants.length > 0 && (
                      <div>
                        <h3 className="text-lg font-medium text-primary mb-3">Participants</h3>
                        <div className="glass-panel rounded-lg p-4">
                          <div className="space-y-2">
                            {meeting.participants.map((participant: any, index: number) => (
                              <div key={index} className="flex items-center space-x-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                                  <span className="text-white text-xs font-bold">
                                    {participant.display_name?.[0] || participant.email[0].toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-primary">
                                    {participant.display_name || participant.email.split('@')[0]}
                                  </p>
                                  <p className="text-xs text-secondary">{participant.email}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Join Button */}
                    <div className="flex justify-center pt-4">
                      <Button
                        onClick={() => window.open(meeting.meetingUri, '_blank')}
                        variant="premium"
                        className="flex items-center space-x-2"
                        disabled={meeting.status !== 'active'}
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Join Meeting</span>
                      </Button>
                    </div>
                  </div>
                )}

                {activeTab === 'recordings' && (
                  <div>
                    <h3 className="text-lg font-medium text-primary mb-4">Recordings</h3>
                    
                    {recordings.length > 0 ? (
                      <div className="space-y-4">
                        {recordings.map((recording, index) => (
                          <div key={index} className="glass-panel rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <Video className="w-5 h-5 text-secondary" />
                                <div>
                                  <p className="text-sm font-medium text-primary">{recording.name || `Recording ${index + 1}`}</p>
                                  {recording.start_time && (
                                    <p className="text-xs text-secondary">
                                      {formatDateTime(recording.start_time)}
                                      {recording.end_time && ` - ${formatDateTime(recording.end_time)}`}
                                    </p>
                                  )}
                                </div>
                              </div>
                              
                              {recording.drive_destination && (
                                <Button
                                  onClick={() => window.open(`https://drive.google.com/file/d/${recording.drive_destination}`, '_blank')}
                                  variant="secondary"
                                  size="sm"
                                  className="flex items-center space-x-2"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>View</span>
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Video className="w-12 h-12 text-secondary mx-auto mb-4 opacity-50" />
                        <p className="text-secondary">No recordings available for this meeting</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'transcripts' && (
                  <div>
                    <h3 className="text-lg font-medium text-primary mb-4">Transcripts</h3>
                    
                    {transcripts.length > 0 ? (
                      <div className="space-y-4">
                        {transcripts.map((transcript, index) => (
                          <div key={index} className="glass-panel rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <FileText className="w-5 h-5 text-secondary" />
                                <div>
                                  <p className="text-sm font-medium text-primary">{transcript.name || `Transcript ${index + 1}`}</p>
                                  {transcript.created_at && (
                                    <p className="text-xs text-secondary">
                                      {formatDateTime(transcript.created_at)}
                                    </p>
                                  )}
                                </div>
                              </div>
                              
                              {transcript.drive_destination && (
                                <Button
                                  onClick={() => window.open(`https://drive.google.com/file/d/${transcript.drive_destination}`, '_blank')}
                                  variant="secondary"
                                  size="sm"
                                  className="flex items-center space-x-2"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>View</span>
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <FileText className="w-12 h-12 text-secondary mx-auto mb-4 opacity-50" />
                        <p className="text-secondary">No transcripts available for this meeting</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <p className="text-secondary">Meeting not found</p>
              </div>
            </div>
          )}
        </GlassCard>
      </motion.div>
    </div>
  );
};

export default MeetingDetailModal;