'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/src/contexts/AuthContext';
import { apiClient } from '@/lib/api-client';
import GradientBackground from '@/components/ui/GradientBackground';
import FormInput from '@/components/ui/FormInput';
import Button from '@/components/ui/Button';

interface UserProfile {
  id: string;
  firebaseUid: string;
  name: string;
  nickname: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  emailVerified: boolean;
  profileCompleted: boolean;
}

interface UserStats {
  totalPredictions: number;
  correctPredictions: number;
  overallAccuracy: number;
  totalPoints: number;
  currentWeek: number;
  ranking?: number;
  weeklyStats?: Array<{
    week: number;
    totalPredictions: number;
    correctPredictions: number;
    accuracy: number;
    points: number;
  }>;
}

const ProfiloPage: React.FC = () => {
  const router = useRouter();
  const { firebaseUser, logout } = useAuthContext();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [liveStats, setLiveStats] = useState<UserStats | null>(null);
  const [testStats, setTestStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({ name: '', nickname: '' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchUserProfile = useCallback(async () => {
    if (!firebaseUser) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Get user profile
      const userResponse = await apiClient.getUserByFirebaseUid(firebaseUser.uid);
      const userProfile = userResponse.data;
      setProfile(userProfile);
      setEditData({ name: userProfile.name, nickname: userProfile.nickname });

      // Fetch stats for both modes in parallel
      const [liveStatsResponse, testStatsResponse] = await Promise.all([
        apiClient.getUserSummary(userProfile.id, 'live').catch(() => null),
        apiClient.getUserSummary(userProfile.id, 'test').catch(() => null)
      ]);

      setLiveStats(liveStatsResponse);
      setTestStats(testStatsResponse);
    } catch (err) {
      console.error('Error fetching user profile:', err);
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
    
    fetchUserProfile();
  }, [firebaseUser, fetchUserProfile, router]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setError(null);
    setSuccess(null);

    try {
      // Here you would call an update profile API
      // For now, we'll just update the local state
      setProfile({ ...profile, ...editData });
      setEditMode(false);
      setSuccess('Profilo aggiornato con successo');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('Errore nell\'aggiornamento del profilo');
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (err) {
      console.error('Error signing out:', err);
      setError('Errore durante la disconnessione');
    }
  };

  const resetTestData = async () => {
    if (!profile) return;
    
    try {
      await apiClient.resetTestData(profile.id);
      setSuccess('Dati di test resettati con successo');
      
      // Refresh test stats
      const testStatsResponse = await apiClient.getUserSummary(profile.id, 'test').catch(() => null);
      setTestStats(testStatsResponse);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error resetting test data:', err);
      setError('Errore nel reset dei dati di test');
    }
  };

  // ---- Computed summaries for weekly stats ----
  const summarizeMode = useCallback((stats: UserStats | null) => {
    if (!stats || !Array.isArray(stats.weeklyStats)) {
      return { played: 0, best: null as null | { week: number; accuracy: number; points: number }, worst: null as null | { week: number; accuracy: number; points: number } };
    }
    const weeks = stats.weeklyStats.filter(w => (w.totalPredictions ?? 0) > 0);
    const played = weeks.length;
    if (played === 0) return { played: 0, best: null, worst: null };
    // tie-breakers: best → higher accuracy, then higher points, then most recent week
    let best = weeks[0];
    for (const w of weeks.slice(1)) {
      if (w.accuracy > best.accuracy) { best = w; continue; }
      if (w.accuracy === best.accuracy && w.points > best.points) { best = w; continue; }
      if (w.accuracy === best.accuracy && w.points === best.points && w.week > best.week) { best = w; continue; }
    }
    // worst → lower accuracy, then lower points, then most recent week
    let worst = weeks[0];
    for (const w of weeks.slice(1)) {
      if (w.accuracy < worst.accuracy) { worst = w; continue; }
      if (w.accuracy === worst.accuracy && w.points < worst.points) { worst = w; continue; }
      if (w.accuracy === worst.accuracy && w.points === worst.points && w.week > worst.week) { worst = w; continue; }
    }
    return { played, best: { week: best.week, accuracy: best.accuracy, points: best.points }, worst: { week: worst.week, accuracy: worst.accuracy, points: worst.points } };
  }, []);

  const liveSummary = useMemo(() => summarizeMode(liveStats), [liveStats, summarizeMode]);
  const testSummary = useMemo(() => summarizeMode(testStats), [testStats, summarizeMode]);

  const shareProfile = useCallback((mode: 'live' | 'test') => {
    const s = mode === 'live' ? liveStats : testStats;
    if (!s) return;
    const text = `Profilo: precisione ${s.overallAccuracy?.toFixed?.(0) ?? 0}%, punti ${s.totalPoints ?? 0}. #Swipick`;
    // Stub: log, could use Web Share API
    console.log(text);
  }, [liveStats, testStats]);

  if (loading) {
    return (
      <GradientBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-white text-xl">Caricamento...</div>
        </div>
      </GradientBackground>
    );
  }

  if (error && !profile) {
    return (
      <GradientBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-white text-xl">{error}</div>
        </div>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <div className="min-h-screen pb-20 p-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 pt-12">
          <h1 className="text-white text-2xl font-bold">Profilo</h1>
          <button
            onClick={() => setEditMode(!editMode)}
            className="bg-white bg-opacity-20 text-white px-4 py-2 rounded-xl font-medium hover:bg-opacity-30 transition-colors"
          >
            {editMode ? 'Annulla' : 'Modifica'}
          </button>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="bg-green-500 bg-opacity-20 border border-green-500 text-white p-4 rounded-xl mb-6">
            {success}
          </div>
        )}
        {error && (
          <div className="bg-red-500 bg-opacity-20 border border-red-500 text-white p-4 rounded-xl mb-6">
            {error}
          </div>
        )}

        {/* Profile Info */}
        {profile && (
          <div className="bg-white bg-opacity-20 rounded-xl p-6 mb-6">
            {editMode ? (
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <FormInput
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Nome"
                  value={editData.name}
                  onChange={(value) => setEditData({ ...editData, name: value })}
                  required
                />
                <FormInput
                  id="nickname"
                  name="nickname"
                  type="text"
                  placeholder="Nickname"
                  value={editData.nickname}
                  onChange={(value) => setEditData({ ...editData, nickname: value })}
                  required
                />
                <div className="flex space-x-4">
                  <Button type="submit" className="flex-1">
                    Salva
                  </Button>
                  <Button 
                    type="button" 
                    onClick={() => setEditMode(false)}
                    className="flex-1 bg-gray-500 hover:bg-gray-600"
                  >
                    Annulla
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-white bg-opacity-30 rounded-full flex items-center justify-center">
                    <span className="text-white text-2xl font-bold">
                      {profile.nickname.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-white text-xl font-bold">{profile.nickname}</h2>
                    <p className="text-white text-opacity-80">{profile.name}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-white text-opacity-80">Email:</span>
                    <span className="text-white">{profile.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white text-opacity-80">Membro dal:</span>
                    <span className="text-white">
                      {new Date(profile.createdAt).toLocaleDateString('it-IT')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white text-opacity-80">Email verificata:</span>
                    <span className={`${profile.emailVerified ? 'text-green-400' : 'text-red-400'}`}>
                      {profile.emailVerified ? '✓ Verificata' : '✗ Non verificata'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Statistics */}
        <div className="space-y-6">
          {/* Live Mode Stats */}
          <div className="bg-white bg-opacity-20 rounded-xl p-6">
            <h3 className="text-white text-lg font-bold mb-4 flex items-center">
              <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
              Modalità Live
            </h3>
            {liveStats ? (
              <div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{liveStats.overallAccuracy.toFixed(1)}%</div>
                    <div className="text-white text-opacity-80 text-sm">Precisione</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{liveStats.totalPoints}</div>
                    <div className="text-white text-opacity-80 text-sm">Punti</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{liveStats.correctPredictions}</div>
                    <div className="text-white text-opacity-80 text-sm">Corrette</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{liveStats.totalPredictions}</div>
                    <div className="text-white text-opacity-80 text-sm">Totali</div>
                  </div>
                </div>
                {/* Weekly summary */}
                <div className="mt-4 p-3 rounded-lg bg-white bg-opacity-10">
                  <div className="flex justify-between text-white text-sm mb-2">
                    <span>Giornate giocate</span>
                    <span>{liveSummary.played}</span>
                  </div>
                  <div className="flex justify-between text-white text-sm mb-1">
                    <span>Migliore settimana</span>
                    <span>{liveSummary.best ? `#${liveSummary.best.week} • ${liveSummary.best.accuracy.toFixed(1)}%` : '-'}</span>
                  </div>
                  <div className="flex justify-between text-white text-sm">
                    <span>Peggiore settimana</span>
                    <span>{liveSummary.worst ? `#${liveSummary.worst.week} • ${liveSummary.worst.accuracy.toFixed(1)}%` : '-'}</span>
                  </div>
                  <div className="mt-3 text-right">
                    <button
                      onClick={() => shareProfile('live')}
                      className="bg-white bg-opacity-20 text-white px-3 py-1 rounded-lg text-sm font-medium hover:bg-opacity-30 transition-all"
                    >
                      Condividi profilo
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-white text-opacity-60 text-center py-4">
                Nessuna statistica disponibile
              </div>
            )}
          </div>

          {/* Test Mode Stats */}
          <div className="bg-white bg-opacity-20 rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white text-lg font-bold flex items-center">
                <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                Modalità Test
              </h3>
              <button
                onClick={resetTestData}
                className="bg-red-500 bg-opacity-80 text-white px-3 py-1 rounded-lg text-sm font-medium hover:bg-opacity-100 transition-all"
              >
                Reset
              </button>
            </div>
            {testStats ? (
              <div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{testStats.overallAccuracy.toFixed(1)}%</div>
                    <div className="text-white text-opacity-80 text-sm">Precisione</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{testStats.totalPoints}</div>
                    <div className="text-white text-opacity-80 text-sm">Punti</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{testStats.correctPredictions}</div>
                    <div className="text-white text-opacity-80 text-sm">Corrette</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{testStats.totalPredictions}</div>
                    <div className="text-white text-opacity-80 text-sm">Totali</div>
                  </div>
                </div>
                {/* Weekly summary */}
                <div className="mt-4 p-3 rounded-lg bg-white bg-opacity-10">
                  <div className="flex justify-between text-white text-sm mb-2">
                    <span>Giornate giocate</span>
                    <span>{testSummary.played}</span>
                  </div>
                  <div className="flex justify-between text-white text-sm mb-1">
                    <span>Migliore settimana</span>
                    <span>{testSummary.best ? `#${testSummary.best.week} • ${testSummary.best.accuracy.toFixed(1)}%` : '-'}</span>
                  </div>
                  <div className="flex justify-between text-white text-sm">
                    <span>Peggiore settimana</span>
                    <span>{testSummary.worst ? `#${testSummary.worst.week} • ${testSummary.worst.accuracy.toFixed(1)}%` : '-'}</span>
                  </div>
                  <div className="mt-3 text-right">
                    <button
                      onClick={() => shareProfile('test')}
                      className="bg-white bg-opacity-20 text-white px-3 py-1 rounded-lg text-sm font-medium hover:bg-opacity-30 transition-all"
                    >
                      Condividi profilo
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-white text-opacity-60 text-center py-4">
                Nessuna statistica disponibile
              </div>
            )}
          </div>
        </div>

        {/* Settings */}
        <div className="bg-white bg-opacity-20 rounded-xl p-6 mt-6">
          <h3 className="text-white text-lg font-bold mb-4">Impostazioni</h3>
          <div className="space-y-3">
            <button
              onClick={() => router.push('/terms')}
              className="w-full text-left text-white hover:text-white hover:bg-white hover:bg-opacity-10 p-3 rounded-lg transition-colors"
            >
              <div className="flex justify-between items-center">
                <span>Termini e Condizioni</span>
                <span>→</span>
              </div>
            </button>
            <button
              onClick={() => router.push('/privacy')}
              className="w-full text-left text-white hover:text-white hover:bg-white hover:bg-opacity-10 p-3 rounded-lg transition-colors"
            >
              <div className="flex justify-between items-center">
                <span>Privacy Policy</span>
                <span>→</span>
              </div>
            </button>
            <button
              onClick={handleSignOut}
              className="w-full text-left text-red-400 hover:text-red-300 hover:bg-red-500 hover:bg-opacity-10 p-3 rounded-lg transition-colors"
            >
              <div className="flex justify-between items-center">
                <span>Disconnetti</span>
                <span>→</span>
              </div>
            </button>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t">
          <div className="flex">
            <button
              onClick={() => router.push('/risultati')}
              className="flex-1 text-center py-4"
            >
              <div className="text-gray-400 mb-1">
                <svg className="w-6 h-6 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 11H7v6h2v-6zm4 0h-2v6h2v-6zm4 0h-2v6h2v-6zM4 22h16v-2H4v2zm0-4h16v-2H4v2zm0-4h16v-2H4v2zm0-4h16V8H4v2zm0-6h16V2H4v2z"/>
                </svg>
              </div>
              <span className="text-xs text-gray-500">Risultati</span>
            </button>
            <button
              onClick={() => router.push('/gioca')}
              className="flex-1 text-center py-4"
            >
              <div className="text-gray-400 mb-1">
                <svg className="w-6 h-6 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <span className="text-xs text-gray-500">Gioca</span>
            </button>
            <button
              onClick={() => router.push('/profilo')}
              className="flex-1 text-center py-4 border-b-2 border-purple-600"
            >
              <div className="text-purple-600 mb-1">
                <svg className="w-6 h-6 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2c1.1 0 2 .9 2 2 0 .74-.4 1.38-1 1.72v.78h-.5c-.83 0-1.5.67-1.5 1.5v.5c0 .28-.22.5-.5.5s-.5-.22-.5-.5v-.5c0-1.38 1.12-2.5 2.5-2.5H13V5.72c-.6-.34-1-.98-1-1.72 0-1.1.9-2 2-2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                </svg>
              </div>
              <span className="text-xs text-purple-600 font-medium">Profilo</span>
            </button>
          </div>
        </div>
      </div>
    </GradientBackground>
  );
};

export default ProfiloPage;
