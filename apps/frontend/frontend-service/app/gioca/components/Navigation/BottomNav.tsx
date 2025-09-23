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
  selectedWeek: number | null;
  onNavigateToResults: () => void;
  onNavigateToGioca?: () => void;
  onNavigateToProfile: () => void;
  activeTab?: 'gioca' | 'risultati' | 'profilo';
  className?: string;
}

export function BottomNav({
  currentMode,
  selectedWeek,
  onNavigateToResults,
  onNavigateToGioca,
  onNavigateToProfile,
  activeTab = 'gioca',
  className = '',
}: BottomNavProps) {
  return (
    <div className={`fixed bottom-0 left-0 right-0 bg-white border-t pb-[max(env(safe-area-inset-bottom),0px)] ${className}`}>
      <div className="flex">
        {/* Risultati */}
        <button
          onClick={onNavigateToResults}
          className={`flex-1 text-center py-4 hover:bg-gray-50 transition-colors ${activeTab === 'risultati' ? 'border-b-2 border-[#6f49ff]' : ''}`}
        >
          <div className={`mb-1 ${activeTab === 'risultati' ? 'text-[#6f49ff]' : 'text-gray-500'}`}>
            <FaMedal className="w-6 h-6 mx-auto" />
          </div>
          <span className={`text-xs ${activeTab === 'risultati' ? 'text-[#6f49ff] font-medium' : 'text-black'}`}>Risultati</span>
        </button>

        {/* Gioca */}
        <button
          onClick={onNavigateToGioca}
          className={`flex-1 text-center py-4 hover:bg-gray-50 transition-colors ${activeTab === 'gioca' ? 'border-b-2 border-[#6f49ff]' : ''}`}
        >
          <div className={`mb-1 ${activeTab === 'gioca' ? 'text-[#6f49ff]' : 'text-gray-500'}`}>
            <RiFootballLine className="w-6 h-6 mx-auto" />
          </div>
          <span className={`text-xs ${activeTab === 'gioca' ? 'text-[#6f49ff] font-medium' : 'text-black'}`}>Gioca</span>
        </button>

        {/* Profilo */}
        <button
          onClick={onNavigateToProfile}
          className={`flex-1 text-center py-4 hover:bg-gray-50 transition-colors ${activeTab === 'profilo' ? 'border-b-2 border-[#6f49ff]' : ''}`}
        >
          <div className={`mb-1 ${activeTab === 'profilo' ? 'text-[#6f49ff]' : 'text-gray-500'}`}>
            <BsFillFilePersonFill className="w-6 h-6 mx-auto" />
          </div>
          <span className={`text-xs ${activeTab === 'profilo' ? 'text-[#6f49ff] font-medium' : 'text-black'}`}>Profilo</span>
        </button>
      </div>
    </div>
  );
}
