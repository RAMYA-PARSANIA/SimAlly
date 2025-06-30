import { useEffect } from 'react';

export const useScrollReveal = () => {
  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          
          // Handle staggered children animations
          if (entry.target.classList.contains('stagger-children')) {
            const children = entry.target.children;
            Array.from(children).forEach((child, index) => {
              setTimeout(() => {
                child.classList.add('revealed');
              }, index * 100);
            });
          }
        }
      });
    }, observerOptions);

    // Observe all elements with reveal classes
    const revealSelectors = [
      '.reveal',
      '.reveal-scale', 
      '.reveal-left', 
      '.reveal-right',
      '.stagger-children'
    ];
    
    revealSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => observer.observe(el));
    });

    return () => {
      revealSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => observer.unobserve(el));
      });
    };
  }, []);
};

export default useScrollReveal;
