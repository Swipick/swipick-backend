"use client";

import React, { useEffect } from 'react';

type ToastProps = {
  message: string;
  onClose: () => void;
  variant?: 'default' | 'lozenge';
};

export function Toast({ message, onClose, variant = 'default' }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 2000);
    return () => clearTimeout(t);
  }, [onClose]);

  if (variant === 'lozenge') {
    return (
      <div className="fixed bottom-[113px] left-1/2 -translate-x-1/2 z-[1000] w-[80%]">
        <div
          className="mx-auto rounded-full px-4 py-2 shadow flex items-center justify-between gap-3"
          style={{ backgroundColor: '#A9BA9D', color: '#043927' }}
        >
          <span className="whitespace-pre-line break-words text-xs leading-snug text-center flex-1">
            {message}
          </span>
          <button
            aria-label="Chiudi"
            title="Chiudi"
            onClick={onClose}
            className="shrink-0 inline-flex items-center justify-center rounded-full px-2 py-1 text-[11px] font-semibold hover:opacity-80"
            style={{ backgroundColor: 'rgba(4,57,39,0.08)', color: '#043927' }}
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-[88px] left-1/2 -translate-x-1/2 bg-black text-white text-sm px-3 py-2 rounded-full shadow z-[1000]">
      <div className="flex items-center gap-3">
        <span className="block text-center whitespace-pre-line">{message}</span>
        <button
          aria-label="Chiudi"
          title="Chiudi"
          onClick={onClose}
          className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs"
        >
          ×
        </button>
      </div>
    </div>
  );
}
