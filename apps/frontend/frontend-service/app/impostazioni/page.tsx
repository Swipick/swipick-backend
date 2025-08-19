'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ImpostazioniPage() {
  const router = useRouter();

  // Goal 0 placeholders
  const user = useMemo(() => ({
    name: 'Marco Magnocavallo',
    nickname: 'Marco Magnocavallo',
    email: 'marco@magno.me',
  }), []);

  // Notification toggles (local state only)
  const [notifResults, setNotifResults] = useState(true);
  const [notifMatches, setNotifMatches] = useState(true);
  const [notifGoals, setNotifGoals] = useState(true);

  return (
    <div className="min-h-screen bg-white pb-8 pt-[calc(env(safe-area-inset-top)+120px)]">
      {/* Fixed header: centered bold title, bold back arrow */}
      <div className="fixed top-0 left-0 right-0 bg-white">
        <div className="relative h-[165px] flex items-center justify-center px-4">
          <button
            aria-label="Indietro"
            onClick={() => router.back()}
            className="absolute left-4 p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 text-black"
            title="Indietro"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6 9 12l6 6" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-black">Impostazioni</h1>
        </div>
      </div>

      <div className="px-5">
        {/* Subheader: Account */}
        <div className="text-sm font-semibold text-gray-800 mt-2 mb-1">Account</div>

        {/* Account rows */}
        <div>
          {/* Email (read-only, no arrow) */}
          <div className="py-5.5 flex items-center justify-between">
            <div className="text-gray-800">email</div>
            <div className="text-gray-500 text-sm">{user.email}</div>
          </div>

          {/* Username (chevron) */}
          <button className="w-full py-5.5 flex items-center justify-between">
            <div className="text-gray-800">username</div>
            <div className="flex items-center gap-2">
              <div className="text-gray-500 text-sm truncate max-w-[60vw] text-right">{user.nickname}</div>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5 text-black" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </div>
          </button>

          {/* Password (chevron) */}
          <button className="w-full py-5.5 flex items-center justify-between">
            <div className="text-gray-800">password</div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5 text-black" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>

          {/* Immagine profilo (chevron) */}
          <button className="w-full py-5.5 flex items-center justify-between">
            <div className="text-gray-800">immagine profilo</div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5 text-black" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>

        {/* Subheader: Notifiche */}
        <div className="text-sm font-semibold text-gray-800 mt-6 mb-1">Notifiche</div>

        {/* Notification rows */}
        <div>
          {/* Risultati */}
          <div className="py-3.5 flex items-center justify-between">
            <div>
              <div className="text-gray-800">Risultati</div>
              <div className="text-xs text-gray-500">Scopri il tuo punteggio a fine giornata</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notifResults}
                onChange={(e) => setNotifResults(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-purple-600 transition-colors"></div>
              <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform peer-checked:translate-x-5"></div>
            </label>
          </div>

          {/* Partite */}
          <div className="py-1.5 flex items-center justify-between">
            <div>
              <div className="text-gray-800">Partite</div>
              <div className="text-xs text-gray-500">Ti avvisiamo al 90°</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notifMatches}
                onChange={(e) => setNotifMatches(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-purple-600 transition-colors"></div>
              <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform peer-checked:translate-x-5"></div>
            </label>
          </div>

          {/* Gol */}
          <div className="py-1.5 flex items-center justify-between">
            <div>
              <div className="text-gray-800">Gol</div>
              <div className="text-xs text-gray-500">Ad ogni marcatura sarai il primo a saperlo</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notifGoals}
                onChange={(e) => setNotifGoals(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-purple-600 transition-colors"></div>
              <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform peer-checked:translate-x-5"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
