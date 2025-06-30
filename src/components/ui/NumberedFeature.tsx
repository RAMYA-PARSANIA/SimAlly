import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface NumberedFeatureProps {
  number: string;
  title: string;
  description: string;
  icon?: LucideIcon;
  className?: string;
  delay?: number;
}

const NumberedFeature: React.FC<NumberedFeatureProps> = ({
  number,
  title,
  description,
  icon: Icon,
  className,
  delay = 0
}) => {
  return (
    <div 
      className={cn("reveal glass-card-enhanced p-8 h-full group cursor-pointer relative overflow-hidden", className)}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {/* Background gradient on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-blue-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="flex items-start space-x-6 relative z-10">
        <div className="flex-shrink-0">
          <div className="feature-number animate-numberGlow group-hover:scale-110 transition-transform duration-300 relative">
            {number}
            {/* Rotating border effect */}
            <div className="absolute inset-0 rounded-full border-2 border-transparent bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-spin-slow" 
                 style={{ clipPath: 'inset(0 round 50%)' }} />
          </div>
        </div>
        
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-4">
            {Icon && (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg">
                <Icon className="w-6 h-6 text-white" />
              </div>
            )}
            <h3 className="text-xl font-bold text-primary group-hover:gold-text transition-colors duration-300">
              {title}
            </h3>
          </div>
          
          <p className="text-secondary leading-relaxed group-hover:text-primary transition-colors duration-300">
            {description}
          </p>
          
          {/* Subtle bottom accent line */}
          <div className="w-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 group-hover:w-full transition-all duration-500 mt-4" />
        </div>
      </div>
      
      {/* Corner decoration */}
      <div className="absolute top-4 right-4 w-2 h-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </div>
  );
};

export default NumberedFeature;
