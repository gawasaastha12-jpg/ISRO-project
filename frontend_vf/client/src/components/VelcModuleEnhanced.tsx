import React, { useState, useEffect } from 'react';
import HeroSection from './HeroSection';
import VelcModule from './VelcModule';
import { ChevronRight } from 'lucide-react';

/**
 * Enhanced VELC Module
 * 
 * Features:
 * - Cinematic hero introduction with cosmic background
 * - Immersive narrative storytelling
 * - Realistic coronal anomaly visualizations
 * - Interactive exploration interface
 */

export default function VelcModuleEnhanced() {
  const [showHero, setShowHero] = useState(true);
  const [heroComplete, setHeroComplete] = useState(false);

  const handleHeroComplete = () => {
    setHeroComplete(true);
    // Keep hero visible for 3 more seconds then fade out
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
            module="velc"
            onComplete={handleHeroComplete}
          />
        </div>
      )}

      {/* Main Content */}
      <div className={`absolute inset-0 transition-opacity duration-1000 ${
        showHero ? 'opacity-0' : 'opacity-100'
      }`}>
        <VelcModule />

        {/* Cinematic introduction banner */}
        {!showHero && (
          <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-8 pointer-events-none">
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-electric-blue rounded-full animate-pulse" />
                <span className="text-sm font-semibold text-electric-blue tracking-widest">
                  VELC SYSTEM ONLINE
                </span>
              </div>
              <h2
                className="text-3xl font-black text-electric-blue"
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                Coronal Anomaly Explorer
              </h2>
              <p className="text-muted-foreground text-sm max-w-2xl">
                Explore the dynamic structures of the solar corona. Each anomaly represents a unique
                phenomenon worthy of scientific investigation.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
