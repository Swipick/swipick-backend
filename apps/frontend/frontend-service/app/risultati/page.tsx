'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/src/contexts/AuthContext';
import { apiClient } from '@/lib/api-client';
import GradientBackground from '@/components/ui/GradientBackground';

interface WeeklyStats {
  week: number;
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  points: number;
}

interface UserSummary {
  totalPredictions: number;
  correctPredictions: number;
  overallAccuracy: number;
  totalPoints: number;
  currentWeek: number;
  weeklyStats: WeeklyStats[];
}

interface PredictionHistory {
  id: string;
  week: number;
  homeTeam: string;
  awayTeam: string;
  prediction: string;
  actualResult?: string;
  isCorrect?: boolean;
  points: number;
  date: string;
}

const RisultatiPage: React.FC = () => {
  const router = useRouter();
  const { firebaseUser } = useAuthContext();
  const [mode, setMode] = useState<'live' | 'test'>('live');
  const [summary, setSummary] = useState<UserSummary | null>(null);
  const [history, setHistory] = useState<PredictionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');

  const fetchUserData = useCallback(async () => {
    if (!firebaseUser) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Get user profile to get the backend user ID
      const userResponse = await apiClient.getUserByFirebaseUid(firebaseUser.uid);
      const userId = userResponse.data.id;

      // Fetch summary and weekly predictions in parallel
      const [summaryResponse, weeklyResponse] = await Promise.all([
        apiClient.getUserSummary(userId, mode),
        apiClient.getUserWeeklyPredictions(userId, mode)
      ]);

      setSummary(summaryResponse);
      setHistory(weeklyResponse.predictions || []);
    } catch (err) {
      console.error('Error fetching user data:', err);
      setError('Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  }, [firebaseUser, mode]);

  useEffect(() => {
    if (!firebaseUser) {
      router.push('/login');
      return;
    }
    
    fetchUserData();
  }, [firebaseUser, fetchUserData, router]);

  const handleModeSwitch = (newMode: 'live' | 'test') => {
    setMode(newMode);
  };

  const resetTestData = async () => {
    if (!firebaseUser || mode !== 'test') return;
    
    try {
      const userResponse = await apiClient.getUserByFirebaseUid(firebaseUser.uid);
      const userId = userResponse.data.id;
      
      await apiClient.resetTestData(userId);
      
      // Refresh data after reset
      fetchUserData();
    } catch (err) {
      console.error('Error resetting test data:', err);
      setError('Errore nel reset dei dati di test');
    }
  };

  const formatPrediction = (prediction: string) => {
    switch (prediction) {
      case '1': return 'Casa';
      case 'X': return 'Pareggio';
      case '2': return 'Ospite';
      default: return prediction;
    }
  };

  const getResultColor = (isCorrect?: boolean) => {
    if (isCorrect === undefined) return 'text-gray-500';
    return isCorrect ? 'text-green-500' : 'text-red-500';
  };

  if (loading) {
    return (
      <GradientBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-white text-xl">Caricamento...</div>
        </div>
      </GradientBackground>
    );
  }

  if (error) {
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
          <h1 className="text-white text-2xl font-bold">Risultati</h1>
          
          {/* Mode Toggle */}
          <div className="flex bg-white bg-opacity-20 rounded-xl p-1">
            <button
              onClick={() => handleModeSwitch('live')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                mode === 'live'
                  ? 'bg-white text-purple-600 shadow-lg'
                  : 'text-white hover:bg-white hover:bg-opacity-20'
              }`}
            >
              Live
            </button>
            <button
              onClick={() => handleModeSwitch('test')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                mode === 'test'
                  ? 'bg-white text-purple-600 shadow-lg'
                  : 'text-white hover:bg-white hover:bg-opacity-20'
              }`}
            >
              Test
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-white bg-opacity-20 rounded-xl p-1 mb-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'overview'
                ? 'bg-white text-purple-600 shadow-lg'
                : 'text-white hover:bg-white hover:bg-opacity-20'
            }`}
          >
            Panoramica
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'history'
                ? 'bg-white text-purple-600 shadow-lg'
                : 'text-white hover:bg-white hover:bg-opacity-20'
            }`}
          >
            Storico
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && summary && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white bg-opacity-20 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-white mb-1">
                  {summary.overallAccuracy.toFixed(1)}%
                </div>
                <div className="text-white text-opacity-80 text-sm">Precisione</div>
              </div>
              <div className="bg-white bg-opacity-20 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-white mb-1">
                  {summary.totalPoints}
                </div>
                <div className="text-white text-opacity-80 text-sm">Punti Totali</div>
              </div>
              <div className="bg-white bg-opacity-20 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-white mb-1">
                  {summary.correctPredictions}
                </div>
                <div className="text-white text-opacity-80 text-sm">Corrette</div>
              </div>
              <div className="bg-white bg-opacity-20 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-white mb-1">
                  {summary.totalPredictions}
                </div>
                <div className="text-white text-opacity-80 text-sm">Totali</div>
              </div>
            </div>

            {/* Weekly Stats */}
            <div className="bg-white bg-opacity-20 rounded-xl p-4">
              <h3 className="text-white font-bold text-lg mb-4">Statistiche Settimanali</h3>
              <div className="space-y-3">
                {summary.weeklyStats.slice(0, 5).map((week) => (
                  <div key={week.week} className="flex justify-between items-center">
                    <div className="text-white">
                      <div className="font-medium">Settimana {week.week}</div>
                      <div className="text-sm text-white text-opacity-80">
                        {week.correctPredictions}/{week.totalPredictions} corrette
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-bold">{week.accuracy.toFixed(1)}%</div>
                      <div className="text-sm text-white text-opacity-80">{week.points} pt</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Test Mode Reset Button */}
            {mode === 'test' && (
              <button
                onClick={resetTestData}
                className="w-full bg-red-500 bg-opacity-80 text-white py-3 rounded-xl font-medium hover:bg-opacity-100 transition-all"
              >
                Reset Dati Test
              </button>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {history.length === 0 ? (
              <div className="bg-white bg-opacity-20 rounded-xl p-8 text-center">
                <div className="text-white text-lg">Nessuna predizione trovata</div>
                <div className="text-white text-opacity-60 mt-2">
                  {mode === 'test' ? 'Inizia a giocare in modalità test!' : 'Fai le tue prime predizioni!'}
                </div>
              </div>
            ) : (
              history.map((prediction) => (
                <div key={prediction.id} className="bg-white bg-opacity-20 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-white">
                      <div className="font-medium">
                        {prediction.homeTeam} vs {prediction.awayTeam}
                      </div>
                      <div className="text-sm text-white text-opacity-80">
                        Settimana {prediction.week} • {new Date(prediction.date).toLocaleDateString('it-IT')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${getResultColor(prediction.isCorrect)}`}>
                        {prediction.isCorrect ? '✓' : '✗'}
                      </div>
                      <div className="text-white text-sm">{prediction.points} pt</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="text-white text-opacity-80 text-sm">
                      Predizione: {formatPrediction(prediction.prediction)}
                    </div>
                    {prediction.actualResult && (
                      <div className="text-white text-opacity-80 text-sm">
                        Risultato: {formatPrediction(prediction.actualResult)}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t">
          <div className="flex">
            <button
              onClick={() => router.push('/risultati')}
              className="flex-1 text-center py-4 border-b-2 border-purple-600"
            >
              <div className="text-purple-600 mb-1">
                <svg className="w-6 h-6 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 11H7v6h2v-6zm4 0h-2v6h2v-6zm4 0h-2v6h2v-6zM4 22h16v-2H4v2zm0-4h16v-2H4v2zm0-4h16v-2H4v2zm0-4h16V8H4v2zm0-6h16V2H4v2z"/>
                </svg>
              </div>
              <span className="text-xs text-purple-600 font-medium">Risultati</span>
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
              className="flex-1 text-center py-4"
            >
              <div className="text-gray-400 mb-1">
                <svg className="w-6 h-6 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2c1.1 0 2 .9 2 2 0 .74-.4 1.38-1 1.72v.78h-.5c-.83 0-1.5.67-1.5 1.5v.5c0 .28-.22.5-.5.5s-.5-.22-.5-.5v-.5c0-1.38 1.12-2.5 2.5-2.5H13V5.72c-.6-.34-1-.98-1-1.72 0-1.1.9-2 2-2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                </svg>
              </div>
              <span className="text-xs text-gray-500">Profilo</span>
            </button>
          </div>
        </div>
      </div>
    </GradientBackground>
  );
};

export default RisultatiPage;
