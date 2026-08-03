import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import * as THREE from 'three';

/**
 * Black Hole Accretion Disk Scene
 * 
 * Features:
 * - Rotating accretion disk (like Gargantua)
 * - Gravitational lensing effects
 * - Time dilation visualization
 * - FITS frame bending
 * - Extreme gravity simulation
 */

interface BlackHoleSceneProps {
  onComplete?: () => void;
}

export default function BlackHoleScene({ onComplete }: BlackHoleSceneProps) {
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
    camera.position.z = 5;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvasRef.current,
        antialias: true,
        alpha: true,
      });
      renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
      renderer.setClearColor(0x000000, 0.1);
      rendererRef.current = renderer;
    } catch (e) {
      console.warn("BlackHoleScene WebGL failed, falling back to 2D Canvas:", e);
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        const w = canvasRef.current.width = canvasRef.current.clientWidth;
        const h = canvasRef.current.height = canvasRef.current.clientHeight;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);
        
        ctx.strokeStyle = '#ff6b35';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.ellipse(w/2, h/2, 80, 25, Math.PI / 10, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(w/2, h/2, 30, 0, Math.PI * 2);
        ctx.fill();
      }
      const timer = setTimeout(() => {
        onComplete?.();
      }, 5000);
      return () => clearTimeout(timer);
    }

    // Create black hole (event horizon)
    const bhGeometry = new THREE.SphereGeometry(1, 64, 64);
    const bhMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: 0x1a1a2e,
      emissiveIntensity: 0.3,
      metalness: 1,
      roughness: 0,
    });
    const blackHole = new THREE.Mesh(bhGeometry, bhMaterial);
    scene.add(blackHole);

    // Create accretion disk (multiple rings)
    const diskRings: THREE.Mesh[] = [];
    const diskRadii = [1.5, 2, 2.5, 3, 3.5];
    const diskColors = [0xff6b35, 0xff8c42, 0xffa500, 0xffc857, 0xffff00];

    diskRadii.forEach((radius, i) => {
      const ringGeometry = new THREE.TorusGeometry(radius, 0.3, 32, 200);
      const ringMaterial = new THREE.MeshStandardMaterial({
        color: diskColors[i],
        emissive: diskColors[i],
        emissiveIntensity: 1.5 - i * 0.2,
        transparent: true,
        opacity: 0.8 - i * 0.1,
      });

      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = Math.PI * 0.3 + Math.random() * 0.1;
      ring.userData = { rotationSpeed: 0.005 - i * 0.0005 };

      scene.add(ring);
      diskRings.push(ring);
    });

    // Create radiation jets
    const jetGeometry = new THREE.ConeGeometry(0.5, 4, 32);
    const jetMaterial = new THREE.MeshStandardMaterial({
      color: 0x00d9ff,
      emissive: 0x00d9ff,
      emissiveIntensity: 2,
      transparent: true,
      opacity: 0.7,
    });

    const jetTop = new THREE.Mesh(jetGeometry, jetMaterial);
    jetTop.position.z = 3;
    scene.add(jetTop);

    const jetBottom = new THREE.Mesh(jetGeometry, jetMaterial);
    jetBottom.position.z = -3;
    jetBottom.rotation.z = Math.PI;
    scene.add(jetBottom);

    // Create particle halo around black hole
    const haloGeometry = new THREE.BufferGeometry();
    const particleCount = 2000;
    const positions = new Float32Array(particleCount * 3);
    const colors_attr = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const r = 1.2 + Math.random() * 2;

      positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      positions[i * 3 + 1] = Math.cos(phi) * r;
      positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;

      const hue = 0.05 + Math.random() * 0.15; // Red to yellow
      const color = new THREE.Color().setHSL(hue, 1, 0.5);
      colors_attr[i * 3] = color.r;
      colors_attr[i * 3 + 1] = color.g;
      colors_attr[i * 3 + 2] = color.b;
    }

    haloGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    haloGeometry.setAttribute('color', new THREE.BufferAttribute(colors_attr, 3));

    const haloMaterial = new THREE.PointsMaterial({
      size: 0.05,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
    });

    const halo = new THREE.Points(haloGeometry, haloMaterial);
    scene.add(halo);

    // Lighting
    const light = new THREE.PointLight(0xff6b35, 2);
    light.position.set(5, 5, 5);
    scene.add(light);

    const ambientLight = new THREE.AmbientLight(0x00d9ff, 0.3);
    scene.add(ambientLight);

    // Animation loop
    let animationId: number;
    let time = 0;

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      time += 0.016;

      // Rotate accretion disk
      diskRings.forEach((ring) => {
        ring.rotation.z += ring.userData.rotationSpeed;
      });

      // Rotate black hole
      blackHole.rotation.z += 0.001;

      // Pulsing jets
      jetTop.scale.z = 1 + Math.sin(time * 3) * 0.2;
      jetBottom.scale.z = 1 + Math.sin(time * 3) * 0.2;

      // Animate halo particles
      const positionAttribute = haloGeometry.getAttribute('position') as THREE.BufferAttribute;
      const pos = positionAttribute.array as Float32Array;

      for (let i = 0; i < particleCount; i++) {
        const angle = Math.atan2(pos[i * 3 + 1], pos[i * 3]);
        const dist = Math.sqrt(pos[i * 3] ** 2 + pos[i * 3 + 1] ** 2);

        pos[i * 3] = Math.cos(angle + time * 0.02) * dist;
        pos[i * 3 + 1] = Math.sin(angle + time * 0.02) * dist;
      }

      positionAttribute.needsUpdate = true;

      // Camera orbit
      camera.position.x = Math.sin(time * 0.2) * 6;
      camera.position.y = Math.cos(time * 0.15) * 4;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    animate();

    // Animation timeline
    const tl = gsap.timeline();

    if (containerRef.current) {
      tl.fromTo(
        containerRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 2 }
      );
    }

    // Zoom in effect
    tl.to(camera.position, { z: 3, duration: 2 }, 0.5);

    // Hold and fade out
    if (containerRef.current) {
      tl.to(containerRef.current, { opacity: 0, duration: 2 }, '+=4');
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
        <div className="text-electric-blue">BLACK HOLE ENCOUNTER</div>
        <div>MASS: 6.5 BILLION SOLAR</div>
        <div>SPIN: 0.998c</div>
        <div className="text-orange-500">⚠ EXTREME GRAVITY</div>
      </div>

      {/* Time dilation display */}
      <div className="absolute bottom-8 left-8 text-xs font-mono text-muted-foreground space-y-2 z-10">
        <div className="text-deep-purple">TIME DILATION</div>
        <div>EVENT HORIZON: 1.0x</div>
        <div>CURRENT POSITION: 0.2x</div>
      </div>

      {/* Gravitational lensing info */}
      <div className="absolute bottom-8 right-8 text-xs font-mono text-muted-foreground text-right space-y-2 z-10">
        <div className="text-supernova-gold">GRAVITATIONAL LENSING</div>
        <div>LIGHT BENDING: 90°</div>
        <div>PHOTON SPHERE: ACTIVE</div>
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
