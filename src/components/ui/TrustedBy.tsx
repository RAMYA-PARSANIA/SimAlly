import React from 'react';

interface TrustedByProps {
  logos: {
    name: string;
    url: string;
    alt: string;
  }[];
}

const TrustedBy: React.FC<TrustedByProps> = ({ logos }) => {
  // Duplicate logos for seamless scrolling
  const duplicatedLogos = [...logos, ...logos];

  return (
    <div className="w-full">
      <div className="text-center mb-12">
        <h3 className="text-sm font-medium text-secondary uppercase tracking-wider mb-4">
          Powered by Industry-Leading Technologies
        </h3>
      </div>
      
      <div className="logo-scroll-container relative">
        <div className="flex animate-logoScroll space-x-16 py-6">
          {duplicatedLogos.map((logo, index) => (
            <div
              key={`${logo.name}-${index}`}
              className="flex-shrink-0 flex items-center justify-center"
            >
              <div className="glass-panel p-4 rounded-lg">
                <img
                  src={logo.url}
                  alt={logo.alt}
                  className="trust-logo max-w-[120px] h-12 object-contain"
                />
              </div>
            </div>
          ))}
        </div>
        
        {/* Gradient overlays for smooth edge effect */}
        <div className="absolute left-0 top-0 w-32 h-full bg-gradient-to-r from-[var(--bg)] to-transparent pointer-events-none z-10"></div>
        <div className="absolute right-0 top-0 w-32 h-full bg-gradient-to-l from-[var(--bg)] to-transparent pointer-events-none z-10"></div>
      </div>
    </div>
  );
};

export default TrustedBy;
