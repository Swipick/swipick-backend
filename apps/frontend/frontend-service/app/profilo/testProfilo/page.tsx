'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/src/contexts/AuthContext';
import { apiClient } from '@/lib/api-client';
import { BottomNav } from '@/app/gioca/components/Navigation/BottomNav';
import type { GameMode } from '@/app/gioca/types';
import { MdOutlineIosShare } from 'react-icons/md';

// Test mode specific types
interface TestWeekStats {
  week: number;
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
}

interface TestUserProfile {
  id: string;
  email: string;
  name: string;
  nickname?: string | null;
  googleProfileUrl?: string | null;
}

type NavigatorWebShare = Navigator & {
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
  clipboard?: Navigator['clipboard'];
};

export default function TestProfiloPage() {
  console.log('[TestProfilo] 🎯 TestProfiloPage component mounting/rendering');

  const router = useRouter();
  const { firebaseUser } = useAuthContext();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [nickname, setNickname] = useState<string | null>(null);
  const [email, setEmail] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<TestWeekStats[]>([]);

  console.log('[TestProfilo] 📊 Current state:', {
    loading,
    error,
    displayName,
    weeklyStatsCount: weeklyStats.length,
    firebaseUserUid: firebaseUser?.uid
  });

  // Calculate statistics from test mode prediction data
  const kpi = useMemo(() => {
    const playedWeeks = weeklyStats.filter(w => w.totalPredictions > 0);

    if (playedWeeks.length === 0) {
      return {
        average: '0,0%',
        weeksPlayed: 0,
        best: { pct: '0,0%', week: 1 },
        worst: { pct: '0,0%', week: 1 },
      };
    }

    // Calculate weighted average across all predictions
    const totals = playedWeeks.reduce(
      (acc, week) => {
        acc.totalPredictions += week.totalPredictions;
        acc.correctPredictions += week.correctPredictions;
        return acc;
      },
      { totalPredictions: 0, correctPredictions: 0 }
    );

    const averageAccuracy = totals.totalPredictions > 0
      ? (totals.correctPredictions / totals.totalPredictions) * 100
      : 0;

    // Find best and worst weeks
    const sortedByAccuracy = [...playedWeeks].sort((a, b) => {
      // Primary: accuracy
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      // Tiebreaker: more correct predictions
      if (b.correctPredictions !== a.correctPredictions) return b.correctPredictions - a.correctPredictions;
      // Final tiebreaker: earlier week wins
      return a.week - b.week;
    });

    const bestWeek = sortedByAccuracy[0];
    const worstWeek = sortedByAccuracy[sortedByAccuracy.length - 1];

    // Format percentages in Italian locale
    const fmtPct = (n: number) => `${n.toLocaleString('it-IT', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    })}%`;

    return {
      average: fmtPct(averageAccuracy),
      weeksPlayed: playedWeeks.length,
      best: {
        pct: fmtPct(bestWeek?.accuracy || 0),
        week: bestWeek?.week || 1
      },
      worst: {
        pct: fmtPct(worstWeek?.accuracy || 0),
        week: worstWeek?.week || 1
      },
    };
  }, [weeklyStats]);

  // Fetch test mode prediction data for all weeks
  const loadTestModeStats = useCallback(async (userKey: string) => {
    try {
      console.log('[TestProfilo] 🏃 Starting loadTestModeStats for userKey:', userKey);

      // Get all test weeks available
      console.log('[TestProfilo] 📅 Calling getTestWeeks()...');
      const testWeeksResponse = await apiClient.getTestWeeks();
      console.log('[TestProfilo] 📅 Raw getTestWeeks response:', JSON.stringify(testWeeksResponse, null, 2));
      console.log('[TestProfilo] 📅 Response type:', typeof testWeeksResponse);
      console.log('[TestProfilo] 📅 Response keys:', testWeeksResponse ? Object.keys(testWeeksResponse) : 'null/undefined');

      const availableWeeks = testWeeksResponse?.data || [];
      console.log('[TestProfilo] 📅 Available test weeks:', availableWeeks);
      console.log('[TestProfilo] 📅 Available weeks type:', typeof availableWeeks);
      console.log('[TestProfilo] 📅 Available weeks length:', availableWeeks.length);

      if (availableWeeks.length === 0) {
        console.warn('[TestProfilo] ⚠️ No test weeks available from API');
        console.warn('[TestProfilo] ⚠️ Full response object:', testWeeksResponse);
        setWeeklyStats([]);
        return;
      }

      // Fetch predictions for each week
      console.log('[TestProfilo] 🔍 Fetching stats for each week...');
      const weekStatsPromises = availableWeeks.map(async (week: number) => {
        try {
          console.log(`[TestProfilo] 📊 Calling getTestWeeklyStats for week ${week}...`);
          console.log(`[TestProfilo] 📊 Parameters: userKey=${userKey}, week=${week}`);
          const weekStats = await apiClient.getTestWeeklyStats(userKey, week);
          console.log(`[TestProfilo] 📊 Raw week ${week} response:`, JSON.stringify(weekStats, null, 2));
          console.log(`[TestProfilo] 📊 Week ${week} response type:`, typeof weekStats);
          console.log(`[TestProfilo] 📊 Week ${week} response keys:`, weekStats ? Object.keys(weekStats) : 'null/undefined');

          // Extract actual stats from the response
          const totalPredictions = weekStats?.total_predictions || 0;
          const correctPredictions = weekStats?.correct_predictions || 0;
          const accuracy = totalPredictions > 0
            ? (correctPredictions / totalPredictions) * 100
            : 0;

          console.log(`[TestProfilo] ✅ Week ${week} processed stats:`, {
            total: totalPredictions,
            correct: correctPredictions,
            accuracy: accuracy.toFixed(1) + '%',
            rawTotalFromResponse: weekStats?.total_predictions,
            rawCorrectFromResponse: weekStats?.correct_predictions
          });

          return {
            week,
            totalPredictions,
            correctPredictions,
            accuracy
          };
        } catch (error) {
          console.warn(`[TestProfilo] ❌ Failed to fetch week ${week} stats:`, error);
          console.warn(`[TestProfilo] ❌ Error details:`, {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            errorType: typeof error
          });
          return {
            week,
            totalPredictions: 0,
            correctPredictions: 0,
            accuracy: 0
          };
        }
      });

      console.log('[TestProfilo] ⏳ Waiting for all week stats...');
      const weekStats = await Promise.all(weekStatsPromises);

      console.log('[TestProfilo] 🎯 Final aggregated week stats:', JSON.stringify(weekStats, null, 2));
      console.log('[TestProfilo] 🎯 Week stats summary:', weekStats.map(w => ({
        week: w.week,
        total: w.totalPredictions,
        correct: w.correctPredictions,
        accuracy: w.accuracy
      })));
      setWeeklyStats(weekStats);

    } catch (error) {
      console.error('[TestProfilo] ❌ Failed to load test mode stats:', error);
      console.error('[TestProfilo] ❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        errorType: typeof error
      });
      throw new Error('Errore nel caricamento delle statistiche test');
    }
  }, []);

  // Load user profile and test mode statistics
  const loadData = useCallback(async () => {
    if (!firebaseUser?.uid) {
      console.log('[TestProfilo] No firebase user, skipping data load');
      return;
    }

    console.log('[TestProfilo] 🚀 Starting data load for user:', firebaseUser.uid);
    console.log('[TestProfilo] 🚀 Firebase user object:', {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL
    });
    setLoading(true);
    setError(null);

    try {
      // Get user profile
      console.log('[TestProfilo] 📡 Fetching user profile...');
      const userResponse = await apiClient.getUserByFirebaseUid(firebaseUser.uid);
      console.log('[TestProfilo] 👤 Raw user profile response:', JSON.stringify(userResponse, null, 2));
      const user = userResponse.data as TestUserProfile;
      console.log('[TestProfilo] 👤 User profile data:', user);

      if (!user?.id) {
        console.error('[TestProfilo] ❌ No user ID found in response:', user);
        throw new Error('Utente non trovato');
      }

      // Set user info
      const fullName = (user.name || firebaseUser.displayName || '').trim();
      const firstName = fullName ? fullName.split(/\s+/)[0] : (user.email?.split('@')[0] ?? '');

      console.log('[TestProfilo] 📝 Setting user display info:', {
        firstName,
        userId: user.id,
        nickname: user.nickname,
        email: user.email,
        fullName,
        firebaseDisplayName: firebaseUser.displayName
      });

      setDisplayName(firstName || '');
      setUserId(user.id);
      setNickname(user.nickname ?? null);
      setEmail(user.email || firebaseUser.email || '');
      setAvatarUrl(user.googleProfileUrl || firebaseUser.photoURL || null);

      // Load test mode statistics
      console.log('[TestProfilo] 📊 Loading test mode statistics...');
      console.log('[TestProfilo] 📊 Using userKey for stats:', firebaseUser.uid);
      await loadTestModeStats(firebaseUser.uid);
      console.log('[TestProfilo] ✅ Data load completed successfully');

    } catch (e) {
      console.error('[TestProfilo] ❌ loadData failed:', e);
      console.error('[TestProfilo] ❌ Error details:', {
        message: e instanceof Error ? e.message : 'Unknown error',
        stack: e instanceof Error ? e.stack : undefined,
        errorType: typeof e
      });
      setError(e instanceof Error ? e.message : 'Errore nel caricamento del profilo test');
    } finally {
      setLoading(false);
    }
  }, [firebaseUser, loadTestModeStats]);

  useEffect(() => {
    if (!firebaseUser) {
      router.push('/login');
      return;
    }
    loadData();
  }, [firebaseUser, loadData, router]);

  // Fetch stored avatar after we know the userId
  useEffect(() => {
    const fetchAvatar = async () => {
      if (!userId) return;
      try {
        const r = await apiClient.getUserAvatar(userId);
        const b64 = r?.data?.base64 as string | undefined;
        const mime = r?.data?.mimeType as string | undefined;
        if (b64 && mime) {
          setAvatarUrl(`data:${mime};base64,${b64}`);
        }
      } catch {
        // Ignore if no avatar
      }
    };
    fetchAvatar();
  }, [userId]);

  // Share functionality
  const onShare = useCallback(async () => {
    try {
      const title = `Profilo Test Swipick di ${displayName}`;
      const text = `Punteggio medio ${kpi.average} su ${kpi.weeksPlayed} giornate (modalità test).`;
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
      // Ignore share errors
    }
  }, [displayName, kpi]);

  // Header avatar component
  const HeaderAvatar = () => {
    const initial = (displayName || email || ' ')[0]?.toUpperCase?.() || 'U';
    if (avatarUrl) {
      return (
        <div className="w-28 h-28 rounded-2xl overflow-hidden bg-white/20">
          <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
        </div>
      );
    }
    return (
      <div className="w-28 h-28 rounded-2xl bg-white/20 grid place-items-center text-3xl font-bold">
        {initial}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Gradient header */}
      <div
        className="w-full mx-0 mt-0 mb-9 rounded-b-2xl rounded-t-none text-white"
        style={{
          background: 'radial-gradient(circle at center, #554099, #3d2d73)',
          boxShadow: '0 8px 16px rgba(85, 64, 153, 0.3), 0 4px 8px rgba(0, 0, 0, 0.2)',
        }}
      >
        {/* Test Mode indicator */}
        <div className="flex items-center justify-center pt-3 pb-2">
          <div className="inline-block px-3 py-1 text-xs bg-white/20 rounded-full">
            Modalità Test - Profilo Statistiche
          </div>
        </div>

        <div className="px-10 pb-7">
          <div className="flex flex-col gap-3">
            <HeaderAvatar />
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-lg font-semibold truncate">{displayName || ' '}</div>
                <div className="text-white/80 text-sm">
                  {nickname ? `@${nickname}` : (email ? `@${email.split('@')[0]}` : '')}
                </div>
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
      </div>

      {/* Content */}
      <div className="px-10 space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-3 text-sm">
            {error}
          </div>
        )}

        {/* Average score card */}
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-gradient-to-br from-white to-purple-300 rounded-2xl p-5 shadow-lg border border-purple-100/40 min-h-[132px]">
            <div className="flex items-start justify-between">
              <div className="text-sm text-gray-700">Punteggio medio</div>
              <div className="flex flex-col items-end text-right mt-10">
                <div className={`text-5xl font-extrabold text-[#1f1147] leading-none ${loading ? 'animate-pulse' : ''}`}>
                  {loading ? '—' : kpi.average}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {loading ? '—' : `${kpi.weeksPlayed} giornate giocate`}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Best/Worst performance cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl p-4 shadow-lg border border-green-100/50 min-h-[162px]"
               style={{ background: 'linear-gradient(180deg, #f4fff1, #ffffff)' }}>
            <div className="text-sm text-gray-700">Risultato migliore</div>
            <div className="mt-2 flex justify-end">
              <div className="flex flex-col items-end text-right mt-10">
                <div className={`text-5xl font-extrabold text-[#1f1147] leading-none ${loading ? 'animate-pulse' : ''}`}>
                  {loading ? '—' : kpi.best.pct}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {loading ? '—' : `giornata ${kpi.best.week}`}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl p-4 shadow-lg border border-orange-100/50"
               style={{ background: 'linear-gradient(180deg, #ffeef2, #ffffff)' }}>
            <div className="text-sm text-gray-700">Risultato peggiore</div>
            <div className="mt-2 flex justify-end">
              <div className="flex flex-col items-end text-right mt-10">
                <div className={`text-5xl font-extrabold text-[#1f1147] leading-none ${loading ? 'animate-pulse' : ''}`}>
                  {loading ? '—' : kpi.worst.pct}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {loading ? '—' : `giornata ${kpi.worst.week}`}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Share button */}
        <div className="pt-12 pb-2 flex justify-center">
          <button
            className={`w-fit inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium shadow ${
              loading
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
            onClick={onShare}
            disabled={loading}
            title="Condividi profilo test"
          >
            <MdOutlineIosShare className="w-4 h-4" />
            Condividi profilo
          </button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav
        currentMode="test"
        selectedWeek={null}
        onNavigateToResults={() => router.push('/risultati/test-risultati?mode=test')}
        onNavigateToGioca={() => router.push('/gioca?mode=test')}
        onNavigateToProfile={() => {}}
        activeTab="profilo"
      />
    </div>
  );
}