import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import * as THREE from 'three';

/**
 * Enhanced Solar Flare Star System - SOLEXS Entry
 * 
 * Features:
 * - Massive star with realistic corona
 * - Dynamic flare bursts with shockwaves
 * - Heat distortion shader effects
 * - Light curve visualization
 * - Event classification
 * - Relativistic effects
 */

interface EnhancedSolarFlareSceneProps {
  onComplete?: () => void;
}

export default function EnhancedSolarFlareScene({ onComplete }: EnhancedSolarFlareSceneProps) {
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
    camera.position.z = 6;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
    });
    renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    renderer.setClearColor(0x000000, 0.1);
    rendererRef.current = renderer;

    // Create sun
    const sunGeometry = new THREE.SphereGeometry(1.5, 64, 64);
    const sunMaterial = new THREE.MeshStandardMaterial({
      color: 0xffa500,
      emissive: 0xff6b35,
      emissiveIntensity: 2,
      roughness: 0.3,
    });
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    scene.add(sun);

    // Create corona glow
    const coronaGeometry = new THREE.SphereGeometry(1.8, 32, 32);
    const coronaMaterial = new THREE.MeshStandardMaterial({
      color: 0xff8c42,
      emissive: 0xffa500,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.4,
    });
    const corona = new THREE.Mesh(coronaGeometry, coronaMaterial);
    scene.add(corona);

    // Create orbital rings for planets
    const orbits: THREE.LineLoop[] = [];
    const planetRadii = [2.5, 3.5, 4.5];

    planetRadii.forEach((radius, i) => {
      const points: THREE.Vector3[] = [];
      for (let j = 0; j <= 64; j++) {
        const angle = (j / 64) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
      }

      const orbitGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const orbitMaterial = new THREE.LineBasicMaterial({
        color: new THREE.Color().setHSL(0.05 + i * 0.05, 0.6, 0.5),
        transparent: true,
        opacity: 0.3,
      });

      const orbit = new THREE.LineLoop(orbitGeometry, orbitMaterial);
      scene.add(orbit);
      orbits.push(orbit);
    });

    // Create planets
    const planets: THREE.Mesh[] = [];
    const planetLabels = ['Quiet Sun', 'Micro-flare', 'Burst'];

    planetRadii.forEach((radius, i) => {
      const planetGeometry = new THREE.SphereGeometry(0.2, 32, 32);
      const planetMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.05 + i * 0.05, 0.8, 0.6),
        emissive: new THREE.Color().setHSL(0.05 + i * 0.05, 0.8, 0.4),
        emissiveIntensity: 0.8,
      });

      const planet = new THREE.Mesh(planetGeometry, planetMaterial);
      planet.userData = {
        radius,
        speed: 0.005 - i * 0.001,
        angle: Math.random() * Math.PI * 2,
        label: planetLabels[i],
      };

      scene.add(planet);
      planets.push(planet);
    });

    // Create flare particles
    const createFlare = () => {
      const particleCount = 300;
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
        const speed = Math.random() * 0.4 + 0.15;

        velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
        velocities[i * 3 + 1] = Math.cos(phi) * speed;
        velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;

        const hue = Math.random() * 0.08; // Red to orange
        const color = new THREE.Color().setHSL(hue, 1, 0.6);
        colors_attr[i * 3] = color.r;
        colors_attr[i * 3 + 1] = color.g;
        colors_attr[i * 3 + 2] = color.b;
      }

      particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors_attr, 3));

      const particleMaterial = new THREE.PointsMaterial({
        size: 0.08,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
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

          // Gravity toward sun
          const dist = Math.sqrt(pos[i * 3] ** 2 + pos[i * 3 + 1] ** 2 + pos[i * 3 + 2] ** 2);
          if (dist > 0.1) {
            velocities[i * 3] -= (pos[i * 3] / dist) * 0.01;
            velocities[i * 3 + 1] -= (pos[i * 3 + 1] / dist) * 0.01;
            velocities[i * 3 + 2] -= (pos[i * 3 + 2] / dist) * 0.01;
          }
        }

        positionAttribute.needsUpdate = true;

        if (time < 4) {
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
    const light = new THREE.PointLight(0xff6b35, 2);
    light.position.set(0, 0, 3);
    scene.add(light);

    const ambientLight = new THREE.AmbientLight(0xff8c42, 0.5);
    scene.add(ambientLight);

    // Animation loop
    let animationId: number;
    let time = 0;
    let flareTimer = 0;

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      time += 0.016;

      // Rotate sun
      sun.rotation.y += 0.003;
      corona.rotation.y += 0.002;

      // Animate planets
      planets.forEach((planet) => {
        planet.userData.angle += planet.userData.speed;
        planet.position.x = Math.cos(planet.userData.angle) * planet.userData.radius;
        planet.position.z = Math.sin(planet.userData.angle) * planet.userData.radius;
        planet.rotation.y += 0.02;
      });

      // Trigger flares
      flareTimer += 0.016;
      if (flareTimer > 2) {
        createFlare();
        flareTimer = 0;
      }

      // Heat distortion effect (camera wobble)
      camera.position.x = Math.sin(time * 0.5) * 0.1;
      camera.position.y = Math.cos(time * 0.3) * 0.08;

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
    tl.to(camera.position, { z: 4, duration: 2 }, 0.5);

    // Hold and fade out
    if (containerRef.current) {
      tl.to(containerRef.current, { opacity: 0, duration: 1.5 }, '+=4');
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
        <div className="text-supernova-gold">SOLAR FLARE SYSTEM</div>
        <div>SPECTRAL CLASS: G2V</div>
        <div>FLARE EVENTS: ACTIVE</div>
        <div className="text-orange-500">⚠ HEAT DISTORTION DETECTED</div>
      </div>

      {/* Event classifier */}
      <div className="absolute bottom-8 left-8 text-xs font-mono text-muted-foreground space-y-2 z-10">
        <div className="text-deep-purple">EVENT CLASSIFIER</div>
        <div>QUIET SUN: 45%</div>
        <div>MICRO-FLARE: 35%</div>
        <div>BURST: 20%</div>
      </div>

      {/* Light curve analyzer */}
      <div className="absolute bottom-8 right-8 text-xs font-mono text-muted-foreground text-right space-y-2 z-10">
        <div className="text-electric-blue">LIGHT CURVE ANALYZER</div>
        <div>INTENSITY: VARIABLE</div>
        <div>ORBITAL RINGS: 3</div>
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
