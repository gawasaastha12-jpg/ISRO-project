import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { audioEngine } from '@/lib/audio-engine';

/**
 * Cinematic Intro Sequence
 * 
 * Features:
 * - High-impact space observatory visual atmosphere with CRT scanline raster
 * - Rotating Aditya-L1 observatory core insignia
 * - Typewriter mission briefing for ISRO Space Weather Operations
 * - Corner telemetry displays (Orbit, Payloads, Cycle, ISSDC Operations)
 * - Skip control with [ESC] key shortcut
 */

interface CinematicIntroProps {
  onComplete: () => void;
}

export default function CinematicIntro({ onComplete }: CinematicIntroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const scanlineRef = useRef<HTMLDivElement>(null);
  const isCompletedRef = useRef(false);

  const handleFinish = () => {
    if (isCompletedRef.current) return;
    isCompletedRef.current = true;
    if (containerRef.current) {
      gsap.to(containerRef.current, {
        opacity: 0,
        duration: 0.6,
        ease: 'power2.out',
        onComplete: () => {
          onComplete();
        }
      });
    } else {
      onComplete();
    }
  };

  useEffect(() => {
    // Escape key listener to skip immediately
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ') {
        handleFinish();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Try subtle audio initialization
    try {
      audioEngine.init();
    } catch {
      // Audio autoplay policy fallback
    }

    // Timeline for intro sequence
    const tl = gsap.timeline({
      onComplete: handleFinish,
    });

    // Fade in container
    if (containerRef.current) {
      tl.fromTo(
        containerRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 1.2, ease: 'power2.out' }
      );
    }

    // Scanline CRT raster sweep
    if (scanlineRef.current) {
      tl.fromTo(
        scanlineRef.current,
        { top: '-100%' },
        { top: '100%', duration: 3.5, ease: 'linear', repeat: 1 },
        0.3
      );
    }

    // Typewriter mission briefing
    if (textRef.current) {
      const text = `COSMIC INTELLIGENCE PLATFORM INITIALIZED\n\nAditya-L1 Solar Observatory (Lagrange Point L1)\nPayloads Synchronized: SoLEXS • HEL1OS • VELC\n\nISRO Space Weather Operations: ACTIVE\nWelcome, Flight Controller.`;
      textRef.current.innerHTML = '';

      let index = 0;
      let timerId: any = null;
      
      const typeWriter = () => {
        if (isCompletedRef.current) return;
        if (index < text.length && textRef.current) {
          const char = text[index];
          if (char === '\n') {
            textRef.current.innerHTML += '<br />';
          } else {
            textRef.current.innerHTML += char;
          }
          index++;
          timerId = setTimeout(typeWriter, 28);
        }
      };

      tl.call(typeWriter, [], 0.8);

      // Auto fade-out after briefing displays
      tl.to(containerRef.current, { opacity: 0, duration: 1.0, delay: 5.5 }, '+=1');

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        if (timerId) clearTimeout(timerId);
        tl.kill();
      };
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      tl.kill();
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
          opacity: 0.38,
          filter: 'hue-rotate(195deg) saturate(1.8) brightness(0.7) contrast(1.15)',
          mixBlendMode: 'screen',
        }}
      />

      {/* Atmospheric Space Overlay to blend cockpit seamlessly */}
      <div 
        className="absolute inset-0 pointer-events-none z-15"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(14, 23, 42, 0.35) 0%, rgba(5, 8, 20, 0.75) 70%, rgba(2, 4, 10, 0.95) 100%)',
        }}
      />

      {/* Starfield particles simulation */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-30 z-15"
        style={{
          backgroundImage: 'radial-gradient(1px 1px at 20px 30px, #ffffff, rgba(0,0,0,0)), radial-gradient(1px 1px at 70px 120px, #38bdf8, rgba(0,0,0,0)), radial-gradient(1.5px 1.5px at 150px 80px, #ffffff, rgba(0,0,0,0)), radial-gradient(1px 1px at 240px 190px, #818cf8, rgba(0,0,0,0)), radial-gradient(2px 2px at 310px 240px, #ffffff, rgba(0,0,0,0))',
          backgroundSize: '350px 350px'
        }}
      />

      {/* CRT Scanline overlay effect */}
      <div
        ref={scanlineRef}
        className="absolute inset-0 pointer-events-none z-20"
        style={{
          background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.18), rgba(0,0,0,0.18) 1px, transparent 1px, transparent 3px)',
          mixBlendMode: 'multiply',
        }}
      />

      {/* Vignette border glow */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_120px_rgba(2,6,23,0.9)] z-20" />

      {/* Top Navigation Bar: Skip Action */}
      <div className="absolute top-6 right-6 z-40 flex items-center gap-3">
        <button
          onClick={handleFinish}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-cyan-500/50 text-cyan-300 bg-slate-900/90 hover:bg-cyan-950/80 hover:text-white hover:border-cyan-400 text-xs font-mono tracking-widest uppercase transition-all shadow-lg cursor-pointer backdrop-blur"
          title="Skip intro sequence (Press ESC)"
        >
          <span>SKIP BRIEFING</span>
          <span className="text-[10px] text-cyan-500 font-bold">[ESC] ➔</span>
        </button>
      </div>

      {/* Top-Left Telemetry HUD */}
      <div className="absolute top-6 left-6 text-xs text-slate-400 font-mono space-y-1 z-30 hidden sm:block">
        <div className="flex items-center gap-1.5 text-cyan-400 font-bold tracking-wider">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping inline-block" />
          ISRO ADITYA-L1 MISSION CONTROL
        </div>
        <div>ORBIT: <span className="text-slate-200">Sun-Earth L1 Halo (1.5M km)</span></div>
        <div>STATION: <span className="text-slate-200">ISSDC / ISTRAC Network</span></div>
      </div>

      {/* Center Cinematic Content */}
      <div className="relative z-30 text-center space-y-7 max-w-2xl px-6">
        
        {/* Aditya-L1 Core Insignia */}
        <div className="flex justify-center mb-6">
          <div className="relative w-28 h-28 flex items-center justify-center">
            {/* Outer rotating pulse ring */}
            <div className="absolute inset-0 rounded-full border-2 border-cyan-400/40 animate-spin" style={{ animationDuration: '14s' }} />
            {/* Middle counter-rotating dashed ring */}
            <div className="absolute inset-2 rounded-full border border-dashed border-purple-400/50 animate-spin" style={{ animationDuration: '22s', animationDirection: 'reverse' }} />
            {/* Inner glowing pulse core */}
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-cyan-950 via-slate-900 to-amber-950/40 border border-cyan-400/80 flex items-center justify-center shadow-[0_0_25px_rgba(34,211,238,0.3)]">
              <div className="w-4 h-4 bg-cyan-400 rounded-full animate-ping" />
            </div>
          </div>
        </div>

        {/* Dynamic Typewriter Briefing Screen */}
        <div className="bg-slate-950/70 border border-cyan-500/30 rounded-xl p-6 shadow-2xl backdrop-blur-md">
          <div
            ref={textRef}
            className="font-mono text-sm sm:text-base text-cyan-300 leading-relaxed text-center min-h-[140px] flex flex-col justify-center"
            style={{
              textShadow: '0 0 8px rgba(34, 211, 238, 0.4)',
              fontFamily: "'Space Mono', monospace",
            }}
          />
        </div>

        {/* Loading Indicator */}
        <div className="flex items-center justify-center gap-2 pt-2">
          <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
          <span className="text-xs font-mono text-slate-400 tracking-widest uppercase">
            TELEMETRY RECEPTORS ALIGNED
          </span>
          <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
        </div>
      </div>

      {/* Bottom Telemetry HUD */}
      <div className="absolute bottom-6 left-6 text-xs text-slate-400 font-mono space-y-1 z-30 hidden sm:block">
        <div>SOLAR CYCLE: <span className="text-amber-400 font-semibold">Cycle 25 Solar Maximum</span></div>
        <div>PAYLOAD READINESS: <span className="text-emerald-400">100% NOMINAL</span></div>
      </div>

      <div className="absolute bottom-6 right-6 text-xs text-slate-400 font-mono space-y-1 text-right z-30 hidden sm:block">
        <div>TELEMETRY TIMESTAMP: <span className="text-slate-200 font-mono">{new Date().toISOString().split('T')[0]} UTC</span></div>
        <div>TERRESTRIAL LINK: <span className="text-cyan-400 font-mono">NLDC / POSOCO SYNC</span></div>
      </div>
    </div>
  );
}
