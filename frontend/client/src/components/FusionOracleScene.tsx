import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { audioEngine } from '@/lib/audio-engine';

/**
 * Fusion Oracle Scene - AI Hologram Finale
 * 
 * Features:
 * - Holographic AI oracle in cosmic void
 * - Narrative insights about solar science
 * - Particle effects and glowing elements
 * - Cinematic conclusion
 */

interface FusionOracleSceneProps {
  onComplete?: () => void;
}

export default function FusionOracleScene({ onComplete }: FusionOracleSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const oracleRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Create particle background
    if (particleCanvasRef.current) {
      const canvas = particleCanvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;

      if (ctx) {
        const particles: Array<{
          x: number;
          y: number;
          vx: number;
          vy: number;
          life: number;
          maxLife: number;
        }> = [];

        // Create initial particles
        for (let i = 0; i < 100; i++) {
          particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            life: Math.random() * 100,
            maxLife: 100 + Math.random() * 100,
          });
        }

        const animateParticles = () => {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          particles.forEach((p, i) => {
            p.x += p.vx;
            p.y += p.vy;
            p.life += 1;

            if (p.life > p.maxLife) {
              particles[i] = {
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                life: 0,
                maxLife: 100 + Math.random() * 100,
              };
            }

            const brightness = 1 - p.life / p.maxLife;
            ctx.fillStyle = `rgba(0, 217, 255, ${brightness * 0.6})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1, 0, Math.PI * 2);
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
        { opacity: 1, duration: 1.5 }
      );
    }

    // Animate oracle appearance
    if (oracleRef.current) {
      tl.fromTo(
        oracleRef.current,
        { opacity: 0, scale: 0.5 },
        { opacity: 1, scale: 1, duration: 1.5, ease: 'back.out' },
        0.5
      );

      // Pulsing glow
      gsap.to(oracleRef.current, {
        boxShadow: '0 0 60px rgba(0, 217, 255, 0.8), 0 0 120px rgba(124, 58, 237, 0.4)',
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    }

    // Animate text
    if (textRef.current) {
      const text = textRef.current.textContent || '';
      textRef.current.textContent = '';

      let index = 0;
      const typeWriter = () => {
        if (index < text.length) {
          const char = text[index];
          if (char === '\n') {
            textRef.current!.innerHTML += '<br />';
          } else {
            textRef.current!.textContent += char;
          }
          index++;
          setTimeout(typeWriter, 40);
        }
      };

      tl.call(typeWriter, [], 1.5);
      tl.call(() => {
        audioEngine.speak(text);
      }, [], 1.5);
    }

    // Hold and fade out
    if (containerRef.current) {
      tl.to(containerRef.current, { opacity: 0, duration: 1.5 }, '+=4');
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
      {/* Particle background */}
      <canvas
        ref={particleCanvasRef}
        className="absolute inset-0"
      />

      {/* Cosmic void gradient */}
      <div className="absolute inset-0 bg-gradient-radial from-deep-purple/20 via-black to-black pointer-events-none" />

      {/* Oracle hologram */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div
          ref={oracleRef}
          className="w-64 h-64 rounded-full border-2 border-electric-blue flex items-center justify-center relative"
          style={{
            background: 'radial-gradient(circle, rgba(0, 217, 255, 0.1) 0%, rgba(124, 58, 237, 0.05) 100%)',
            boxShadow: '0 0 60px rgba(0, 217, 255, 0.8), 0 0 120px rgba(124, 58, 237, 0.4)',
          }}
        >
          {/* Inner glow */}
          <div className="absolute inset-4 rounded-full border border-deep-purple/50" />
          <div className="absolute inset-8 rounded-full border border-electric-blue/30" />

          {/* Center point */}
          <div className="w-8 h-8 rounded-full bg-electric-blue animate-pulse" />

          {/* Rotating rings */}
          <div
            className="absolute inset-0 rounded-full border border-electric-blue/20"
            style={{
              animation: 'spin 4s linear infinite',
            }}
          />
          <div
            className="absolute inset-12 rounded-full border border-deep-purple/20"
            style={{
              animation: 'spin 6s linear reverse infinite',
            }}
          />
        </div>
      </div>

      {/* Oracle text */}
      <div className="absolute inset-0 flex items-end justify-center z-20 pb-32 px-8">
        <div
          ref={textRef}
          className="max-w-3xl text-center text-lg text-muted-foreground leading-relaxed"
          style={{
            fontFamily: "'Space Mono', monospace",
            minHeight: '120px',
          }}
        >
          The cosmos reveals its secrets through observation and correlation. Solar phenomena are not
          isolated events, but interconnected expressions of the universe's fundamental forces. By
          analyzing coronal anomalies, spectral emissions, and their relationships, we unlock the
          mysteries of stellar dynamics. Your mission continues...
        </div>
      </div>

      {/* Mission status */}
      <div className="absolute top-8 left-8 text-xs font-mono text-muted-foreground space-y-2 z-20">
        <div className="text-electric-blue">FUSION ENGINE ACTIVE</div>
        <div>AI ORACLE: ONLINE</div>
        <div>INSIGHTS GENERATED: 47</div>
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
