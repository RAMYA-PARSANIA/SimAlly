import React, { useState } from 'react';
import { Mail, Lock, AlertCircle } from 'lucide-react';

interface LoginScreenProps {
  onSignIn: () => Promise<void>;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onSignIn }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await onSignIn();
    } catch (err) {
      setError('Failed to sign in. Please check your credentials and try again.');
      console.error('Sign in error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <Mail className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Gmail Client</h1>
            <p className="text-gray-600">
              Connect your Gmail account to manage and search your emails
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <Lock className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-yellow-800 mb-1">Setup Required</h3>
                <p className="text-sm text-yellow-700">
                  To use this app, you'll need to set up Google OAuth2 credentials. 
                  Please add your <code className="bg-yellow-100 px-1 rounded">VITE_GOOGLE_CLIENT_ID</code> and{' '}
                  <code className="bg-yellow-100 px-1 rounded">VITE_GOOGLE_API_KEY</code> environment variables.
                </p>
                <p className="text-sm text-yellow-700 mt-2">
                  <strong>Note:</strong> This app now requires Gmail modification permissions to enable email deletion.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleSignIn}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Connecting...' : 'Sign in with Google'}
          </button>

          <p className="mt-4 text-xs text-gray-500 text-center">
            This app requires modify access to your Gmail account to enable email deletion. 
            Your data is processed locally and never stored on our servers.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;