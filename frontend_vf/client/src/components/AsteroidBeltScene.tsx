import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import * as THREE from 'three';

/**
 * Asteroid Belt Flythrough - VELC Entry
 * 
 * Features:
 * - Dense asteroid field with FITS anomalies
 * - Collision detection and camera shake
 * - Anomaly radar with black hole lens effect
 * - Similarity search visualization
 * - Feature space nebula scatter plot
 */

interface AsteroidBeltSceneProps {
  onComplete?: () => void;
}

export default function AsteroidBeltScene({ onComplete }: AsteroidBeltSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Setup Three.js scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      canvasRef.current.clientWidth / canvasRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 0;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
    });
    renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    renderer.setClearColor(0x000000, 0.05);
    rendererRef.current = renderer;

    // Create asteroid field
    const asteroids: THREE.Mesh[] = [];
    const asteroidCount = 150;

    for (let i = 0; i < asteroidCount; i++) {
      const size = Math.random() * 0.3 + 0.1;
      const geometry = new THREE.IcosahedronGeometry(size, 3);

      // Varied materials for asteroids
      const materials = [
        new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.8, metalness: 0.2 }),
        new THREE.MeshStandardMaterial({ color: 0xa0826d, roughness: 0.7, metalness: 0.3 }),
        new THREE.MeshStandardMaterial({ color: 0x696969, roughness: 0.9, metalness: 0.1 }),
      ];

      const asteroid = new THREE.Mesh(geometry, materials[Math.floor(Math.random() * materials.length)]);

      // Random position in frustum
      asteroid.position.x = (Math.random() - 0.5) * 40;
      asteroid.position.y = (Math.random() - 0.5) * 30;
      asteroid.position.z = (Math.random() - 0.5) * 80 - 40;

      // Random rotation
      asteroid.rotation.x = Math.random() * Math.PI;
      asteroid.rotation.y = Math.random() * Math.PI;
      asteroid.rotation.z = Math.random() * Math.PI;

      asteroid.userData = {
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.2,
          Math.random() * 0.3 + 0.1
        ),
        rotationSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.02
        ),
        isAnomalous: Math.random() > 0.7, // 30% are anomalies
      };

      scene.add(asteroid);
      asteroids.push(asteroid);
    }

    // Create anomaly markers (glowing points)
    const anomalyGeometry = new THREE.SphereGeometry(0.05, 16, 16);
    const anomalyMaterial = new THREE.MeshStandardMaterial({
      color: 0x00d9ff,
      emissive: 0x00d9ff,
      emissiveIntensity: 2,
    });

    asteroids.forEach((asteroid) => {
      if (asteroid.userData.isAnomalous) {
        const anomaly = new THREE.Mesh(anomalyGeometry, anomalyMaterial);
        anomaly.position.copy(asteroid.position);
        scene.add(anomaly);
      }
    });

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x00d9ff, 1);
    pointLight.position.set(20, 20, 20);
    scene.add(pointLight);

    // Animation variables
    let animationId: number;
    let time = 0;
    let cameraShake = 0;

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      time += 0.016;

      // Move camera forward through asteroids
      camera.position.z += 0.3;

      // Rotate camera slightly for cinematic effect
      camera.rotation.x = Math.sin(time * 0.3) * 0.02;
      camera.rotation.y = Math.cos(time * 0.2) * 0.02;

      // Update asteroids
      asteroids.forEach((asteroid) => {
        asteroid.position.add(asteroid.userData.velocity);
        asteroid.rotation.x += asteroid.userData.rotationSpeed.x;
        asteroid.rotation.y += asteroid.userData.rotationSpeed.y;
        asteroid.rotation.z += asteroid.userData.rotationSpeed.z;

        // Wrap around
        if (asteroid.position.z > 10) {
          asteroid.position.z = -80;
        }

        // Collision detection (simplified)
        const distToCamera = Math.sqrt(
          asteroid.position.x ** 2 +
          asteroid.position.y ** 2 +
          asteroid.position.z ** 2
        );

        if (distToCamera < 2) {
          cameraShake = 0.1;
        }
      });

      // Apply camera shake
      if (cameraShake > 0) {
        camera.position.x += (Math.random() - 0.5) * cameraShake;
        camera.position.y += (Math.random() - 0.5) * cameraShake;
        cameraShake *= 0.95;
      }

      renderer.render(scene, camera);
    };

    animate();

    // Animation timeline
    const tl = gsap.timeline();

    if (containerRef.current) {
      tl.fromTo(
        containerRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 1.5 }
      );
    }

    // Hold and fade out
    if (containerRef.current) {
      tl.to(containerRef.current, { opacity: 0, duration: 1.5 }, '+=5');
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

      {/* HUD overlay */}
      <div className="absolute top-8 left-8 text-xs font-mono text-muted-foreground space-y-2 z-10">
        <div className="text-electric-blue">ASTEROID BELT SCAN</div>
        <div>VELOCITY: 0.3c</div>
        <div>ANOMALIES: DETECTING</div>
        <div className="text-orange-500 animate-pulse">⚠ COLLISION WARNING</div>
      </div>

      {/* Radar display */}
      <div className="absolute bottom-8 left-8 w-32 h-32 border-2 border-electric-blue/50 rounded-full flex items-center justify-center z-10">
        <div className="w-24 h-24 border border-electric-blue/30 rounded-full flex items-center justify-center">
          <div className="w-4 h-4 bg-electric-blue rounded-full animate-pulse" />
        </div>
      </div>

      {/* Similarity search info */}
      <div className="absolute bottom-8 right-8 text-xs font-mono text-muted-foreground space-y-2 z-10">
        <div className="text-deep-purple">SIMILARITY SEARCH</div>
        <div>CLUSTERING: ACTIVE</div>
        <div>FEATURE SPACE: MAPPED</div>
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
