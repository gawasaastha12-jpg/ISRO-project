import React, { useState } from 'react';
import HeroSection from './HeroSection';
import CorrelationEngine from './CorrelationEngine';

/**
 * Enhanced Correlation Engine
 * 
 * Features:
 * - Cinematic hero with wormhole imagery
 * - Narrative about fusion of intelligence
 * - Interactive correlation visualization
 */

export default function CorrelationEngineEnhanced() {
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
            module="correlation"
            onComplete={handleHeroComplete}
          />
        </div>
      )}

      {/* Main Content */}
      <div className={`absolute inset-0 transition-opacity duration-1000 ${
        showHero ? 'opacity-0' : 'opacity-100'
      }`}>
        <CorrelationEngine />

        {/* Cinematic introduction banner */}
        {!showHero && (
          <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-8 pointer-events-none">
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-supernova-gold rounded-full animate-pulse" />
                <span className="text-sm font-semibold text-supernova-gold tracking-widest">
                  CORRELATION ENGINE ACTIVE
                </span>
              </div>
              <h2
                className="text-3xl font-black text-supernova-gold"
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                Fusion Intelligence Layer
              </h2>
              <p className="text-muted-foreground text-sm max-w-2xl">
                When multiple observations converge, hidden truths emerge. The Correlation Engine
                reveals the deep connections between coronal and spectral phenomena.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
