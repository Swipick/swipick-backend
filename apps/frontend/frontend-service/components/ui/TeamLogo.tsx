import React from 'react';
import Image from 'next/image';

interface TeamLogoProps {
  src: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function TeamLogo({ src, alt, size = 'md', className = '' }: TeamLogoProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-[135px] h-[135px]',
  };

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        className="object-contain"
        sizes="(max-width: 768px) 135px, 135px"
      />
    </div>
  );
}
