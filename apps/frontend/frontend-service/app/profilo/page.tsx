'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/src/contexts/AuthContext';
import { apiClient } from '@/lib/api-client';
import { FaMedal } from 'react-icons/fa';
import { RiFootballLine } from 'react-icons/ri';
import { BsFillFilePersonFill } from 'react-icons/bs';

// Minimal shared types (mirror Risultati page shapes)
interface WeeklyStats { week: number; totalPredictions: number; correctPredictions: number; accuracy: number; points: number; }
interface UserSummary { totalPredictions: number; correctPredictions: number; overallAccuracy: number; totalPoints: number; currentWeek: number; weeklyStats: WeeklyStats[]; }
type BffResponse<T> = { success?: boolean; data: T; message?: string };
function hasData<T>(value: unknown): value is { data: T } {
  return typeof value === 'object' && value !== null && 'data' in (value as Record<string, unknown>);
}
type NavigatorWebShare = Navigator & {
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
  clipboard?: Navigator['clipboard'];
};

export default function ProfiloPage() {
  const router = useRouter();
  const { firebaseUser } = useAuthContext();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [nickname, setNickname] = useState<string | null>(null);
  const [email, setEmail] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [summary, setSummary] = useState<UserSummary | null>(null);

  // Computed KPIs
  const kpi = useMemo(() => {
    const weeks = summary?.weeklyStats || [];
    const played = weeks.filter(w => Number(w.totalPredictions) > 0);
    const weeksPlayed = played.length;
    const avg = Number(summary?.overallAccuracy ?? 0);
    const best = played.length
      ? played.reduce((a, b) => (b.accuracy > a.accuracy ? b : a))
      : { accuracy: 0, week: 1 } as WeeklyStats;
    const worst = played.length
      ? played.reduce((a, b) => (b.accuracy < a.accuracy ? b : a))
      : { accuracy: 0, week: 1 } as WeeklyStats;

    // Format percent in it-IT with one decimal
    const fmtPct = (n: number) => `${n.toLocaleString('it-IT', { maximumFractionDigits: 1 })}%`;
    return {
      average: fmtPct(avg),
      weeksPlayed,
      best: { pct: fmtPct(best.accuracy || 0), week: best.week || 1 },
      worst: { pct: fmtPct(worst.accuracy || 0), week: worst.week || 1 },
    };
  }, [summary]);

  const loadData = useCallback(async () => {
    if (!firebaseUser?.uid) return;
    setLoading(true);
    setError(null);
    try {
      // Resolve backend user by Firebase UID
      const resp = await apiClient.getUserByFirebaseUid(firebaseUser.uid) as BffResponse<{ id: string; email: string; name: string; nickname?: string | null; googleProfileUrl?: string | null }>;
      const u = resp.data;
      if (!u?.id) throw new Error('Utente non trovato');
      setDisplayName(u.nickname || u.name || firebaseUser.displayName || u.email || '');
      setNickname(u.nickname ?? null);
      setEmail(u.email || firebaseUser.email || '');
      setAvatarUrl(u.googleProfileUrl || firebaseUser.photoURL || null);

      // Fetch live summary for KPIs (client-side aggregation for now)
      const sumResp = await apiClient.getUserSummary(u.id, 'live') as unknown;
      const raw: UserSummary | null | undefined = hasData<UserSummary>(sumResp)
        ? (sumResp as { data: UserSummary }).data
        : (sumResp as UserSummary | null | undefined);
      const normalized: UserSummary = {
        totalPredictions: Number(raw?.totalPredictions ?? 0),
        correctPredictions: Number(raw?.correctPredictions ?? 0),
        overallAccuracy: Number(raw?.overallAccuracy ?? 0),
        totalPoints: Number(raw?.totalPoints ?? 0),
        currentWeek: Number(raw?.currentWeek ?? 1),
        weeklyStats: Array.isArray(raw?.weeklyStats)
          ? (raw!.weeklyStats as Array<Partial<WeeklyStats>>).map((w) => ({
              week: Number(w?.week ?? 1),
              totalPredictions: Number(w?.totalPredictions ?? 0),
              correctPredictions: Number(w?.correctPredictions ?? 0),
              accuracy: Number(w?.accuracy ?? 0),
              points: Number(w?.points ?? 0),
            }))
          : [],
      };
      setSummary(normalized);
    } catch (e) {
      console.error('[profilo] loadData failed', e);
      setError('Errore nel caricamento del profilo');
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) {
      router.push('/login');
      return;
    }
    loadData();
  }, [firebaseUser, loadData, router]);

  // Share CTA
  const onShare = useCallback(async () => {
    try {
      const title = `Profilo Swipick di ${displayName}`;
      const text = `Punteggio medio ${kpi.average} su ${kpi.weeksPlayed} giornate.`;
      const url = typeof window !== 'undefined' ? window.location.origin : undefined;
      const nav: NavigatorWebShare | undefined = typeof navigator !== 'undefined' ? (navigator as NavigatorWebShare) : undefined;
      if (nav && typeof nav.share === 'function') {
        await nav.share({ title, text, url });
      } else if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(`${title}\n${text}\n${url ?? ''}`.trim());
        alert('Link copiato negli appunti');
      } else {
        alert(`${title}\n${text}`);
      }
    } catch {
      // ignore
    }
  }, [displayName, kpi]);

  const HeaderAvatar = () => {
    const initial = (displayName || email || ' ')[0]?.toUpperCase?.() || 'U';
    if (avatarUrl) {
      return (
        <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
        </div>
      );
    }
    return (
      <div className="w-16 h-16 rounded-xl bg-white/20 grid place-items-center text-2xl font-bold">
        {initial}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Gradient header */}
      <div
        className="w-full mx-0 mt-0 mb-6 rounded-b-2xl rounded-t-none text-white"
        style={{
          background: 'radial-gradient(circle at center, #554099, #3d2d73)',
          boxShadow: '0 8px 16px rgba(85, 64, 153, 0.3), 0 4px 8px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div className="px-5 pt-9 pb-7">
          <div className="flex items-center gap-4">
            <HeaderAvatar />
            <div className="flex-1 min-w-0">
              <div className="text-lg font-semibold truncate">{displayName || ' '}</div>
              <div className="text-white/80 text-sm">{nickname ? `@${nickname}` : email}</div>
            </div>
            <button
              aria-label="Impostazioni"
              onClick={() => router.push('/impostazioni')}
              className="p-2 rounded-lg hover:bg-white/10 active:bg-white/15"
              title="Impostazioni"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path d="M19.14,12.94a7.43,7.43,0,0,0,.05-.94,7.43,7.43,0,0,0-.05-.94l2.11-1.65a.5.5,0,0,0,.12-.64l-2-3.46a.5.5,0,0,0-.6-.22l-2.49,1a7.63,7.63,0,0,0-1.63-.94l-.38-2.65A.5.5,0,0,0,13.72,2H10.28a.5.5,0,0,0-.5.42L9.4,5.07a7.63,7.63,0,0,0-1.63.94l-2.49-1a.5.5,0,0,0-.6.22l-2,3.46a.5.5,0,0,0,.12.64L4.86,11.06a7.43,7.43,0,0,0-.05.94,7.43,7.43,0,0,0,.05.94L2.75,14.59a.5.5,0,0,0-.12.64l2,3.46a.5.5,0,0,0,.6.22l2.49-1a7.63,7.63,0,0,0,1.63.94l.38,2.65a.5.5,0,0,0,.5.42h3.44a.5.5,0,0,0,.5-.42l.38-2.65a7.63,7.63,0,0,0,1.63-.94l2.49,1a.5.5,0,0,0,.6-.22l2-3.46a.5.5,0,0,0-.12-.64ZM12,15.5A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-3 text-sm">{error}</div>
        )}

        {/* Average card */}
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-gradient-to-br from-white to-purple-50 rounded-2xl p-4 shadow-sm border border-purple-100/40">
            <div className="text-sm text-gray-700 mb-2">Punteggio medio</div>
            <div className="flex items-end justify-between">
              <div className={`text-4xl font-extrabold text-[#1f1147] ${loading ? 'animate-pulse' : ''}`}>
                {loading ? '—' : kpi.average}
              </div>
              <div className="text-xs text-gray-500">{loading ? '—' : `${kpi.weeksPlayed} giornate giocate`}</div>
            </div>
          </div>
        </div>

        {/* Best/Worst */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl p-4 shadow-sm border border-green-100/50" style={{ background: 'linear-gradient(180deg, #f4fff1, #ffffff)' }}>
            <div className="text-sm text-gray-700 mb-3">Risultato migliore</div>
            <div className={`text-3xl font-extrabold text-[#1f1147] ${loading ? 'animate-pulse' : ''}`}>{loading ? '—' : kpi.best.pct}</div>
            <div className="text-xs text-gray-500 mt-1">{loading ? '—' : `giornata ${kpi.best.week}`}</div>
          </div>
          <div className="rounded-2xl p-4 shadow-sm border border-orange-100/50" style={{ background: 'linear-gradient(180deg, #ffeef2, #ffffff)' }}>
            <div className="text-sm text-gray-700 mb-3">Risultato peggiore</div>
            <div className={`text-3xl font-extrabold text-[#1f1147] ${loading ? 'animate-pulse' : ''}`}>{loading ? '—' : kpi.worst.pct}</div>
            <div className="text-xs text-gray-500 mt-1">{loading ? '—' : `giornata ${kpi.worst.week}`}</div>
          </div>
        </div>

        {/* Share */}
        <div className="pt-2 pb-2">
          <button
            className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium shadow ${loading ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
            onClick={onShare}
            disabled={loading}
            title="Condividi profilo"
          >
            {/* Share icon (simple) */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.02-4.11A2.99 2.99 0 0 0 18 7.91c1.66 0 3-1.35 3-3.01s-1.34-3-3-3a3 3 0 0 0-2.82 4.01L8.16 9.83A3 3 0 0 0 6 9c-1.66 0-3 1.34-3 3s1.34 3.01 3 3.01c1.02 0 1.92-.5 2.46-1.26l7.05 4.12c-.05.21-.08.43-.08.66 0 1.66 1.34 3.01 3 3.01s3-1.35 3-3.01-1.34-3-3-3Z" />
            </svg>
            Condividi profilo
          </button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}>
        <div className="flex">
          <button
            onClick={() => router.push('/risultati')}
            className="flex-1 text-center py-4"
          >
            <div className="text-gray-500 mb-1">
              <FaMedal className="w-6 h-6 mx-auto" />
            </div>
            <span className="text-xs text-black">Risultati</span>
          </button>
          <button onClick={() => router.push('/gioca')} className="flex-1 text-center py-4">
            <div className="text-gray-500 mb-1">
              <RiFootballLine className="w-6 h-6 mx-auto" />
            </div>
            <span className="text-xs text-black">Gioca</span>
          </button>
          <div className="flex-1 text-center py-4 border-b-2 border-purple-600">
            <div className="text-purple-600 mb-1">
              <BsFillFilePersonFill className="w-6 h-6 mx-auto" />
            </div>
            <span className="text-xs text-purple-600 font-medium">Profilo</span>
          </div>
        </div>
      </div>
    </div>
  );
}
