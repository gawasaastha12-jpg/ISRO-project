import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';

/**
 * Nebula Data Cloud - Fusion Insights Finale
 * 
 * Features:
 * - Vast nebula cloud visualization
 * - AI hologram with constellation connections
 * - Glowing constellation lines
 * - Ambient serenity with particle drift
 * - Final mission summary
 */

interface NebulaDataCloudProps {
  onComplete?: () => void;
}

export default function NebulaDataCloud({ onComplete }: NebulaDataCloudProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const oracleRef = useRef<HTMLDivElement>(null);
  const constellationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Create nebula background
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;

      if (ctx) {
        // Deep space gradient
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#0a0e27');
        gradient.addColorStop(0.5, '#1a1f4a');
        gradient.addColorStop(1, '#0f1535');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Nebula clouds
        const nebulas = [
          {
            x: 0.3,
            y: 0.4,
            color: 'rgba(0, 217, 255, 0.2)',
            size: 600,
          },
          {
            x: 0.7,
            y: 0.3,
            color: 'rgba(124, 58, 237, 0.15)',
            size: 500,
          },
          {
            x: 0.5,
            y: 0.7,
            color: 'rgba(255, 107, 53, 0.1)',
            size: 400,
          },
        ];

        nebulas.forEach((nebula) => {
          const radialGradient = ctx.createRadialGradient(
            nebula.x * canvas.width,
            nebula.y * canvas.height,
            0,
            nebula.x * canvas.width,
            nebula.y * canvas.height,
            nebula.size
          );
          radialGradient.addColorStop(0, nebula.color);
          radialGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.fillStyle = radialGradient;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        });

        // Draw stars
        for (let i = 0; i < 500; i++) {
          const x = Math.random() * canvas.width;
          const y = Math.random() * canvas.height;
          const size = Math.random() * 1.5;
          const brightness = Math.random() * 0.7 + 0.3;

          ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
          ctx.fillRect(x, y, size, size);
        }

        // Animate particles
        const particles: Array<{
          x: number;
          y: number;
          vx: number;
          vy: number;
          life: number;
          maxLife: number;
        }> = [];

        for (let i = 0; i < 150; i++) {
          particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            life: Math.random() * 100,
            maxLife: 100 + Math.random() * 150,
          });
        }

        const animateParticles = () => {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          particles.forEach((p, i) => {
            p.x += p.vx;
            p.y += p.vy;
            p.life += 1;

            if (p.life > p.maxLife) {
              particles[i] = {
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                life: 0,
                maxLife: 100 + Math.random() * 150,
              };
            }

            const brightness = 1 - p.life / p.maxLife;
            ctx.fillStyle = `rgba(0, 217, 255, ${brightness * 0.5})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
            ctx.fill();
          });

          requestAnimationFrame(animateParticles);
        };

        animateParticles();
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

    // Animate oracle
    if (oracleRef.current) {
      tl.fromTo(
        oracleRef.current,
        { opacity: 0, scale: 0.5 },
        { opacity: 1, scale: 1, duration: 1.5, ease: 'back.out' },
        0.5
      );

      // Pulsing glow
      gsap.to(oracleRef.current, {
        boxShadow: '0 0 80px rgba(0, 217, 255, 0.8), 0 0 160px rgba(124, 58, 237, 0.4)',
        duration: 2.5,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    }

    // Animate constellations
    if (constellationRef.current) {
      tl.fromTo(
        constellationRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 1.5 },
        1
      );
    }

    // Hold and fade out
    if (containerRef.current) {
      tl.to(containerRef.current, { opacity: 0, duration: 2 }, '+=5');
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
      {/* Nebula background */}
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Cosmic void gradient overlay */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-black/30 to-black pointer-events-none" />

      {/* AI Hologram Oracle */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div
          ref={oracleRef}
          className="w-80 h-80 rounded-full border-2 border-electric-blue flex items-center justify-center relative"
          style={{
            background: 'radial-gradient(circle, rgba(0, 217, 255, 0.15) 0%, rgba(124, 58, 237, 0.08) 100%)',
            boxShadow: '0 0 80px rgba(0, 217, 255, 0.8), 0 0 160px rgba(124, 58, 237, 0.4)',
          }}
        >
          {/* Inner rings */}
          <div className="absolute inset-6 rounded-full border border-deep-purple/50" />
          <div className="absolute inset-12 rounded-full border border-electric-blue/30" />
          <div className="absolute inset-20 rounded-full border border-supernova-gold/20" />

          {/* Center point */}
          <div className="w-12 h-12 rounded-full bg-electric-blue animate-pulse" />

          {/* Rotating rings */}
          <div
            className="absolute inset-0 rounded-full border border-electric-blue/20"
            style={{
              animation: 'spin 5s linear infinite',
            }}
          />
          <div
            className="absolute inset-16 rounded-full border border-deep-purple/20"
            style={{
              animation: 'spin 7s linear reverse infinite',
            }}
          />
        </div>
      </div>

      {/* Constellation connections */}
      <div
        ref={constellationRef}
        className="absolute inset-0 pointer-events-none z-5"
        style={{
          opacity: 0.4,
        }}
      >
        <svg className="w-full h-full" viewBox="0 0 1280 720">
          {/* Connection lines */}
          <line x1="200" y1="150" x2="600" y2="300" stroke="rgba(0, 217, 255, 0.3)" strokeWidth="1" />
          <line x1="600" y1="300" x2="1000" y2="200" stroke="rgba(124, 58, 237, 0.3)" strokeWidth="1" />
          <line x1="1000" y1="200" x2="800" y2="500" stroke="rgba(255, 107, 53, 0.3)" strokeWidth="1" />
          <line x1="800" y1="500" x2="400" y2="450" stroke="rgba(0, 217, 255, 0.3)" strokeWidth="1" />
          <line x1="400" y1="450" x2="200" y2="150" stroke="rgba(124, 58, 237, 0.3)" strokeWidth="1" />

          {/* Constellation nodes */}
          <circle cx="200" cy="150" r="8" fill="rgba(0, 217, 255, 0.6)" />
          <circle cx="600" cy="300" r="8" fill="rgba(124, 58, 237, 0.6)" />
          <circle cx="1000" cy="200" r="8" fill="rgba(255, 107, 53, 0.6)" />
          <circle cx="800" cy="500" r="8" fill="rgba(0, 217, 255, 0.6)" />
          <circle cx="400" cy="450" r="8" fill="rgba(124, 58, 237, 0.6)" />
        </svg>
      </div>

      {/* Mission status */}
      <div className="absolute top-8 left-8 text-xs font-mono text-muted-foreground space-y-2 z-20">
        <div className="text-electric-blue">FUSION ENGINE ACTIVE</div>
        <div>AI ORACLE: ONLINE</div>
        <div>INSIGHTS GENERATED: 47</div>
      </div>

      {/* Insights text */}
      <div className="absolute bottom-8 left-8 right-8 max-w-2xl text-center text-sm font-mono text-muted-foreground z-20">
        <div className="text-deep-purple mb-4">FUSION INSIGHTS</div>
        <p className="leading-relaxed">
          The cosmos reveals its secrets through observation and correlation. Solar phenomena are interconnected
          expressions of stellar dynamics. By analyzing coronal anomalies, spectral emissions, and their relationships,
          we unlock the mysteries of the universe. Your mission continues...
        </p>
      </div>

      {/* Cosmic coordinates */}
      <div className="absolute bottom-8 right-8 text-xs font-mono text-muted-foreground text-right space-y-1 z-20">
        <div>COSMIC COORDINATES: 0.0, 0.0, 0.0</div>
        <div>DIMENSIONAL PHASE: STABLE</div>
        <div>MISSION STATUS: ONGOING</div>
      </div>

      {/* Scan lines */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.1), rgba(0,0,0,0.1) 1px, transparent 1px, transparent 2px)',
          mixBlendMode: 'multiply',
        }}
      />

      {/* CSS for animations */}
      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
