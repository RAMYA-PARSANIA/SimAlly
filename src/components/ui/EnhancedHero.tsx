import React, { useEffect, useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import Button from './Button';
import AnimatedBackground from './AnimatedBackground';

interface EnhancedHeroProps {
  title: string;
  subtitle: string;
  description: string;
  ctaText: string;
  onCtaClick: () => void;
}

const EnhancedHero: React.FC<EnhancedHeroProps> = ({
  title,
  subtitle,
  description,
  ctaText,
  onCtaClick
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animations after component mounts
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="relative pt-32 pb-20 container-padding overflow-hidden">
      {/* Animated Background */}
      <AnimatedBackground variant="dots" />
      
      <div className="max-w-7xl mx-auto relative">
        <div className="text-center max-w-5xl mx-auto">
          {/* Main Title with Enhanced Animation */}
          <div className={`transition-all duration-1000 ${isVisible ? 'animate-heroTextReveal' : 'opacity-0'}`}>
            <h1 className="text-5xl md:text-6xl lg:text-8xl font-bold mb-6 gradient-gold-silver relative">
              {title}
            </h1>
          </div>
          
          {/* Subtitle with Staggered Animation */}
          <div className={`transition-all duration-5000 delay-5000 ${isVisible ? 'animate-heroTextReveal' : 'opacity-0'}`}>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 gradient-gold-silver ">
              {subtitle}
            </h2>
          </div>
          
          {/* Description with Fade In */}
          <div className={`transition-all duration-1000 delay-500 ${isVisible ? 'animate-fadeInUp' : 'opacity-0'}`}>
            <p className="text-lg gold-text font-medium mb-6">
              Transform your workflow with AI that understands, assists, and elevates every interaction.
            </p>
          </div>
          
          <div className={`transition-all duration-1000 delay-700 ${isVisible ? 'animate-fadeInUp' : 'opacity-0'}`}>
            <p className="text-base text-secondary max-w-3xl mx-auto mb-12 leading-relaxed">
              {description}
            </p>
          </div>

          {/* CTA Button with Special Animation */}
          <div className={`transition-all duration-1000 delay-900 ${isVisible ? 'animate-fadeInScale' : 'opacity-0'}`}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Button
                onClick={onCtaClick}
                variant="premium"
                size="lg"
                className="inline-flex items-center space-x-2 group relative overflow-hidden"
              >
                <span className="relative z-10">{ctaText}</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200 relative z-10" />
                
                {/* Button hover effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 opacity-20" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom wave decoration */}
      <div className="absolute bottom-0 left-0 w-full">
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-12">
          <path 
            d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z" 
            fill="var(--accent-gold)" 
            opacity="0.1"
          />
        </svg>
      </div>
    </section>
  );
};

export default EnhancedHero;
