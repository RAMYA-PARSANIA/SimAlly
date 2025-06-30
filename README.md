# SimAlly - Your Simulated Ally Webapp

SimAlly is a comprehensive AI-powered productivity and collaboration platform that combines workspace management, AI assistance, video meetings, interactive games, and professional services into a seamless experience.

## Features

### 🚀 Workspace
- Real-time collaborative chat with AI task detection
- Kanban board for visual task management
- Calendar integration with events and reminders
- Project management with milestones and progress tracking
- Time tracking and reporting

### 🤖 AI Assistant
- Professional productivity support
- Gmail management and organization
- Document generation with AI
- Intelligent workflow assistance

### 📹 Video Meetings
- Schedule and join Google Meet conferences
- Meeting management and organization
- Calendar integration

### 🎮 Interactive Games
- RiddleMeThis - Challenge yourself with AI-powered riddles
- 20 Questions - Classic guessing game in two modes
- Cognitive enhancement through gameplay

### 👨‍⚕️ Professional Services
- Mental Health Support - AI-powered emotional support and guidance
- Legal Consultation - Business legal advice and information

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Node.js, Express
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Custom auth system with secure session management
- **APIs**: Google (Gmail, Calendar, Meet, Docs), Tavus
- **Real-time**: Supabase Realtime, Socket.io
- **Deployment**: Vercel (frontend), Render (backend)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- Google Cloud Platform account (for Google API integration)
- Tavus account (for AI video interactions)

### Environment Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your API keys and credentials
3. Install dependencies:

```bash
npm install
```

### Development

Run the frontend development server:

```bash
npm run dev
```

Run the backend services:

```bash
npm run backend:all
```

Or run specific backend services:

```bash
npm run backend      # Main API server
npm run backend:ai   # AI assistant service
```

### Deployment

#### Frontend (Vercel)

```bash
npm run build
```

Deploy the `dist` directory to Vercel.

#### Backend (Render)

Deploy the `server` directory to Render as a Web Service.

## Project Structure

```
simally-webapp/
├── public/             # Static assets
├── server/             # Backend services
│   ├── app.js          # Main Express server
│   ├── ai-assistant.js # AI assistant service
│   ├── google-api.js   # Google API integration
│   └── ...
├── src/
│   ├── components/     # React components
│   ├── contexts/       # React contexts
│   ├── lib/            # Utility functions
│   ├── pages/          # Page components
│   ├── services/       # API service functions
│   ├── types/          # TypeScript type definitions
│   ├── App.tsx         # Main App component
│   └── main.tsx        # Entry point
├── supabase/           # Supabase migrations and functions
└── ...
```

## Security Features

- End-to-end encryption for sensitive data
- Session-specific tokens with automatic expiration
- Secure data isolation
- Row-level security in database
- Comprehensive audit logging

## License

This project is proprietary and confidential.

## Acknowledgements

- [React](https://reactjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Supabase](https://supabase.io/)
- [Framer Motion](https://www.framer.com/motion/)
- [Lucide Icons](https://lucide.dev/)
- [Tavus](https://tavus.io/)
