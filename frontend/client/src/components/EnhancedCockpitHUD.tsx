import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';

/**
 * Enhanced Cockpit HUD - Mission Control
 * 
 * Realistic spaceship cockpit with:
 * - Functional HUD displays
 * - Mission control terminals (Aditya-L1, Claude, Manus, Gmail)
 * - Starfield with parallax
 * - Radio chatter ambient sound
 * - Cinematic camera pan
 */

interface EnhancedCockpitHUDProps {
  onComplete?: () => void;
}

export default function EnhancedCockpitHUD({ onComplete }: EnhancedCockpitHUDProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const centerDisplayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Create starfield with parallax
    if (viewportRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = viewportRef.current.clientWidth;
      canvas.height = viewportRef.current.clientHeight;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        // Deep space background
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#0a0e27');
        gradient.addColorStop(0.5, '#0f1535');
        gradient.addColorStop(1, '#1a1f3a');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw stars with varying brightness
        for (let i = 0; i < 800; i++) {
          const x = Math.random() * canvas.width;
          const y = Math.random() * canvas.height;
          const size = Math.random() * 2;
          const brightness = Math.random();

          ctx.fillStyle = `rgba(255, 255, 255, ${brightness * 0.8})`;
          ctx.fillRect(x, y, size, size);

          // Add occasional nebula glow
          if (Math.random() > 0.98) {
            ctx.fillStyle = `rgba(0, 217, 255, ${brightness * 0.3})`;
            ctx.beginPath();
            ctx.arc(x, y, size * 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Add nebula clouds
        const nebulas = [
          { x: 0.2, y: 0.3, color: 'rgba(0, 217, 255, 0.15)' },
          { x: 0.7, y: 0.6, color: 'rgba(124, 58, 237, 0.1)' },
          { x: 0.5, y: 0.2, color: 'rgba(255, 107, 53, 0.08)' },
        ];

        nebulas.forEach((nebula) => {
          const gradient = ctx.createRadialGradient(
            nebula.x * canvas.width,
            nebula.y * canvas.height,
            0,
            nebula.x * canvas.width,
            nebula.y * canvas.height,
            400
          );
          gradient.addColorStop(0, nebula.color);
          gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        });

        viewportRef.current.appendChild(canvas);
      }
    }

    // Animation timeline
    const tl = gsap.timeline();

    // Fade in
    if (containerRef.current) {
      tl.fromTo(
        containerRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 2 }
      );
    }

    // Animate HUD elements
    if (hudRef.current) {
      tl.fromTo(
        hudRef.current,
        { opacity: 0, scale: 0.95 },
        { opacity: 1, scale: 1, duration: 1.5, ease: 'back.out' },
        0.5
      );
    }

    // Animate left panel (Aditya-L1, Claude)
    if (leftPanelRef.current) {
      tl.fromTo(
        leftPanelRef.current,
        { opacity: 0, x: -50 },
        { opacity: 1, x: 0, duration: 1, ease: 'power2.out' },
        0.8
      );
    }

    // Animate right panel (Manus, Gmail)
    if (rightPanelRef.current) {
      tl.fromTo(
        rightPanelRef.current,
        { opacity: 0, x: 50 },
        { opacity: 1, x: 0, duration: 1, ease: 'power2.out' },
        0.8
      );
    }

    // Animate center display
    if (centerDisplayRef.current) {
      tl.fromTo(
        centerDisplayRef.current,
        { opacity: 0, scale: 0.8 },
        { opacity: 1, scale: 1, duration: 1.2, ease: 'back.out' },
        1
      );
    }

    // Pulsing glow on displays
    const displays = containerRef.current?.querySelectorAll('.hud-display');
    displays?.forEach((display, i) => {
      gsap.to(display, {
        boxShadow: '0 0 30px rgba(0, 217, 255, 0.6), inset 0 0 20px rgba(0, 217, 255, 0.1)',
        duration: 2 + i * 0.3,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    });

    // Camera pan out effect
    tl.to(
      viewportRef.current,
      { scale: 1.1, duration: 3 },
      1.5
    );

    // Hold and fade out
    if (containerRef.current) {
      tl.to(containerRef.current, { opacity: 0, duration: 1.5 }, '+=3');
    }

    tl.eventCallback('onComplete', () => {
      onComplete?.();
    });

    return () => {
      tl.kill();
    };
  }, [onComplete]);

  return (
    <div ref={containerRef} className="absolute inset-0 bg-black overflow-hidden">
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
        {/* Top HUD frame */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/90 via-black/60 to-transparent border-b-2 border-electric-blue/40" />

        {/* Bottom HUD frame */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/90 via-black/60 to-transparent border-t-2 border-electric-blue/40" />

        {/* Left frame */}
        <div className="absolute top-0 left-0 bottom-0 w-24 bg-gradient-to-r from-black/80 to-transparent border-r-2 border-electric-blue/30" />

        {/* Right frame */}
        <div className="absolute top-0 right-0 bottom-0 w-24 bg-gradient-to-l from-black/80 to-transparent border-l-2 border-electric-blue/30" />
      </div>

      {/* Main HUD display */}
      <div
        ref={hudRef}
        className="absolute inset-0 flex flex-col items-center justify-center z-10"
      >
        {/* Center main display */}
        <div
          ref={centerDisplayRef}
          className="hud-display w-96 h-96 border-2 border-electric-blue rounded-lg flex items-center justify-center relative"
          style={{
            background: 'radial-gradient(circle, rgba(0, 217, 255, 0.05) 0%, rgba(0, 0, 0, 0.3) 100%)',
            boxShadow: '0 0 30px rgba(0, 217, 255, 0.6), inset 0 0 20px rgba(0, 217, 255, 0.1)',
          }}
        >
          {/* Crosshair */}
          <div className="absolute w-full h-full flex items-center justify-center">
            <div className="w-32 h-32 border-2 border-electric-blue/50 rounded-full" />
            <div className="absolute w-1 h-16 bg-electric-blue/50" />
            <div className="absolute h-1 w-16 bg-electric-blue/50" />
          </div>

          {/* Status text */}
          <div className="absolute bottom-8 text-center text-xs font-mono text-electric-blue">
            <div>MISSION CONTROL ACTIVE</div>
            <div className="text-muted-foreground text-xs mt-2">
              Aditya-L1 Observatory Online
            </div>
          </div>
        </div>

        {/* Left mission control panels */}
        <div
          ref={leftPanelRef}
          className="absolute left-8 top-1/2 transform -translate-y-1/2 space-y-4 z-20"
        >
          {/* Aditya-L1 Terminal */}
          <div className="hud-display w-48 p-4 border-2 border-electric-blue/60 rounded bg-black/60 backdrop-blur">
            <div className="text-xs font-mono text-electric-blue mb-3">
              ◆ ADITYA-L1
            </div>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div>DATA STREAM: ACTIVE</div>
              <div>CORONAL IMAGING: ONLINE</div>
              <div>ANOMALIES: 47 DETECTED</div>
              <div className="text-electric-blue mt-2">▸ RECEIVING DATA</div>
            </div>
          </div>

          {/* Claude AI Co-pilot */}
          <div className="hud-display w-48 p-4 border-2 border-deep-purple/60 rounded bg-black/60 backdrop-blur">
            <div className="text-xs font-mono text-deep-purple mb-3">
              ◆ CLAUDE AI
            </div>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div>STATUS: READY</div>
              <div>ANALYSIS MODE: ACTIVE</div>
              <div>INSIGHTS: GENERATING</div>
              <div className="text-deep-purple mt-2">▸ AWAITING INPUT</div>
            </div>
          </div>
        </div>

        {/* Right mission control panels */}
        <div
          ref={rightPanelRef}
          className="absolute right-8 top-1/2 transform -translate-y-1/2 space-y-4 z-20"
        >
          {/* Manus Platform */}
          <div className="hud-display w-48 p-4 border-2 border-supernova-gold/60 rounded bg-black/60 backdrop-blur">
            <div className="text-xs font-mono text-supernova-gold mb-3">
              ◆ MANUS PLATFORM
            </div>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div>MISSION: COSMIC INTEL</div>
              <div>SYSTEMS: OPERATIONAL</div>
              <div>CREW TERMINAL: READY</div>
              <div className="text-supernova-gold mt-2">▸ MISSION ACTIVE</div>
            </div>
          </div>

          {/* Gmail Communications */}
          <div className="hud-display w-48 p-4 border-2 border-nebula-violet/60 rounded bg-black/60 backdrop-blur">
            <div className="text-xs font-mono text-nebula-violet mb-3">
              ◆ COMMS RELAY
            </div>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div>GROUND CONTROL: ONLINE</div>
              <div>MESSAGES: 12 UNREAD</div>
              <div>SIGNAL: STRONG</div>
              <div className="text-nebula-violet mt-2">▸ RADIO ACTIVE</div>
            </div>
          </div>
        </div>
      </div>

      {/* Top status bar */}
      <div className="absolute top-8 left-8 right-8 z-20 flex justify-between text-xs font-mono text-muted-foreground">
        <div className="space-y-1">
          <div className="text-electric-blue">STARSHIP: COSMIC EXPLORER</div>
          <div>MISSION TIME: 00:00:00</div>
        </div>
        <div className="space-y-1 text-right">
          <div className="text-electric-blue">SYSTEMS: NOMINAL</div>
          <div>VELOCITY: 0.1c</div>
        </div>
      </div>

      {/* Scan lines effect */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.15), rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px)',
          mixBlendMode: 'multiply',
        }}
      />
    </div>
  );
}
