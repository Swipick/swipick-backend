/**
 * BottomNav Component
 * Fixed bottom navigation bar with Risultati, Gioca, Profilo
 */

import React from 'react';
import { FaMedal } from 'react-icons/fa';
import { RiFootballLine } from 'react-icons/ri';
import { BsFillFilePersonFill } from 'react-icons/bs';
import type { GameMode } from '../../types';

interface BottomNavProps {
  currentMode: GameMode;
  selectedWeek: number;
  onNavigateToResults: () => void;
  onNavigateToProfile: () => void;
  className?: string;
}

export function BottomNav({
  currentMode,
  selectedWeek,
  onNavigateToResults,
  onNavigateToProfile,
  className = '',
}: BottomNavProps) {
  return (
    <div className={`fixed bottom-0 left-0 right-0 bg-white border-t pb-[max(env(safe-area-inset-bottom),0px)] ${className}`}>
      <div className="flex">
        {/* Risultati */}
        <button
          onClick={onNavigateToResults}
          className="flex-1 text-center py-4 hover:bg-gray-50 transition-colors"
        >
          <div className="text-gray-500 mb-1">
            <FaMedal className="w-6 h-6 mx-auto" />
          </div>
          <span className="text-xs text-black">Risultati</span>
        </button>
        
        {/* Gioca (current/active) */}
        <div className="flex-1 text-center py-4 border-b-2 border-purple-600">
          <div className="text-purple-600 mb-1">
            <RiFootballLine className="w-6 h-6 mx-auto" />
          </div>
          <span className="text-xs text-purple-600 font-medium">Gioca</span>
        </div>
        
        {/* Profilo */}
        <button
          onClick={onNavigateToProfile}
          className="flex-1 text-center py-4 hover:bg-gray-50 transition-colors"
        >
          <div className="text-gray-500 mb-1">
            <BsFillFilePersonFill className="w-6 h-6 mx-auto" />
          </div>
          <span className="text-xs text-black">Profilo</span>
        </button>
      </div>
    </div>
  );
}