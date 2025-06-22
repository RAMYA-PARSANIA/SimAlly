import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import AssistantPage from './pages/AssistantPage';
import GameModePage from './pages/GameModePage';
import MeetingPage from './pages/MeetingPage';
import WorkspacePage from './pages/WorkspacePage';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="min-h-screen transition-colors duration-500 bg-primary">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/assistant" element={<AssistantPage />} />
              <Route path="/game-mode" element={<GameModePage />} />
              <Route path="/meetings" element={<MeetingPage />} />
              <Route path="/workspace" element={<WorkspacePage />} />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;