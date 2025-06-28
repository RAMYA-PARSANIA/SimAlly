import React, { useEffect } from 'react';

const OAuthCallback: React.FC = () => {
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    console.log('OAuth callback received:', { code, error });

    if (code) {
      // For server-side callback, the server will handle the OAuth flow
      // and send a message back to the parent window
      console.log('Authorization code received, processing...');
      
      // Show a message to the user
      const messageElement = document.getElementById('message');
      if (messageElement) {
        messageElement.textContent = 'Authentication successful! Please wait...';
      }
    } else if (error) {
      console.error('OAuth error:', error);
      if (window.opener) {
        window.opener.postMessage({
          type: 'GOOGLE_AUTH_ERROR',
          error: error
        }, window.location.origin);
        window.close();
      } else {
        // If no opener, redirect to login page
        window.location.href = '/';
      }
    } else {
      // No code or error, this shouldn't happen
      console.error('No authorization code or error received');
      if (window.opener) {
        window.opener.postMessage({
          type: 'GOOGLE_AUTH_ERROR',
          error: 'No authorization code received'
        }, window.location.origin);
        window.close();
      } else {
        window.location.href = '/';
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p id="message" className="text-gray-600">Processing authentication...</p>
      </div>
    </div>
  );
};

export default OAuthCallback;