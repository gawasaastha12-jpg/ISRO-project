import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { COSMIC_IMAGES } from '@/lib/cosmic-assets';

/**
 * Overview Hero Section
 * 
 * Immersive introduction to the ADITYA-L1 SOLAR INTELLIGENCE PLATFORM Platform
 */

interface OverviewHeroProps {
  onComplete?: () => void;
}

export default function OverviewHero({ onComplete }: OverviewHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tl = gsap.timeline();

    // Fade in background
    if (containerRef.current) {
      tl.fromTo(
        containerRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 1.5 }
      );
    }

    // Animate title
    if (titleRef.current) {
      tl.fromTo(
        titleRef.current,
        { opacity: 0, y: 30, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 1.2, ease: 'back.out' },
        0.5
      );
    }

    // Animate subtitle
    if (subtitleRef.current) {
      tl.fromTo(
        subtitleRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 1, ease: 'power2.out' },
        0.8
      );
    }

    // Animate description
    if (descriptionRef.current) {
      tl.fromTo(
        descriptionRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 1, ease: 'power2.out' },
        1
      );
    }

    // Hold for 3 seconds then fade out
    if (containerRef.current) {
      tl.to(containerRef.current, { opacity: 0, duration: 1.5 }, '+=3');
    }

    // Call onComplete when animation finishes
    tl.eventCallback('onComplete', () => {
      onComplete?.();
    });

    return () => {
      tl.kill();
    };
  }, [onComplete]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 bg-cover bg-center bg-no-repeat overflow-hidden"
      style={{
        backgroundImage: `url(${COSMIC_IMAGES.galaxy_field})`,
      }}
    >
      {/* Gradient overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />

      {/* Animated accent lines */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-0 right-0 h-px bg-gradient-to-r from-transparent via-electric-blue to-transparent opacity-30" />
        <div className="absolute bottom-1/3 left-0 right-0 h-px bg-gradient-to-r from-transparent via-deep-purple to-transparent opacity-30" />
      </div>

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-8">
        <div className="text-center space-y-8 max-w-4xl">
          {/* Main title */}
          <h1
            ref={titleRef}
            className="text-7xl md:text-8xl font-black tracking-wider"
            style={{
              fontFamily: "'Orbitron', sans-serif",
              color: '#00d9ff',
              textShadow: '0 0 40px rgba(0, 217, 255, 0.8), 0 0 80px rgba(124, 58, 237, 0.5)',
            }}
          >
            ADITYA-L1 SOLAR INTELLIGENCE PLATFORM
          </h1>

          {/* Subtitle */}
          <p
            ref={subtitleRef}
            className="text-2xl md:text-3xl text-nebula-violet font-light tracking-widest"
            style={{
              fontFamily: "'Space Mono', monospace",
            }}
          >
            A Journey Through Solar Science
          </p>

          {/* Description */}
          <div
            ref={descriptionRef}
            className="space-y-4 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            <p>
              Welcome to the ADITYA-L1 SOLAR INTELLIGENCE PLATFORM Platform—a cinematic exploration of solar phenomena
              through the eyes of the Aditya-L1 space observatory.
            </p>
            <p>
              Here, coronal anomalies become cosmic mysteries, spectral emissions reveal hidden truths,
              and correlations unveil the universe's deeper logic.
            </p>
            <p className="text-electric-blue font-semibold">
              Select a module to begin your expedition into the cosmos.
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center justify-center gap-4 pt-8">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-electric-blue" />
            <div className="w-3 h-3 rounded-full bg-electric-blue animate-pulse" />
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-electric-blue" />
          </div>

          {/* Status indicators */}
          <div className="flex justify-center gap-8 pt-8 text-xs font-mono text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-electric-blue rounded-full animate-pulse" />
              <span>VELC READY</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-deep-purple rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
              <span>SOLEXS READY</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-supernova-gold rounded-full animate-pulse" style={{ animationDelay: '0.6s' }} />
              <span>FUSION READY</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
