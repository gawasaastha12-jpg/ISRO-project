import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  wormholeVertexShader,
  wormholeFragmentShader,
  particleVertexShader,
  particleFragmentShader,
} from '@/lib/wormhole-shader';

/**
 * WormholeTransition Component
 * 
 * Manages the wormhole distortion effect during module transitions
 * Features:
 * - Radial distortion with spiral effect
 * - Chromatic aberration
 * - Particle swirl animation
 * - Smooth GSAP animation timeline
 */

interface WormholeTransitionProps {
  isActive: boolean;
  duration?: number;
  onComplete?: () => void;
}

export default function WormholeTransition({
  isActive,
  duration = 1.2,
  onComplete,
}: WormholeTransitionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<any>(null);
  const wormholePassRef = useRef<THREE.ShaderMaterial | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Initialize Three.js scene
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });

    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);

    // Create a simple quad to apply the shader to
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const quad = new THREE.Mesh(geometry, material);
    scene.add(quad);

    // Create wormhole shader material
    const wormholeShader = {
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0 },
        uCenter: { value: new THREE.Vector2(0.5, 0.5) },
      },
      vertexShader: wormholeVertexShader,
      fragmentShader: wormholeFragmentShader,
    };

    const wormholeMaterial = new THREE.ShaderMaterial(wormholeShader);
    const wormholeQuad = new THREE.Mesh(geometry, wormholeMaterial);
    scene.add(wormholeQuad);

    // Create particle system for swirl effect
    const particleCount = 500;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 2;

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2;

      velocities[i * 3] = (Math.random() - 0.5) * 2;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 2;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 2;

      sizes[i] = Math.random() * 2 + 1;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('aVelocity', new THREE.BufferAttribute(velocities, 3));
    particleGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const particleShader = {
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0 },
      },
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
    };

    const particleMaterial = new THREE.ShaderMaterial(particleShader);
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    composerRef.current = null;
    wormholePassRef.current = wormholeMaterial;
    particlesRef.current = particles;

    // Animation loop
    startTimeRef.current = Date.now();

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      const elapsed = (Date.now() - startTimeRef.current!) / 1000;
      const progress = Math.min(elapsed / duration, 1);

      // Update shader uniforms
      if (wormholeMaterial instanceof THREE.ShaderMaterial) {
        wormholeMaterial.uniforms.uTime.value = elapsed;
        wormholeMaterial.uniforms.uIntensity.value = progress;
      }

      // Update particle uniforms
      if (particles && particles.material instanceof THREE.ShaderMaterial) {
        particles.material.uniforms.uTime.value = elapsed;
        particles.material.uniforms.uIntensity.value = progress;
      }

      renderer.render(scene, camera);

      if (progress >= 1) {
        cancelAnimationFrame(animationFrameRef.current);
        onComplete?.();
      }
    };

    animate();

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      wormholeMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      renderer.dispose();
    };
  }, [isActive, duration, onComplete]);

  if (!isActive) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 pointer-events-none"
      style={{
        background: 'transparent',
      }}
    />
  );
}
