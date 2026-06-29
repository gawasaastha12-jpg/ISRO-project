import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { COSMIC_IMAGES, COSMIC_DESCRIPTIONS } from '@/lib/cosmic-assets';

/**
 * Hero Section Component
 * 
 * Immersive cinematic introduction with:
 * - Realistic cosmic background imagery
 * - Parallax depth effects
 * - Narrative text with typewriter animation
 * - Smooth fade-in transitions
 * - Responsive design
 */

interface HeroSectionProps {
  module: 'velc' | 'solexs' | 'correlation' | 'overview';
  onComplete?: () => void;
}

export default function HeroSection({ module, onComplete }: HeroSectionProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Get module-specific content
    const content = COSMIC_DESCRIPTIONS[module as keyof typeof COSMIC_DESCRIPTIONS];
    if (!content) return;

    // Get background image
    let bgImage = COSMIC_IMAGES.galaxy_field;
    if (module === 'velc') bgImage = COSMIC_IMAGES.coronal_structure;
    else if (module === 'solexs') bgImage = COSMIC_IMAGES.spectral_emission;
    else if (module === 'correlation') bgImage = COSMIC_IMAGES.cosmic_collision;

    // Set background
    if (containerRef.current) {
      containerRef.current.style.backgroundImage = `url(${bgImage})`;
    }

    // Animate title with typewriter effect
    let startId: any;
    let typeWriterId: any;
    if (titleRef.current) {
      titleRef.current.textContent = '';
      const title = content.title;
      let index = 0;

      const typeWriter = () => {
        if (titleRef.current && index < title.length) {
          titleRef.current.textContent += title[index];
          index++;
          typeWriterId = setTimeout(typeWriter, 50);
        }
      };

      // Start after delay
      startId = setTimeout(typeWriter, 300);
    }

    // Fade in subtitle
    if (subtitleRef.current) {
      gsap.fromTo(
        subtitleRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 1, delay: 0.8 }
      );
    }

    // Fade in description
    if (descriptionRef.current) {
      gsap.fromTo(
        descriptionRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 1, delay: 1.2 }
      );
    }

    // Call onComplete after animations
    const timer = setTimeout(() => onComplete?.(), 3000);
    return () => {
      clearTimeout(timer);
      clearTimeout(startId);
      clearTimeout(typeWriterId);
    };
  }, [module, onComplete]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 bg-cover bg-center bg-no-repeat overflow-hidden"
    >
      {/* Gradient overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />

      {/* Parallax effect layers */}
      <div className="absolute inset-0 opacity-30 bg-gradient-to-r from-electric-blue/20 to-deep-purple/20" />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-8">
        <div className="text-center space-y-6 max-w-4xl">
          {/* Title with typewriter effect */}
          <h1
            ref={titleRef}
            className="text-6xl md:text-7xl font-black tracking-wider"
            style={{
              fontFamily: "'Orbitron', sans-serif",
              color: '#00d9ff',
              textShadow: '0 0 30px rgba(0, 217, 255, 0.8), 0 0 60px rgba(124, 58, 237, 0.4)',
              minHeight: '100px',
            }}
          />

          {/* Subtitle */}
          <p
            ref={subtitleRef}
            className="text-xl md:text-2xl text-muted-foreground"
            style={{
              fontFamily: "'Space Mono', monospace",
              letterSpacing: '0.1em',
            }}
          >
            {COSMIC_DESCRIPTIONS[module as keyof typeof COSMIC_DESCRIPTIONS]?.subtitle}
          </p>

          {/* Description */}
          <p
            ref={descriptionRef}
            className="text-base md:text-lg text-nebula-violet leading-relaxed max-w-2xl mx-auto"
            style={{
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {COSMIC_DESCRIPTIONS[module as keyof typeof COSMIC_DESCRIPTIONS]?.description}
          </p>

          {/* Divider line */}
          <div className="flex items-center justify-center gap-4 pt-8">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-electric-blue" />
            <div className="w-3 h-3 rounded-full bg-electric-blue animate-pulse" />
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-electric-blue" />
          </div>

          {/* Narrative quote */}
          <p
            className="text-sm italic text-muted-foreground pt-4"
            style={{
              fontFamily: "'Space Mono', monospace",
            }}
          >
            "{COSMIC_DESCRIPTIONS[module as keyof typeof COSMIC_DESCRIPTIONS]?.narrative}"
          </p>
        </div>
      </div>

      {/* Animated stars/particles */}
      <div className="absolute inset-0 z-0">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.5 + 0.3,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
