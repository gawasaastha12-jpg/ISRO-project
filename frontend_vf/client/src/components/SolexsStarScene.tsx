import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import * as THREE from 'three';

/**
 * SOLEXS Star System Scene - Flare Bursts & Orbital Timelines
 * 
 * Features:
 * - Central star with flare bursts
 * - Orbital planets with light curves
 * - Timeline visualization
 * - Particle explosions
 */

interface SolexsStarSceneProps {
  onComplete?: () => void;
}

export default function SolexsStarScene({ onComplete }: SolexsStarSceneProps) {
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
    camera.position.z = 4;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
    });
    renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    renderer.setClearColor(0x000000, 0.1);
    rendererRef.current = renderer;

    // Create central star
    const starGeometry = new THREE.SphereGeometry(0.8, 64, 64);
    const starMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffd700,
      emissiveIntensity: 1.2,
      roughness: 0.5,
    });
    const star = new THREE.Mesh(starGeometry, starMaterial);
    scene.add(star);

    // Create orbital paths
    const orbits: THREE.LineLoop[] = [];
    const orbitRadii = [1.5, 2.5, 3.5];

    orbitRadii.forEach((radius, i) => {
      const points: THREE.Vector3[] = [];
      for (let j = 0; j <= 64; j++) {
        const angle = (j / 64) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
      }

      const orbitGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const orbitMaterial = new THREE.LineBasicMaterial({
        color: new THREE.Color().setHSL(0.6 + i * 0.1, 0.7, 0.5),
        transparent: true,
        opacity: 0.3,
      });

      const orbit = new THREE.LineLoop(orbitGeometry, orbitMaterial);
      scene.add(orbit);
      orbits.push(orbit);
    });

    // Create orbiting planets
    const planets: THREE.Mesh[] = [];
    const planetSpeeds = [0.01, 0.006, 0.003];

    orbitRadii.forEach((radius, i) => {
      const planetGeometry = new THREE.SphereGeometry(0.15, 32, 32);
      const planetMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.6 + i * 0.1, 0.8, 0.6),
        emissive: new THREE.Color().setHSL(0.6 + i * 0.1, 0.8, 0.4),
        emissiveIntensity: 0.5,
      });

      const planet = new THREE.Mesh(planetGeometry, planetMaterial);
      planet.userData = { radius, speed: planetSpeeds[i], angle: Math.random() * Math.PI * 2 };

      scene.add(planet);
      planets.push(planet);
    });

    // Create flare burst particles
    const flareParticles: THREE.Points[] = [];

    const createFlare = () => {
      const particleCount = 200;
      const particleGeometry = new THREE.BufferGeometry();
      const positions = new Float32Array(particleCount * 3);
      const velocities = new Float32Array(particleCount * 3);
      const colors_attr = new Float32Array(particleCount * 3);

      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = 0;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = 0;

        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const speed = Math.random() * 0.3 + 0.1;

        velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
        velocities[i * 3 + 1] = Math.cos(phi) * speed;
        velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;

        const hue = Math.random() * 0.1 + 0.08; // Yellow to orange
        const color = new THREE.Color().setHSL(hue, 1, 0.6);
        colors_attr[i * 3] = color.r;
        colors_attr[i * 3 + 1] = color.g;
        colors_attr[i * 3 + 2] = color.b;
      }

      particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors_attr, 3));

      const particleMaterial = new THREE.PointsMaterial({
        size: 0.05,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
      });

      const particles = new THREE.Points(particleGeometry, particleMaterial);
      scene.add(particles);

      // Animate flare
      let time = 0;
      const flareAnimation = () => {
        time += 0.016;

        const positionAttribute = particleGeometry.getAttribute('position') as THREE.BufferAttribute;
        const pos = positionAttribute.array as Float32Array;

        for (let i = 0; i < particleCount; i++) {
          pos[i * 3] += velocities[i * 3];
          pos[i * 3 + 1] += velocities[i * 3 + 1];
          pos[i * 3 + 2] += velocities[i * 3 + 2];

          velocities[i * 3 + 1] -= 0.002; // Gravity
        }

        positionAttribute.needsUpdate = true;

        if (time < 3) {
          requestAnimationFrame(flareAnimation);
        } else {
          scene.remove(particles);
          particleGeometry.dispose();
          particleMaterial.dispose();
        }
      };

      flareAnimation();
    };

    // Lighting
    const light = new THREE.PointLight(0xffd700, 1.5);
    light.position.set(0, 0, 2);
    scene.add(light);

    const ambientLight = new THREE.AmbientLight(0x00d9ff, 0.3);
    scene.add(ambientLight);

    // Animation loop
    let animationId: number;
    let flareTimer = 0;

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      // Rotate star
      star.rotation.y += 0.005;

      // Animate planets
      planets.forEach((planet) => {
        planet.userData.angle += planet.userData.speed;
        planet.position.x = Math.cos(planet.userData.angle) * planet.userData.radius;
        planet.position.z = Math.sin(planet.userData.angle) * planet.userData.radius;
        planet.rotation.y += 0.01;
      });

      // Trigger flares
      flareTimer += 0.016;
      if (flareTimer > 2) {
        createFlare();
        flareTimer = 0;
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

    // Zoom in
    tl.to(camera.position, { z: 3, duration: 2 }, 0.5);

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
      starGeometry.dispose();
      starMaterial.dispose();
    };
  }, [onComplete]);

  return (
    <div ref={containerRef} className="absolute inset-0 bg-black overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />

      {/* Timeline visualization */}
      <div className="absolute bottom-8 left-8 right-8 z-10">
        <div className="text-xs font-mono text-muted-foreground mb-2">
          <span className="text-electric-blue">SOLEXS TIMELINE</span>
        </div>
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex-1 h-1 bg-gradient-to-r from-transparent via-supernova-gold to-transparent rounded"
              style={{
                opacity: 0.5 + Math.random() * 0.5,
              }}
            />
          ))}
        </div>
      </div>

      {/* Info overlay */}
      <div className="absolute top-8 left-8 text-xs font-mono text-muted-foreground space-y-2 z-10">
        <div className="text-deep-purple">SOLEXS STAR SYSTEM</div>
        <div>FLARE EVENTS: 12</div>
        <div>ORBITAL BODIES: 3</div>
        <div>SPECTRAL CLASS: G2V</div>
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
