/**
 * CompletionVeilModal Component
 * Modal overlay shown when week is completed
 */

import React from 'react';

interface CompletionVeilModalProps {
  isOpen: boolean;
  selectedWeek: number;
  onGoToResults: () => void;
  className?: string;
}

export function CompletionVeilModal({
  isOpen,
  selectedWeek,
  onGoToResults,
  className = '',
}: CompletionVeilModalProps) {
  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 pointer-events-none ${className}`}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      
      {/* Modal */}
      <div className="fixed top-[calc(env(safe-area-inset-top)+12px)] left-1/2 -translate-x-1/2 w-[88%] max-w-md pointer-events-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-6 text-center">
          <h3 className="text-xl font-semibold text-black mb-2">
            Giornata completata
          </h3>
          
          <p className="text-sm text-gray-700 mb-5">
            Hai già effettuato 10 scelte per questa settimana. Vai alla pagina Risultati per rivelare e vedere l'andamento.
          </p>
          
          <div className="flex gap-3 justify-center">
            <button
              onClick={onGoToResults}
              className="px-5 py-2 rounded-md bg-purple-600 text-white font-medium hover:bg-purple-700 transition-colors"
            >
              Vai a Risultati
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}