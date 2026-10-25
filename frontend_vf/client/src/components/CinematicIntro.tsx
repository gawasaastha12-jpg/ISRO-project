import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface CinematicIntroProps {
  onComplete: () => void;
}

export default function CinematicIntro({ onComplete }: CinematicIntroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const isCompletedRef = useRef(false);

  const handleFinish = () => {
    if (isCompletedRef.current) return;
    isCompletedRef.current = true;
    if (containerRef.current) {
      gsap.to(containerRef.current, {
        opacity: 0,
        duration: 0.4,
        ease: 'power2.inOut',
        onComplete: () => {
          onComplete();
        }
      });
    } else {
      onComplete();
    }
  };

  useEffect(() => {
    // Quick fade in
    if (containerRef.current) {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.4, ease: 'power2.out' }
      );
    }

    // Clean text directly floating over cockpit (no box, no border)
    if (textRef.current) {
      textRef.current.innerHTML = `
        <div class="space-y-3 font-mono text-center">
          <div class="text-xs sm:text-sm tracking-[0.25em] text-cyan-400 font-bold uppercase">
            COSMIC INTELLIGENCE PLATFORM INITIALIZED
          </div>
          <div class="text-sm sm:text-base text-slate-200 tracking-wider">
            Aditya-L1 Solar Observatory (Lagrange Point L1)
          </div>
          <div class="text-xs text-cyan-300/80 tracking-wide">
            Payloads Synchronized: SoLEXS • HEL1OS • VELC
          </div>
          <div class="pt-2 text-xs sm:text-sm text-emerald-400 font-bold tracking-widest uppercase">
            ISRO Space Weather Operations: ACTIVE
          </div>
          <div class="text-xs text-slate-400 tracking-wider pt-1">
            Welcome, Flight Controller.
          </div>
        </div>
      `;
    }

    // Automatically transition to dashboard in 2 seconds
    const timer = setTimeout(() => {
      handleFinish();
    }, 1800);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-[#050814] flex items-center justify-center overflow-hidden select-none font-sans"
      style={{
        background: 'radial-gradient(ellipse at center, #0f172a 0%, #050814 70%, #02040a 100%)',
      }}
    >
      {/* Cockpit Command Deck Backdrop (Bluish Transparent Styling) */}
      <div 
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          backgroundImage: 'url(/images/cockpit-view.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.42,
          filter: 'hue-rotate(195deg) saturate(1.8) brightness(0.7) contrast(1.15)',
          mixBlendMode: 'screen',
        }}
      />

      {/* Atmospheric Space Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none z-15"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(14, 23, 42, 0.35) 0%, rgba(5, 8, 20, 0.75) 70%, rgba(2, 4, 10, 0.95) 100%)',
        }}
      />

      {/* Vignette border glow */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_120px_rgba(2,6,23,0.9)] z-20" />

      {/* Center Text (Directly on cockpit view - NO box, NO border, NO animated circles) */}
      <div className="relative z-30 max-w-2xl px-6">
        <div
          ref={textRef}
          style={{
            textShadow: '0 0 12px rgba(34, 211, 238, 0.5), 0 2px 4px rgba(0,0,0,0.8)',
            fontFamily: "'Space Mono', monospace",
          }}
        />
      </div>

      {/* Subtle corner telemetry info */}
      <div className="absolute top-6 left-6 text-xs text-slate-400 font-mono space-y-1 z-30 hidden sm:block">
        <div className="flex items-center gap-1.5 text-cyan-400 font-bold tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
          ISRO ADITYA-L1 MISSION CONTROL
        </div>
        <div>ORBIT: <span className="text-slate-200">Sun-Earth L1 Halo</span></div>
      </div>

      <div className="absolute bottom-6 right-6 text-xs text-slate-400 font-mono space-y-1 text-right z-30 hidden sm:block">
        <div>STATUS: <span className="text-emerald-400 font-bold">NOMINAL</span></div>
        <div>TELEMETRY TIME: <span className="text-slate-300 font-mono">{new Date().toISOString().split('T')[0]} UTC</span></div>
      </div>
    </div>
  );
}
