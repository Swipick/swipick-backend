import React from 'react';
import Image from 'next/image';
import { resolveTeamLogo } from '@/lib/club-logos';

interface TeamLogoProps {
  src?: string;
  alt: string;
  teamName?: string; // Add optional team name for logo resolution
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function TeamLogo({ src, alt, teamName, size = 'md', className = '' }: TeamLogoProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-[135px] h-[135px]',
  };

  // Use centralized logo resolution (mapping function as primary source)
  const logoPath = resolveTeamLogo(teamName, src);

  if (!logoPath) {
    // Fallback to placeholder with team initial
    const initial = teamName?.charAt(0) || alt.charAt(0);
    return (
      <div className={`${sizeClasses[size]} ${className} bg-purple-200 rounded-full flex items-center justify-center`}>
        <span className="text-purple-600 font-bold text-lg">
          {initial}
        </span>
      </div>
    );
  }

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      <Image
        src={logoPath}
        alt={alt}
        fill
        className="object-contain"
        sizes="(max-width: 768px) 135px, 135px"
      />
    </div>
  );
}
