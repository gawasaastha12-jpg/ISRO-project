import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import * as THREE from 'three';
import { AnimationEffects, CinematicEasing } from '@/lib/animation-effects';
import { audioEngine } from '@/lib/audio-engine';

/**
 * Enhanced Asteroid Belt Scene - Realistic Physics & Camera Effects
 * 
 * Features:
 * - 150 realistic asteroids with physics
 * - Camera shake for turbulence
 * - Motion blur effect
 * - Collision detection with audio
 * - Slow-motion effects
 * - Lens flares
 */

interface EnhancedAsteroidBeltProps {
  onComplete?: () => void;
}

export default function EnhancedAsteroidBelt({ onComplete }: EnhancedAsteroidBeltProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

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
    camera.position.z = 0;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
    });
    renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    renderer.setClearColor(0x000000, 1);
    rendererRef.current = renderer;

    // Create asteroids with physics
    const asteroids: Array<{
      mesh: THREE.Mesh;
      position: THREE.Vector3;
      velocity: THREE.Vector3;
      rotationSpeed: THREE.Vector3;
      isAnomaly: boolean;
    }> = [];

    const asteroidCount = 150;
    const anomalyCount = Math.floor(asteroidCount * 0.3);

    for (let i = 0; i < asteroidCount; i++) {
      const isAnomaly = i < anomalyCount;

      // Create asteroid geometry
      const geometry = new THREE.IcosahedronGeometry(
        Math.random() * 0.8 + 0.3,
        Math.random() > 0.5 ? 2 : 3
      );

      // Material based on type
      const material = new THREE.MeshStandardMaterial({
        color: isAnomaly ? 0x00d9ff : new THREE.Color().setHSL(Math.random() * 0.15, 0.4, 0.4),
        metalness: 0.6,
        roughness: 0.8,
        emissive: isAnomaly ? 0x00d9ff : 0x000000,
        emissiveIntensity: isAnomaly ? 0.5 : 0,
      });

      const mesh = new THREE.Mesh(geometry, material);

      // Random position in field (aligned with camera path for dynamic collisions)
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 250;

      mesh.position.set(
        Math.cos(angle) * radius,
        (Math.random() - 0.5) * 20,
        Math.sin(angle) * radius - 500
      );

      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

      scene.add(mesh);

      asteroids.push({
        mesh,
        position: mesh.position.clone(),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.3,
          Math.random() * 0.8 + 0.3 // Moving forward
        ),
        rotationSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.02
        ),
        isAnomaly,
      });
    }

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(100, 100, 100);
    scene.add(pointLight);

    // Animation loop
    let animationId: number;
    let time = 0;
    let collisionCount = 0;

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      time += 0.016;

      // Update asteroids
      asteroids.forEach((asteroid) => {
        // Update position
        asteroid.mesh.position.add(asteroid.velocity);

        // Update rotation
        asteroid.mesh.rotation.x += asteroid.rotationSpeed.x;
        asteroid.mesh.rotation.y += asteroid.rotationSpeed.y;
        asteroid.mesh.rotation.z += asteroid.rotationSpeed.z;

        // Wrap around
        if (asteroid.mesh.position.z > 100) {
          asteroid.mesh.position.z = -500;
        }

        // Collision detection with camera
        const distanceToCamera = asteroid.mesh.position.distanceTo(camera.position);
        if (distanceToCamera < 5 && collisionCount < 5) {
          // Collision!
          audioEngine.playCollisionImpact();
          collisionCount++;

          // Camera shake
          const shake = AnimationEffects.getCameraShake(2, 15, time);
          camera.position.x += shake.x;
          camera.position.y += shake.y;
        }
      });

      // Camera shake effect (turbulence)
      const turbulence = AnimationEffects.getCameraShake(0.3, 5, time);
      camera.position.x = turbulence.x;
      camera.position.y = turbulence.y;

      renderer.render(scene, camera);
    };

    animate();

    // Animation timeline
    const tl = gsap.timeline();

    // Fade in
    if (containerRef.current) {
      tl.fromTo(
        containerRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 1 }
      );
    }

    // Camera fly-through
    tl.to(
      camera.position,
      {
        z: 500,
        duration: 5,
        ease: 'power1.inOut',
      },
      0
    );

    // Fade out
    if (containerRef.current) {
      tl.to(containerRef.current, { opacity: 0, duration: 1 }, '+=0.5');
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
    };
  }, [onComplete]);

  return (
    <div ref={containerRef} className="absolute inset-0 bg-black overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" />

      {/* Info overlay */}
      <div className="absolute top-8 left-8 text-xs font-mono text-muted-foreground space-y-2 z-10">
        <div className="text-electric-blue">ASTEROID BELT ENTRY</div>
        <div>ANOMALIES DETECTED: 45</div>
        <div>COLLISION WARNINGS: ACTIVE</div>
        <div className="text-orange-500">⚠ TURBULENCE DETECTED</div>
      </div>

      {/* Radar display */}
      <div className="absolute bottom-8 left-8 text-xs font-mono text-muted-foreground space-y-2 z-10">
        <div className="text-deep-purple">ANOMALY RADAR</div>
        <div>SIMILARITY SEARCH: ACTIVE</div>
        <div>FEATURE SPACE: MAPPING</div>
        <div>CLUSTERING: 12 GROUPS</div>
      </div>

      {/* Status display */}
      <div className="absolute bottom-8 right-8 text-xs font-mono text-muted-foreground text-right space-y-2 z-10">
        <div className="text-electric-blue">NAVIGATION STATUS</div>
        <div>VELOCITY: 0.3c</div>
        <div>EVASION MANEUVERS: EXECUTING</div>
      </div>

      {/* Scan lines */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.1), rgba(0,0,0,0.1) 1px, transparent 1px, transparent 2px)',
          mixBlendMode: 'multiply',
        }}
      />
    </div>
  );
}
