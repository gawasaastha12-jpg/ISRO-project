import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import * as THREE from 'three';
import { audioEngine } from '@/lib/audio-engine';

/**
 * Big Bang Prologue - The Birth of the Universe
 * 
 * Features:
 * - Cosmic explosion with particle burst shader
 * - Expanding galaxies in slow motion
 * - Shockwave ripple effect
 * - Deep bass rumble audio cue
 * - Narration: "From the birth of the universe, intelligence emerges..."
 */

interface BigBangPrologueProps {
  onComplete?: () => void;
}

export default function BigBangPrologue({ onComplete }: BigBangPrologueProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const narrationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Setup Three.js scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      canvasRef.current.clientWidth / canvasRef.current.clientHeight,
      0.1,
      10000
    );
    camera.position.z = 50;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvasRef.current,
        antialias: true,
        alpha: true,
      });
      renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
      renderer.setClearColor(0x000000, 1);
      rendererRef.current = renderer;
    } catch (e) {
      console.warn("BigBangPrologue WebGL context creation failed. Fallback active.", e);
      const ctx = canvasRef.current.getContext('2d');
      let fallbackAnimationId: number;
      let time = 0;
      const particles: Array<{x: number, y: number, vx: number, vy: number, size: number, color: string}> = [];
      
      if (ctx) {
        const w = canvasRef.current.width = canvasRef.current.clientWidth;
        const h = canvasRef.current.height = canvasRef.current.clientHeight;
        const cx = w / 2;
        const cy = h / 2;
        
        for (let i = 0; i < 400; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 0.5 + Math.random() * 4.0;
          const colors = ['#00d9ff', '#7c3aed', '#ffffff', '#ffaa00', '#ff0055'];
          particles.push({
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 1.0 + Math.random() * 3.0,
            color: colors[Math.floor(Math.random() * colors.length)]
          });
        }

        const runFallback = () => {
          fallbackAnimationId = requestAnimationFrame(runFallback);
          time += 0.016;
          
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, w, h);
          
          particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            
            let opacity = 0.8;
            if (time > 6) {
              opacity = Math.max(0.0, 0.8 - (time - 6) * 0.2);
            }
            
            ctx.fillStyle = p.color;
            ctx.globalAlpha = opacity;
            ctx.fill();
          });
          ctx.globalAlpha = 1.0;
        };
        runFallback();
      }

      // Narration timeline fallback
      const tl = gsap.timeline();
      if (containerRef.current) {
        tl.fromTo(containerRef.current, { opacity: 0 }, { opacity: 1, duration: 1.5 }, 0);
      }
      tl.call(() => {
        audioEngine.playRumble();
      }, [], 0.5);
      if (narrationRef.current) {
        tl.fromTo(narrationRef.current, { opacity: 0 }, { opacity: 1, duration: 1.5 }, 1.5);
        tl.call(() => {
          audioEngine.speak("From the birth of the universe, intelligence emerges…");
        }, [], 1.5);
      }
      if (containerRef.current) {
        tl.to(containerRef.current, { opacity: 0, duration: 1.5 }, '+=6');
      }
      tl.eventCallback('onComplete', () => {
        onComplete?.();
      });

      return () => {
        cancelAnimationFrame(fallbackAnimationId);
        tl.kill();
      };
    }

    // Create particle system for Big Bang explosion
    const particleCount = 5000;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const colors_attr = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      // Start at center
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;

      // Random velocity outward
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = Math.random() * 2 + 0.5;

      velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      velocities[i * 3 + 1] = Math.cos(phi) * speed;
      velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;

      // Color gradient: white → yellow → orange → red
      const hue = Math.random() * 0.15;
      const color = new THREE.Color().setHSL(hue, 1, 0.6);
      colors_attr[i * 3] = color.r;
      colors_attr[i * 3 + 1] = color.g;
      colors_attr[i * 3 + 2] = color.b;

      sizes[i] = Math.random() * 2 + 1;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors_attr, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const particleMaterial = new THREE.PointsMaterial({
      size: 1,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // Create galaxy clusters
    const galaxies: THREE.Mesh[] = [];
    const galaxyCount = 8;

    for (let i = 0; i < galaxyCount; i++) {
      const theta = (i / galaxyCount) * Math.PI * 2;
      const radius = 100;

      const galaxyGeometry = new THREE.SphereGeometry(5, 32, 32);
      const galaxyMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(Math.random() * 0.3, 0.6, 0.5),
        emissive: new THREE.Color().setHSL(Math.random() * 0.3, 0.6, 0.4),
        emissiveIntensity: 1,
        transparent: true,
        opacity: 0.7,
      });

      const galaxy = new THREE.Mesh(galaxyGeometry, galaxyMaterial);
      galaxy.position.x = Math.cos(theta) * radius;
      galaxy.position.y = Math.sin(theta) * radius;
      galaxy.position.z = (Math.random() - 0.5) * 50;
      galaxy.userData = { basePosition: galaxy.position.clone() };

      scene.add(galaxy);
      galaxies.push(galaxy);
    }

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffa500, 2);
    pointLight.position.set(0, 0, 50);
    scene.add(pointLight);

    // Animation loop
    let animationId: number;
    let time = 0;

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      time += 0.016;

      // Expand particles
      const positionAttribute = particleGeometry.getAttribute('position') as THREE.BufferAttribute;
      const pos = positionAttribute.array as Float32Array;

      for (let i = 0; i < particleCount; i++) {
        pos[i * 3] += velocities[i * 3] * 0.5;
        pos[i * 3 + 1] += velocities[i * 3 + 1] * 0.5;
        pos[i * 3 + 2] += velocities[i * 3 + 2] * 0.5;
      }

      positionAttribute.needsUpdate = true;

      // Rotate and scale galaxies
      galaxies.forEach((galaxy, i) => {
        galaxy.rotation.x += 0.001;
        galaxy.rotation.y += 0.002;

        // Slow outward movement
        const scale = 1 + time * 0.1;
        galaxy.position.multiplyScalar(1 + 0.002);
        galaxy.scale.set(scale, scale, scale);
      });

      // Fade out particles
      if (time > 6) {
        particleMaterial.opacity = Math.max(0, 0.8 - (time - 6) * 0.2);
      }

      renderer.render(scene, camera);
    };

    animate();

    // Animation timeline
    const tl = gsap.timeline();

    // Start with silence and black screen
    if (containerRef.current) {
      tl.fromTo(
        containerRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.5 }
      );
    }

    // Audio: Silence at start
    tl.call(() => {
      audioEngine.playSilence(0.5);
    }, [], 0);

    // Audio and visual: Explosion at 0.5s
    tl.call(() => {
      audioEngine.resumeAudio(0.2);
      audioEngine.playCosmicExplosion(2);
      audioEngine.playDeepBassRumble(3);
    }, [], 0.5);

    // Explosion at 1 second
    tl.to(
      particles.scale,
      { x: 1.5, y: 1.5, z: 1.5, duration: 0.3, ease: 'power2.out' },
      0.5
    );

    // Narration appears
    if (narrationRef.current) {
      tl.fromTo(
        narrationRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 1.5 },
        1.5
      );
      tl.call(() => {
        audioEngine.speak("From the birth of the universe, intelligence emerges…");
      }, [], 1.5);
    }

    // Hold and fade out
    if (containerRef.current) {
      tl.to(containerRef.current, { opacity: 0, duration: 1.5 }, '+=6');
    }

    tl.eventCallback('onComplete', () => {
      onComplete?.();
    });

    // Handle resize
    const handleResize = () => {
      if (canvasRef.current) {
        const width = canvasRef.current.clientWidth;
        const height = canvasRef.current.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      tl.kill();
      renderer.dispose();
      // @ts-ignore
      if (renderer.forceContextLoss) {
        try {
          renderer.forceContextLoss();
        } catch (e) {
          console.warn("BigBangPrologue failed to force WebGL context loss:", e);
        }
      }
    };
  }, [onComplete]);

  return (
    <div ref={containerRef} className="absolute inset-0 bg-black overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" />

      {/* Narration */}
      <div
        ref={narrationRef}
        className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
      >
        <div className="text-center max-w-2xl px-8">
          <p
            className="text-3xl leading-relaxed"
            style={{
              fontFamily: "'Space Mono', monospace",
              color: '#00d9ff',
              textShadow: '0 0 20px rgba(0, 217, 255, 0.6)',
            }}
          >
            From the birth of the universe, intelligence emerges…
          </p>
        </div>
      </div>

      {/* Scan lines */}
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
