import React from 'react';

interface GradientBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

export default function GradientBackground({ children, className = '' }: GradientBackgroundProps) {
  return (
    <div 
      className={`min-h-screen w-full bg-gradient-to-t from-purple-600 via-purple-700 to-purple-500 ${className}`}
      style={{
        backgroundImage: 'linear-gradient(to top, #8B5CF6, #7C3AED, #A855F7)',
      }}
    >
      {children}
    </div>
  );
}
