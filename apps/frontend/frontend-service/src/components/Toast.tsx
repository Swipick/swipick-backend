"use client";

import React, { useEffect } from 'react';

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-[88px] left-1/2 -translate-x-1/2 bg-black text-white text-sm px-4 py-2 rounded-full shadow z-[1000] text-center">
      {message}
    </div>
  );
}
