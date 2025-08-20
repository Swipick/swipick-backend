
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/src/contexts/AuthContext';
import { apiClient } from '@/lib/api-client';
import { Toast } from '@/src/components/Toast';
// Firebase storage imports removed: using Neon multipart upload via BFF

export default function ImpostazioniPage() {
  const router = useRouter();
  const { firebaseUser, getAuthToken, logout } = useAuthContext();

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string>('');
  const [nickname, setNickname] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Notification toggles (persisted)
  const [notifResults, setNotifResults] = useState(true);
  const [notifMatches, setNotifMatches] = useState(true);
  const [notifGoals, setNotifGoals] = useState(true);

  const load = useCallback(async () => {
    if (!firebaseUser?.uid) return;
    setLoading(true);
    setError(null);
    try {
      // Resolve backend user by firebase uid
      const resp = await apiClient.getUserByFirebaseUid(firebaseUser.uid) as { data: { id: string; email: string; nickname?: string } };
      const u = resp.data;
      setUserId(u.id);
      setEmail(u.email || firebaseUser.email || '');
      setNickname(u.nickname || '');
      // Fetch preferences
      const prefResp = await apiClient.getUserPreferences(u.id) as { data: { results: boolean; matches: boolean; goals: boolean } };
      const p = prefResp.data;
      setNotifResults(Boolean(p.results));
      setNotifMatches(Boolean(p.matches));
      setNotifGoals(Boolean(p.goals));
    } catch (e) {
      console.error('[impostazioni] load failed', e);
      setError('Errore nel caricamento delle impostazioni');
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) {
      router.push('/login');
      return;
    }
    load();
  }, [firebaseUser, load, router]);

  const optimisticUpdate = async (patch: Partial<{ results: boolean; matches: boolean; goals: boolean }>) => {
    if (!userId) return;
    const prev = { results: notifResults, matches: notifMatches, goals: notifGoals };
    // Apply optimistic state
    if (patch.results !== undefined) setNotifResults(patch.results);
    if (patch.matches !== undefined) setNotifMatches(patch.matches);
    if (patch.goals !== undefined) setNotifGoals(patch.goals);
    try {
      await apiClient.updateUserPreferences(userId, patch);
  setToast('Preferenze aggiornate');
  setTimeout(() => setToast(null), 1800);
    } catch (e) {
      console.error('[impostazioni] update prefs failed', e);
      // rollback
      setNotifResults(prev.results);
      setNotifMatches(prev.matches);
      setNotifGoals(prev.goals);
      alert('Impossibile aggiornare le preferenze');
    }
  };

    // Client-side image processing removed; server sanitizes with sharp

  const onPickAvatar = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    // Basic client-side validation
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      alert('Formato immagine non supportato. Usa JPEG, PNG o WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) { // 5MB cap
      alert('Immagine troppo grande (max 5MB)');
      return;
    }
    try {
  setUploading(true);
  // Prefer Neon multipart upload (server sanitizes with sharp)
  await apiClient.uploadUserAvatarBytes(userId, file);
      setToast('Avatar aggiornato');
      setTimeout(() => setToast(null), 1800);
    } catch (err) {
      console.error('[impostazioni] avatar upload failed', err);
      alert('Caricamento avatar fallito');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmDelete = async () => {
    if (!userId) return;
    try {
      setDeleting(true);
      const token = await getAuthToken();
      if (!token) {
        alert('Autenticazione richiesta per eliminare l\'account');
        setDeleting(false);
        return;
      }
      await apiClient.deleteAccount(userId, token);
      // Logout locally and redirect to welcome/login
      await logout();
      router.replace('/');
    } catch (err: unknown) {
      console.error('[impostazioni] delete account failed', err);
      const msg = err instanceof Error ? err.message : 'Eliminazione account fallita';
      alert(msg);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-8 pt-[calc(env(safe-area-inset-top)+120px)]">
      {/* Fixed header: centered bold title, bold back arrow */}
      <div className="fixed top-10 left-0 right-0 bg-white">
        <div className="relative h-[125px] flex items-center justify-center px-4">
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

  {/* (moved delete section to the bottom of content) */}

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
          <div className="w-full sm:w-[420px] bg-white rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl">
            <div className="text-base font-semibold text-gray-900 mb-1">Conferma eliminazione</div>
            <p className="text-sm text-gray-600 mb-4">Sei sicuro di voler eliminare definitivamente il tuo account? Questa azione non può essere annullata.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-900 font-medium"
                disabled={deleting}
              >
                Annulla
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-semibold disabled:opacity-60"
                disabled={deleting}
              >
                {deleting ? 'Eliminazione…' : 'Elimina'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="px-5">
        {loading && (
          <div className="text-sm text-gray-500 mb-3">Caricamento…</div>
        )}
        {error && (
          <div className="text-sm text-red-600 mb-3">{error}</div>
        )}
        {/* Subheader: Account */}
        <div className="text-sm font-semibold text-gray-800 mt-2 mb-1">Account</div>

        {/* Account rows */}
        <div>
          {/* Email (read-only, no arrow) */}
          <div className="py-5.5 flex items-center justify-between">
            <div className="text-gray-800">email</div>
            <div className="text-gray-500 text-sm">{email}</div>
          </div>

          {/* Username (chevron) */}
          <button disabled className="w-full py-5.5 flex items-center justify-between opacity-60 cursor-not-allowed">
            <div className="text-gray-800">username</div>
            <div className="flex items-center gap-2">
              <div className="text-gray-500 text-sm truncate max-w-[60vw] text-right">{nickname || '—'}</div>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5 text-black" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </div>
          </button>

          {/* Password (chevron) */}
          <button disabled className="w-full py-5.5 flex items-center justify-between opacity-60 cursor-not-allowed">
            <div className="text-gray-800">password</div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5 text-black" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>

          {/* Immagine profilo (picker) */}
          <button onClick={onPickAvatar} className={`w-full py-5.5 flex items-center justify-between ${uploading ? 'opacity-60 cursor-wait' : ''}`} disabled={uploading}>
            <div className="text-gray-800">immagine profilo</div>
            <div className="flex items-center gap-2">
              {uploading && <span className="text-xs text-gray-500">Caricamento…</span>}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5 text-black" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </div>
          </button>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="user" className="hidden" onChange={onFileChange} />
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
        onChange={(e) => optimisticUpdate({ results: e.target.checked })}
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
        onChange={(e) => optimisticUpdate({ matches: e.target.checked })}
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
        onChange={(e) => optimisticUpdate({ goals: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-purple-600 transition-colors"></div>
              <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform peer-checked:translate-x-5"></div>
            </label>
          </div>
        </div>

        {/* Danger zone: Delete account at bottom, with at least 20px gap after Gol toggle */}
        <div className="mt-5 mb-8">
          <div className="text-sm font-semibold text-gray-800 mb-2">Pericolo</div>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-full py-3 rounded-xl bg-red-600 text-white font-semibold shadow-sm active:scale-[0.99] disabled:opacity-60 tracking-wide"
          >
            ELIMINA ACCOUNT
          </button>
          <p className="text-[11px] text-gray-500 mt-2">Questa azione è irreversibile e rimuoverà il tuo account e la tua cronologia.</p>
        </div>
      </div>
  {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
