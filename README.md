# SimAlly

SimAlly is a comprehensive AI-powered productivity platform that combines workspace collaboration, AI assistance, video meetings, and interactive games into a unified experience.

## Features

### Workspace
- Real-time collaborative chat with AI task detection
- Automatic task creation from conversations
- Calendar integration for scheduling
- Project management with task assignments
- Channel-based communication (public, private, DMs)

### AI Assistant
- Gmail integration with secure token management
- Document generation capabilities
- Smart insights for productivity
- Natural language processing for task creation
- Email management and organization

### Video Meetings
- Google Meet integration
- Meeting creation and joining
- Shareable meeting links
- HD video and audio quality
- Meeting controls (mute, video toggle, etc.)

### Interactive Games
- AI-powered riddles and brain teasers
- 20 Questions game with AI
- Cognitive enhancement through gameplay
- Video-based interactive experiences

## Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Node.js, Express
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Custom secure authentication system
- **Real-time**: Socket.IO
- **Video**: Google Meet integration
- **AI**: Integration with various AI services

## Getting Started

### Prerequisites
- Node.js (v16+)
- npm or yarn
- Supabase account

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/simally.git
cd simally
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
```
Edit the `.env` file with your Supabase credentials and other API keys.

4. Start the development server
```bash
npm run dev
```

5. Start the backend server
```bash
npm run backend
```

## Project Structure

```
simally/
├── src/                  # Frontend source code
│   ├── components/       # React components
│   ├── contexts/         # React contexts
│   ├── lib/              # Utility functions and API clients
│   ├── pages/            # Page components
│   └── types/            # TypeScript type definitions
├── server/               # Backend server code
│   ├── app.js            # Main Express server
│   ├── ai-assistant.js   # AI assistant functionality
│   └── workspace-api.js  # Workspace API endpoints
├── supabase/             # Supabase migrations and configuration
│   └── migrations/       # Database migrations
└── public/               # Static assets
```

## Security Features

SimAlly implements several security measures:

- End-to-end encryption for sensitive data
- Session-specific tokens with automatic expiration
- Secure token storage with encryption
- Row-level security in the database
- CORS protection
- XSS prevention

## License

MIT

## Acknowledgments

- Supabase for the database infrastructure
- Google for Meet integration
- All open-source libraries used in this project