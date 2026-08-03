import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { COSMIC_IMAGES } from '@/lib/cosmic-assets';

/**
 * Cinematic Intro Sequence
 * 
 * Features:
 * - Dramatic opening with cosmic imagery
 * - Typewriter effect for mission briefing
 * - Fade-in animations for UI elements
 * - Realistic space observatory atmosphere
 */

interface CinematicIntroProps {
  onComplete: () => void;
}

export default function CinematicIntro({ onComplete }: CinematicIntroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const scanlineRef = useRef<HTMLDivElement>(null);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    // Timeline for intro sequence
    const tl = gsap.timeline({
      onComplete: () => onCompleteRef.current?.(),
    });

    // Fade in background
    tl.fromTo(
      containerRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 1.5, ease: 'power2.inOut' }
    );

    // Scanline animation (CRT effect)
    if (scanlineRef.current) {
      tl.fromTo(
        scanlineRef.current,
        { top: '-100%' },
        { top: '100%', duration: 3, ease: 'power1.inOut' },
        0.5
      );
    }

    // Text typewriter effect
    if (textRef.current) {
      const text = 'COSMIC INTELLIGENCE PLATFORM INITIALIZED\n\nAditya-L1 Solar Observatory\nMission Status: ACTIVE\n\nWelcome, Observer.';
      textRef.current.innerHTML = '';

      let index = 0;
      const typeWriter = () => {
        if (index < text.length) {
          const char = text[index];
          if (char === '\n') {
            textRef.current!.innerHTML += '<br />';
          } else {
            textRef.current!.innerHTML += char;
          }
          index++;
          setTimeout(typeWriter, 30);
        }
      };

      tl.call(typeWriter, [], 1);
    }

    // Fade out after 5 seconds
    tl.to(containerRef.current, { opacity: 0, duration: 1.5, delay: 3 }, '+=1');

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden"
      style={{
        backgroundImage: `url(${COSMIC_IMAGES.galaxy_field})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/80" />

      {/* Scanline effect (CRT monitor) */}
      <div
        ref={scanlineRef}
        className="absolute inset-0 pointer-events-none z-20"
        style={{
          background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.15), rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px)',
          mixBlendMode: 'multiply',
        }}
      />

      {/* Content */}
      <div className="relative z-10 text-center space-y-8 max-w-2xl px-8">
        {/* Logo/Icon */}
        <div className="flex justify-center mb-8">
          <div className="w-24 h-24 rounded-full border-2 border-electric-blue flex items-center justify-center animate-pulse">
            <div className="w-20 h-20 rounded-full border-2 border-deep-purple flex items-center justify-center">
              <div className="w-4 h-4 bg-electric-blue rounded-full animate-pulse" />
            </div>
          </div>
        </div>

        {/* Mission briefing text */}
        <div
          ref={textRef}
          className="font-mono text-lg text-electric-blue leading-relaxed"
          style={{
            textShadow: '0 0 10px rgba(0, 217, 255, 0.5)',
            fontFamily: "'Space Mono', monospace",
            minHeight: '200px',
          }}
        />

        {/* Loading indicator */}
        <div className="flex items-center justify-center gap-2 pt-8">
          <div className="w-2 h-2 bg-electric-blue rounded-full animate-pulse" />
          <span className="text-sm text-muted-foreground">SYSTEMS LOADING</span>
          <div className="w-2 h-2 bg-electric-blue rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
        </div>
      </div>

      {/* Corner data displays */}
      <div className="absolute top-8 left-8 text-xs text-muted-foreground font-mono space-y-2">
        <div>TIMESTAMP: {new Date().toISOString().split('T')[0]}</div>
        <div>LOCATION: L1 Lagrange Point</div>
        <div>STATUS: OPERATIONAL</div>
      </div>

      <div className="absolute bottom-8 right-8 text-xs text-muted-foreground font-mono space-y-2 text-right">
        <div>SOLAR CYCLE: 25</div>
        <div>OBSERVATION MODE: ACTIVE</div>
        <div>ANOMALY DETECTION: ENABLED</div>
      </div>
    </div>
  );
}
