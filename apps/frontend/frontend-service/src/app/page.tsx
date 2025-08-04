'use client';

import Image from "next/image";
import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";

interface HealthStatus {
  status: string;
  timestamp: string;
  service?: string;
  uptime?: number;
  environment?: string;
  version?: string;
  services?: Record<string, string>;
}

interface FullHealthStatus {
  bff: HealthStatus;
  gamingServices: HealthStatus;
  overall: {
    status: string;
    timestamp: string;
  };
}

export default function Home() {
  const [healthStatus, setHealthStatus] = useState<FullHealthStatus | null>(null);
  const [liveFixtures, setLiveFixtures] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Test BFF communication with full health check
        const healthResponse = await apiClient.checkFullHealth();
        if (healthResponse.error) {
          throw new Error(`Health check failed: ${healthResponse.error}`);
        }
        setHealthStatus(healthResponse.data as FullHealthStatus);

        // Test API routing through BFF
        const fixturesResponse = await apiClient.getLiveFixtures();
        if (fixturesResponse.error) {
          console.warn('Live fixtures failed:', fixturesResponse.error);
        } else {
          setLiveFixtures(fixturesResponse.data as unknown[]);
        }

      } catch (err) {
        console.error('API call failed:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    // Add a small delay to ensure component is mounted
    const timer = setTimeout(fetchData, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start max-w-4xl w-full">
        <div className="flex items-center gap-4">
          <Image
            className="dark:invert"
            src="/next.svg"
            alt="Next.js logo"
            width={180}
            height={38}
            priority
          />
          <div className="text-2xl font-bold">🔗 Inter-Service Communication</div>
        </div>

        {/* Phase 2 Status */}
        <div className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-lg border">
          <h2 className="text-xl font-semibold mb-4 text-blue-800 dark:text-blue-200">
            🚀 Phase 2: Frontend ↔ BFF Communication
          </h2>
          
          {loading && (
            <div className="flex items-center gap-2 text-blue-600">
              <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              Testing BFF connectivity...
            </div>
          )}

          {error && (
            <div className="bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded">
              ❌ Connection Error: {error}
            </div>
          )}

          {healthStatus && (
            <div className="space-y-4">
              {/* Overall Status */}
              <div className={`p-4 rounded border text-center font-semibold ${
                healthStatus.overall.status === 'ok' 
                  ? 'bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200'
                  : 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200'
              }`}>
                🎯 System Status: {healthStatus.overall.status.toUpperCase()}
                <div className="text-sm font-normal mt-1">
                  Frontend → BFF → Gaming Services communication is working!
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* BFF Status */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded border">
                  <h3 className="font-semibold text-green-700 dark:text-green-300 mb-2">
                    ✅ BFF Service
                  </h3>
                  <div className="text-sm space-y-1">
                    <div>Status: <span className="font-mono text-green-600">{healthStatus.bff.status}</span></div>
                    <div>Service: <span className="font-mono">{healthStatus.bff.service}</span></div>
                  </div>
                </div>

                {/* Gaming Services Status */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded border">
                  <h3 className="font-semibold text-green-700 dark:text-green-300 mb-2">
                    ✅ Gaming Services (via BFF)
                  </h3>
                  <div className="text-sm space-y-1">
                    <div>Status: <span className="font-mono text-green-600">{healthStatus.gamingServices.status}</span></div>
                    <div>Environment: <span className="font-mono">{healthStatus.gamingServices.environment}</span></div>
                    <div>Uptime: <span className="font-mono">{Math.round((healthStatus.gamingServices.uptime || 0) / 60)}m</span></div>
                  </div>
                </div>
              </div>

              {/* Live Fixtures Test */}
              <div className="bg-white dark:bg-gray-800 p-4 rounded border">
                <h3 className="font-semibold text-purple-700 dark:text-purple-300 mb-2">
                  ⚽ Live Fixtures API Test
                </h3>
                <div className="text-sm">
                  <div>Endpoint: <span className="font-mono text-purple-600">/api/fixtures/live</span></div>
                  <div>Results: <span className="font-mono">{liveFixtures.length} live matches</span></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* API Endpoints Available */}
        <div className="w-full bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">🔗 Available API Endpoints (via BFF)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold text-blue-600 mb-2">Health & Status</h4>
              <ul className="space-y-1 font-mono text-xs">
                <li>• /health/full</li>
                <li>• /api/health</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-green-600 mb-2">Fixtures</h4>
              <ul className="space-y-1 font-mono text-xs">
                <li>• /api/fixtures</li>
                <li>• /api/fixtures/live</li>
                <li>• /api/fixtures/:id</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <button
            onClick={() => window.location.reload()}
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
          >
            🔄 Refresh Status
          </button>
          <a
            className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
            href="https://bff-service-production-644c.up.railway.app/health/full"
            target="_blank"
            rel="noopener noreferrer"
          >
            🔗 View BFF Health
          </a>
        </div>
      </main>
    </div>
  );
}
