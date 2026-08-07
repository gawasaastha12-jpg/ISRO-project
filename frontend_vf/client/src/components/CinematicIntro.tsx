import React, { useEffect } from 'react';

/**
 * Minimal placeholder for the original CinematicIntro component.
 * It simply displays a short loading screen and calls `onComplete`
 * after a brief delay so the rest of the app can render.
 */
export default function CinematicIntro({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    // Simulate a short intro sequence (2 seconds)
    const timer = setTimeout(() => {
      onComplete();
    }, 2000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="flex items-center justify-center w-full h-screen bg-black text-white">
      <p className="text-xl animate-pulse">Loading intro...</p>
    </div>
  );
}
