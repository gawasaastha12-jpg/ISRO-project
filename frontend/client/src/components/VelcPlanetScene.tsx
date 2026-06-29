import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import * as THREE from 'three';

/**
 * VELC Planet Scene - Coronal Storm Visualization
 * 
 * Features:
 * - Rotating planet with coronal activity
 * - Black hole anomalies as interactive points
 * - Storm visualization with particle effects
 * - Cinematic camera movements
 */

interface VelcPlanetSceneProps {
  onComplete?: () => void;
}

export default function VelcPlanetScene({ onComplete }: VelcPlanetSceneProps) {
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
      1000
    );
    camera.position.z = 3;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
    });
    renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    renderer.setClearColor(0x000000, 0.1);
    rendererRef.current = renderer;

    // Create planet (sun-like)
    const planetGeometry = new THREE.SphereGeometry(1, 64, 64);
    const planetMaterial = new THREE.MeshStandardMaterial({
      color: 0xff6b35,
      emissive: 0xff6b35,
      emissiveIntensity: 0.5,
      roughness: 0.7,
      metalness: 0.3,
    });
    const planet = new THREE.Mesh(planetGeometry, planetMaterial);
    scene.add(planet);

    // Create coronal atmosphere
    const coronaGeometry = new THREE.SphereGeometry(1.15, 64, 64);
    const coronaMaterial = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.3,
      wireframe: false,
    });
    const corona = new THREE.Mesh(coronaGeometry, coronaMaterial);
    scene.add(corona);

    // Create anomaly points (black holes)
    const anomalies: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const radius = 1.3;

      const anomalyGeometry = new THREE.SphereGeometry(0.08, 32, 32);
      const anomalyMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a2e,
        emissive: 0x00d9ff,
        emissiveIntensity: 1.5,
        metalness: 1,
        roughness: 0,
      });
      const anomaly = new THREE.Mesh(anomalyGeometry, anomalyMaterial);

      anomaly.position.x = Math.sin(phi) * Math.cos(theta) * radius;
      anomaly.position.y = Math.cos(phi) * radius;
      anomaly.position.z = Math.sin(phi) * Math.sin(theta) * radius;

      scene.add(anomaly);
      anomalies.push(anomaly);
    }

    // Create particle system for storm
    const particleCount = 1000;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const r = 1.2 + Math.random() * 0.5;

      positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      positions[i * 3 + 1] = Math.cos(phi) * r;
      positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;

      velocities[i * 3] = (Math.random() - 0.5) * 0.02;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const particleMaterial = new THREE.PointsMaterial({
      color: 0xfbbf24,
      size: 0.02,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.6,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // Lighting
    const light = new THREE.PointLight(0xfbbf24, 1.5);
    light.position.set(5, 5, 5);
    scene.add(light);

    const ambientLight = new THREE.AmbientLight(0x00d9ff, 0.3);
    scene.add(ambientLight);

    // Animation loop
    let animationId: number;
    let time = 0;

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      time += 0.01;

      // Rotate planet
      planet.rotation.y += 0.001;
      corona.rotation.y -= 0.0005;

      // Animate anomalies
      anomalies.forEach((anomaly, i) => {
        anomaly.scale.x = 1 + Math.sin(time * 2 + i) * 0.3;
        anomaly.scale.y = 1 + Math.sin(time * 2 + i) * 0.3;
        anomaly.scale.z = 1 + Math.sin(time * 2 + i) * 0.3;
      });

      // Update particles
      const positionAttribute = particleGeometry.getAttribute('position') as THREE.BufferAttribute;
      const pos = positionAttribute.array as Float32Array;

      for (let i = 0; i < particleCount; i++) {
        pos[i * 3] += velocities[i * 3];
        pos[i * 3 + 1] += velocities[i * 3 + 1];
        pos[i * 3 + 2] += velocities[i * 3 + 2];

        // Wrap around
        const dist = Math.sqrt(pos[i * 3] ** 2 + pos[i * 3 + 1] ** 2 + pos[i * 3 + 2] ** 2);
        if (dist > 2) {
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.random() * Math.PI;
          const r = 1.2;

          pos[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
          pos[i * 3 + 1] = Math.cos(phi) * r;
          pos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
        }
      }

      positionAttribute.needsUpdate = true;

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

    // Zoom in on planet
    tl.to(camera.position, { z: 2.5, duration: 2 }, 0.5);

    // Hold and fade out
    tl.to(containerRef.current, { opacity: 0, duration: 1.5 }, '+=3');

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
      planetGeometry.dispose();
      planetMaterial.dispose();
      coronaGeometry.dispose();
      coronaMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
    };
  }, [onComplete]);

  return (
    <div ref={containerRef} className="absolute inset-0 bg-black overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />

      {/* Info overlay */}
      <div className="absolute bottom-8 left-8 text-xs font-mono text-muted-foreground space-y-2 z-10">
        <div className="text-electric-blue">VELC PLANET SCAN</div>
        <div>CORONAL ACTIVITY: HIGH</div>
        <div>ANOMALIES DETECTED: 5</div>
        <div>STORM INTENSITY: 87%</div>
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
