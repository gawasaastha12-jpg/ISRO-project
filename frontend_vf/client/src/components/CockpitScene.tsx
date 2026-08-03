import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';

/**
 * Cockpit Scene - Interstellar Style
 * 
 * Immersive spaceship cockpit with:
 * - Starfield outside viewport
 * - Dashboard with holographic displays
 * - Mission briefing HUD
 * - Cinematic camera movement
 */

interface CockpitSceneProps {
  onComplete?: () => void;
}

export default function CockpitScene({ onComplete }: CockpitSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const holograms = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    // Create starfield
    if (viewportRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = viewportRef.current.clientWidth;
      canvas.height = viewportRef.current.clientHeight;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw stars
        for (let i = 0; i < 500; i++) {
          const x = Math.random() * canvas.width;
          const y = Math.random() * canvas.height;
          const size = Math.random() * 1.5;
          const brightness = Math.random();

          ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
          ctx.fillRect(x, y, size, size);
        }

        // Add nebula glow
        const gradient = ctx.createRadialGradient(
          canvas.width / 2,
          canvas.height / 2,
          0,
          canvas.width / 2,
          canvas.height / 2,
          canvas.width
        );
        gradient.addColorStop(0, 'rgba(0, 217, 255, 0.1)');
        gradient.addColorStop(0.5, 'rgba(124, 58, 237, 0.05)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        viewportRef.current.appendChild(canvas);
      }
    }

    // Animation timeline
    const tl = gsap.timeline();

    // Fade in cockpit
    tl.fromTo(
      containerRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 1.5 }
    );

    // Animate dashboard panels
    if (dashboardRef.current) {
      const panels = dashboardRef.current.querySelectorAll('.dashboard-panel');
      tl.fromTo(
        panels,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8, stagger: 0.2 },
        0.5
      );
    }

    // Animate hologram displays
    holograms.current.forEach((hologram, index) => {
      tl.fromTo(
        hologram,
        { opacity: 0, scale: 0.8 },
        { opacity: 1, scale: 1, duration: 1, ease: 'back.out' },
        0.8 + index * 0.2
      );
    });

    // Pulsing hologram effect
    holograms.current.forEach((hologram) => {
      gsap.to(hologram, {
        opacity: 0.7,
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    });

    // Hold and then fade out
    tl.to(containerRef.current, { opacity: 0, duration: 1.5 }, '+=4');

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
      className="absolute inset-0 bg-black overflow-hidden"
    >
      {/* Starfield viewport */}
      <div
        ref={viewportRef}
        className="absolute inset-0"
        style={{
          perspective: '1000px',
        }}
      />

      {/* Cockpit frame overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top frame */}
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/80 to-transparent border-b border-electric-blue/30" />

        {/* Side frames */}
        <div className="absolute top-0 left-0 bottom-0 w-16 bg-gradient-to-r from-black/60 to-transparent border-r border-electric-blue/20" />
        <div className="absolute top-0 right-0 bottom-0 w-16 bg-gradient-to-l from-black/60 to-transparent border-l border-electric-blue/20" />

        {/* Bottom frame */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/80 to-transparent border-t border-electric-blue/30" />
      </div>

      {/* Dashboard */}
      <div
        ref={dashboardRef}
        className="absolute bottom-8 left-8 right-8 z-10 space-y-4"
      >
        {/* Status panels */}
        <div className="grid grid-cols-3 gap-4">
          {/* Left panel */}
          <div className="dashboard-panel bg-black/60 border border-electric-blue/50 rounded p-4 backdrop-blur">
            <div className="text-xs font-mono text-electric-blue mb-2">
              NAVIGATION
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div>HEADING: 045°</div>
              <div>ALTITUDE: 384,400 km</div>
              <div>VELOCITY: 11.2 km/s</div>
            </div>
          </div>

          {/* Center panel */}
          <div className="dashboard-panel bg-black/60 border border-deep-purple/50 rounded p-4 backdrop-blur">
            <div className="text-xs font-mono text-deep-purple mb-2">
              SYSTEMS
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div>POWER: 98%</div>
              <div>SHIELDS: ACTIVE</div>
              <div>COMMS: ONLINE</div>
            </div>
          </div>

          {/* Right panel */}
          <div className="dashboard-panel bg-black/60 border border-supernova-gold/50 rounded p-4 backdrop-blur">
            <div className="text-xs font-mono text-supernova-gold mb-2">
              MISSION
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div>OBJECTIVE: ANALYZE</div>
              <div>TARGETS: 3</div>
              <div>STATUS: READY</div>
            </div>
          </div>
        </div>

        {/* Mission briefing */}
        <div className="bg-black/60 border border-electric-blue/30 rounded p-4 backdrop-blur">
          <div className="text-xs font-mono text-electric-blue mb-2">
            MISSION BRIEFING
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Welcome aboard the Cosmic Intelligence Platform. Your mission: navigate through solar phenomena,
            analyze coronal anomalies, study spectral emissions, and discover hidden correlations in the cosmos.
          </p>
        </div>
      </div>

      {/* Holographic displays */}
      <div className="absolute top-32 left-1/2 transform -translate-x-1/2 z-10 space-y-8">
        {/* Main hologram */}
        <div
          ref={(el) => {
            if (el) holograms.current[0] = el;
          }}
          className="w-48 h-48 mx-auto"
          style={{
            perspective: '1000px',
          }}
        >
          <div className="w-full h-full border-2 border-electric-blue rounded-lg flex items-center justify-center bg-gradient-to-br from-electric-blue/10 to-deep-purple/10 backdrop-blur-sm relative overflow-hidden">
            {/* Hologram content */}
            <div className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto border-2 border-electric-blue rounded-full flex items-center justify-center animate-spin" style={{ animationDuration: '4s' }}>
                <div className="w-16 h-16 border border-deep-purple rounded-full" />
              </div>
              <div className="text-xs font-mono text-electric-blue">
                SYSTEM READY
              </div>
            </div>

            {/* Hologram glow */}
            <div className="absolute inset-0 bg-gradient-to-t from-electric-blue/20 to-transparent pointer-events-none" />
          </div>
        </div>

        {/* Secondary holograms */}
        <div className="flex justify-center gap-8">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              ref={(el) => {
                if (el) holograms.current[i + 1] = el;
              }}
              className="w-24 h-24 border border-deep-purple/50 rounded flex items-center justify-center bg-black/40 backdrop-blur"
            >
              <div className="text-xs font-mono text-deep-purple text-center">
                {['VELC', 'SOLEXS', 'FUSION'][i]}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scan lines effect */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.1), rgba(0,0,0,0.1) 1px, transparent 1px, transparent 2px)',
          mixBlendMode: 'multiply',
        }}
      />

      {/* Corner text */}
      <div className="absolute top-8 left-8 text-xs font-mono text-muted-foreground space-y-1 z-20">
        <div>ADITYA-L1 OBSERVATORY</div>
        <div>STARSHIP: COSMIC EXPLORER</div>
        <div>STATUS: OPERATIONAL</div>
      </div>

      <div className="absolute top-8 right-8 text-xs font-mono text-muted-foreground text-right space-y-1 z-20">
        <div>MISSION TIME: 00:00:00</div>
        <div>DISTANCE: 1.5M km</div>
        <div>SOLAR CYCLE: 25</div>
      </div>
    </div>
  );
}
