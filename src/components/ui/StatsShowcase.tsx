import React, { useEffect, useState, useRef } from 'react';

interface StatItem {
  value: string;
  label: string;
  suffix?: string;
  prefix?: string;
}

interface StatsShowcaseProps {
  stats: StatItem[];
  title?: string;
  subtitle?: string;
  className?: string;
}

const StatsShowcase: React.FC<StatsShowcaseProps> = ({
  stats,
  title = "Trusted by Industry Leaders",
  subtitle = "Powering productivity for teams worldwide",
  className = ""
}) => {
  const [inView, setInView] = useState(false);
  const [animatedValues, setAnimatedValues] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          animateNumbers();
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  const animateNumbers = () => {
    stats.forEach((stat, index) => {
      const numericValue = parseInt(stat.value.replace(/[^\d]/g, ''));
      if (isNaN(numericValue)) {
        setAnimatedValues(prev => {
          const newValues = [...prev];
          newValues[index] = stat.value;
          return newValues;
        });
        return;
      }

      let startValue = 0;
      const duration = 2000;
      const increment = numericValue / (duration / 16);

      const timer = setInterval(() => {
        startValue += increment;
        if (startValue >= numericValue) {
          startValue = numericValue;
          clearInterval(timer);
        }

        setAnimatedValues(prev => {
          const newValues = [...prev];
          newValues[index] = Math.floor(startValue).toLocaleString();
          return newValues;
        });
      }, 16);
    });
  };

  return (
    <section className={`section-spacing container-padding ${className}`}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 reveal">
          <h2 className="text-3xl md:text-4xl font-bold gradient-gold-silver mb-6">
            {title}
          </h2>
          <p className="text-lg text-secondary max-w-3xl mx-auto">
            {subtitle}
          </p>
        </div>

        <div 
          ref={ref}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto"
        >
          {stats.map((stat, index) => (
            <div
              key={index}
              className={`text-center p-8 glass-card-enhanced reveal-scale transition-all duration-500 ${
                inView ? 'revealed' : ''
              }`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="mb-4">
                <span className="text-4xl md:text-5xl font-bold gradient-gold-silver block">
                  {stat.prefix || ''}{animatedValues[index] || '0'}{stat.suffix || ''}
                </span>
              </div>
              <p className="text-secondary font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsShowcase;
