declare module '@daily-co/daily-react' {
  export const DailyProvider: React.FC<{ callObject: any; children: React.ReactNode }>;
  export function useDaily(): any;
  export function useLocalParticipant(): any;
  export function useParticipantIds(): string[];
  export function useVideoTrack(participantId: string): any;
  export function useAudioTrack(participantId: string): any;
  export const DailyVideo: React.FC<{
    sessionId: string;
    type: 'video' | 'screenVideo';
    automirror?: boolean;
    className?: string;
  }>;
}

declare global {
  interface Window {
    _dailyCallObject?: any;
  }
}

export {};