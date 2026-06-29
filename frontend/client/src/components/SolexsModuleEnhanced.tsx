import React, { useState } from 'react';
import HeroSection from './HeroSection';
import SolexsModule from './SolexsModule';

/**
 * Enhanced SOLEXS Module
 * 
 * Features:
 * - Cinematic hero introduction with spectral background
 * - Immersive narrative about solar flares
 * - Interactive light curve analysis
 */

export default function SolexsModuleEnhanced() {
  const [showHero, setShowHero] = useState(true);
  const [heroComplete, setHeroComplete] = useState(false);

  const handleHeroComplete = () => {
    setHeroComplete(true);
    setTimeout(() => {
      setShowHero(false);
    }, 3000);
  };

  return (
    <div className="relative w-full h-full">
      {/* Hero Section */}
      {showHero && (
        <div
          className={`absolute inset-0 z-30 transition-opacity duration-1000 ${
            heroComplete ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ pointerEvents: heroComplete ? 'none' : 'auto' }}
        >
          <HeroSection
            module="solexs"
            onComplete={handleHeroComplete}
          />
        </div>
      )}

      {/* Main Content */}
      <div className={`absolute inset-0 transition-opacity duration-1000 ${
        showHero ? 'opacity-0' : 'opacity-100'
      }`}>
        <SolexsModule />

        {/* Cinematic introduction banner */}
        {!showHero && (
          <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-8 pointer-events-none">
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-deep-purple rounded-full animate-pulse" />
                <span className="text-sm font-semibold text-deep-purple tracking-widest">
                  SOLEXS SYSTEM ONLINE
                </span>
              </div>
              <h2
                className="text-3xl font-black text-deep-purple"
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                Spectral Event Analyzer
              </h2>
              <p className="text-muted-foreground text-sm max-w-2xl">
                Decode the ultraviolet signatures of solar violence. Every flare tells a story of
                magnetic transformation and energy release.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
