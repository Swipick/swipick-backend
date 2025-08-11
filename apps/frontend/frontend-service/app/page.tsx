'use client';

import { useRouter } from 'next/navigation';
import GradientBackground from '../components/ui/GradientBackground';

export default function LandingPage() {
  const router = useRouter();

  const handleEnter = () => {
    router.push('/welcome');
  };

  return (
    <GradientBackground>
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <button
            onClick={handleEnter}
            className="group transition-all duration-300 ease-in-out transform hover:scale-105 active:scale-95 focus:outline-none"
            aria-label="Enter Swipick application"
          >
            <h1 className="text-6xl md:text-8xl font-bold text-white tracking-wide group-hover:text-purple-100 transition-colors duration-300 mb-4">
              swipick
            </h1>
            <p className="text-purple-200 text-base opacity-75">
              Tocca per entrare
            </p>
          </button>
        </div>
      </div>
    </GradientBackground>
  );
}
