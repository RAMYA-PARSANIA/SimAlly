import React from 'react';

interface AnimatedBackgroundProps {
  className?: string;
  variant?: 'dots' | 'grid' | 'waves';
}

const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ 
  className = '', 
  variant = 'dots' 
}) => {
  if (variant === 'dots') {
    return (
      <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
        <div className="absolute inset-0 opacity-20">
          {/* Animated dots pattern */}
          <div className="grid grid-cols-12 gap-8 h-full w-full">
            {Array.from({ length: 48 }).map((_, i) => (
              <div
                key={i}
                className="w-1 h-1 bg-gradient-to-r from-gold-500 to-silver-500 rounded-full animate-backgroundPulse"
                style={{
                  animationDelay: `${i * 0.2}s`,
                  animationDuration: `${3 + (i % 3)}s`
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'grid') {
    return (
      <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path 
                  d="M 40 0 L 0 0 0 40" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="1"
                  className="text-accent-gold"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
      </div>
    );
  }

  // Waves variant
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      <div className="absolute inset-0 opacity-20">
        <svg 
          className="absolute bottom-0 left-0 w-full h-64" 
          viewBox="0 0 1200 120" 
          preserveAspectRatio="none"
        >
          <path 
            d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z" 
            opacity="0.25"
            fill="url(#wave-gradient-1)"
          />
          <path 
            d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z" 
            opacity="0.5"
            fill="url(#wave-gradient-2)"
          />
          <defs>
            <linearGradient id="wave-gradient-1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: 'var(--accent-gold)', stopOpacity: 0.3 }} />
              <stop offset="100%" style={{ stopColor: 'var(--accent-silver)', stopOpacity: 0.1 }} />
            </linearGradient>
            <linearGradient id="wave-gradient-2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: 'var(--accent-silver)', stopOpacity: 0.2 }} />
              <stop offset="100%" style={{ stopColor: 'var(--accent-gold)', stopOpacity: 0.4 }} />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
};

export default AnimatedBackground;
