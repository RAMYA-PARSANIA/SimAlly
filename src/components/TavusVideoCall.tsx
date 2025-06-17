import React, { useEffect, useRef, useState } from 'react';
import DailyIframe from '@daily-co/daily-js';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';

interface TavusVideoCallProps {
  meetingUrl: string;
  onLeave: () => void;
}

const getOrCreateCallObject = () => {
  // Use a property on window to store the singleton
  if (!window._dailyCallObject) {
    window._dailyCallObject = DailyIframe.createCallObject();
  }
  return window._dailyCallObject;
};

const TavusVideoCall: React.FC<TavusVideoCallProps> = ({ meetingUrl, onLeave }) => {
  const callRef = useRef<any>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<any>({});
  const [localParticipant, setLocalParticipant] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only create or get one call object per page
    const call = getOrCreateCallObject();
    callRef.current = call;

    // Join meeting
    const joinMeeting = async () => {
      try {
        await call.join({ url: meetingUrl });
        setIsConnected(true);
      } catch (err) {
        console.error('Failed to join meeting:', err);
        setError('Failed to connect to the meeting. Please try again.');
      }
    };

    joinMeeting();

    // Handle participants
    const updateParticipants = () => {
      const participants = call.participants();
      const remotes: any = {};
      let local = null;

      Object.entries(participants).forEach(([id, p]: [string, any]) => {
        if (id === 'local') {
          local = p;
        } else {
          remotes[id] = p;
        }
      });

      setRemoteParticipants(remotes);
      setLocalParticipant(local);
    };

    // Event listeners
    call.on('joined-meeting', () => {
      setIsConnected(true);
      updateParticipants();
    });

    call.on('participant-joined', updateParticipants);
    call.on('participant-updated', updateParticipants);
    call.on('participant-left', updateParticipants);

    call.on('error', (error: any) => {
      console.error('Daily call error:', error);
      setError('Connection error occurred');
    });

    // Cleanup
    return () => {
      if (call && call.meetingState() !== 'left') {
        call.leave();
      }
    };
  }, [meetingUrl]);

  // Attach remote video and audio tracks
  useEffect(() => {
    Object.entries(remoteParticipants).forEach(([id, p]: [string, any]) => {
      // Video
      const videoEl = document.getElementById(`remote-video-${id}`) as HTMLVideoElement;
      if (videoEl && p.tracks?.video && p.tracks.video.state === 'playable' && p.tracks.video.persistentTrack) {
        videoEl.srcObject = new MediaStream([p.tracks.video.persistentTrack]);
      }
      
      // Audio
      const audioEl = document.getElementById(`remote-audio-${id}`) as HTMLAudioElement;
      if (audioEl && p.tracks?.audio && p.tracks.audio.state === 'playable' && p.tracks.audio.persistentTrack) {
        audioEl.srcObject = new MediaStream([p.tracks.audio.persistentTrack]);
      }
    });
  }, [remoteParticipants]);

  const toggleMute = () => {
    if (callRef.current) {
      callRef.current.setLocalAudio(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (callRef.current) {
      callRef.current.setLocalVideo(!isVideoOff);
      setIsVideoOff(!isVideoOff);
    }
  };

  const handleLeave = () => {
    if (callRef.current && callRef.current.meetingState() !== 'left') {
      callRef.current.leave();
    }
    onLeave();
  };

  if (error) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="glass-panel rounded-2xl p-8 max-w-md mx-auto text-center">
          <h3 className="text-xl font-bold text-primary mb-4">Connection Error</h3>
          <p className="text-secondary mb-6">{error}</p>
          <button
            onClick={handleLeave}
            className="premium-button px-6 py-3 rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="glass-panel rounded-2xl p-8 max-w-md mx-auto text-center">
          <div className="animate-spin w-8 h-8 border-2 border-gold-text border-t-transparent rounded-full mx-auto mb-4"></div>
          <h3 className="text-xl font-bold text-primary mb-2">Connecting to Game...</h3>
          <p className="text-secondary">Please wait while we set up your riddle session</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary flex flex-col">
      {/* Video Area */}
      <div className="flex-1 p-4">
        <div className="max-w-6xl mx-auto h-full">
          {/* Remote Participants (Tavus Avatar) */}
          <div className="grid grid-cols-1 gap-4 h-full">
            {Object.entries(remoteParticipants).map(([id, p]: [string, any]) => (
              <div
                key={id}
                className="relative glass-panel rounded-2xl overflow-hidden aspect-video bg-gradient-to-br from-purple-500/10 to-blue-500/10"
              >
                <video
                  id={`remote-video-${id}`}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <audio id={`remote-audio-${id}`} autoPlay playsInline />
                <div className="absolute bottom-4 left-4 glass-panel px-3 py-2 rounded-lg">
                  <span className="text-primary font-medium">
                    {p.user_name || 'Riddle Master'}
                  </span>
                </div>
              </div>
            ))}
            
            {/* Show placeholder if no remote participants yet */}
            {Object.keys(remoteParticipants).length === 0 && (
              <div className="relative glass-panel rounded-2xl overflow-hidden aspect-video bg-gradient-to-br from-purple-500/10 to-blue-500/10 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-pulse w-16 h-16 bg-gradient-gold-silver rounded-full mx-auto mb-4"></div>
                  <p className="text-primary font-medium">Waiting for Riddle Master...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="glass-panel border-t silver-border p-4">
        <div className="max-w-6xl mx-auto flex justify-center items-center space-x-4">
          <button
            onClick={toggleMute}
            className={`glass-panel p-4 rounded-full glass-panel-hover transition-all ${
              isMuted ? 'bg-red-500/20 border-red-500/50' : ''
            }`}
          >
            {isMuted ? (
              <MicOff className="w-6 h-6 text-red-400" />
            ) : (
              <Mic className="w-6 h-6 text-primary" />
            )}
          </button>

          <button
            onClick={toggleVideo}
            className={`glass-panel p-4 rounded-full glass-panel-hover transition-all ${
              isVideoOff ? 'bg-red-500/20 border-red-500/50' : ''
            }`}
          >
            {isVideoOff ? (
              <VideoOff className="w-6 h-6 text-red-400" />
            ) : (
              <Video className="w-6 h-6 text-primary" />
            )}
          </button>

          <button
            onClick={handleLeave}
            className="glass-panel p-4 rounded-full glass-panel-hover bg-red-500/20 border-red-500/50 hover:bg-red-500/30"
          >
            <PhoneOff className="w-6 h-6 text-red-400" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TavusVideoCall;