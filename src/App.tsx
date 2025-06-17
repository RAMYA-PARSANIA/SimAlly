import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import AssistantPage from './pages/AssistantPage';
import WellnessPage from './pages/WellnessPage';
import StudyCoachPage from './pages/StudyCoachPage';
import GameModePage from './pages/GameModePage';

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
              <Route path="/wellness" element={<WellnessPage />} />
              <Route path="/study-coach" element={<StudyCoachPage />} />
              <Route path="/game-mode" element={<GameModePage />} />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;