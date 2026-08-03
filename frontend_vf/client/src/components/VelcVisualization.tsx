import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { CosmicScene } from '@/lib/three-scene';
import * as THREE from 'three';

/**
 * VELC Visualization Component
 * 
 * Renders Three.js scene with:
 * - Anomaly spheres (black holes, coronal storms, magnetic loops)
 * - Similarity search galaxy clusters
 * - Interactive hover effects with GSAP animations
 */

interface Anomaly {
  id: string;
  name: string;
  position: [number, number, number];
  type: 'black-hole' | 'coronal-storm' | 'magnetic-loop';
  intensity: number;
}

const ANOMALIES: Anomaly[] = [
  {
    id: 'anom-001',
    name: 'Coronal Black Hole',
    position: [-3, 2, -5],
    type: 'black-hole',
    intensity: 0.95,
  },
  {
    id: 'anom-002',
    name: 'Magnetic Storm',
    position: [3, -1, -4],
    type: 'coronal-storm',
    intensity: 0.87,
  },
  {
    id: 'anom-003',
    name: 'Loop Distortion',
    position: [0, -3, -6],
    type: 'magnetic-loop',
    intensity: 0.72,
  },
];

interface VelcVisualizationProps {
  container: HTMLElement;
  onAnomalyHover?: (anomalyId: string | null) => void;
}

export class VelcVisualization {
  scene: CosmicScene;
  anomalySpheres: Map<string, THREE.Mesh> = new Map();
  container: HTMLElement;
  onAnomalyHover?: (anomalyId: string | null) => void;
  raycaster: THREE.Raycaster;
  mouse: THREE.Vector2;

  constructor(props: VelcVisualizationProps) {
    this.container = props.container;
    this.onAnomalyHover = props.onAnomalyHover;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Initialize cosmic scene
    this.scene = new CosmicScene({
      container: this.container,
      width: this.container.clientWidth,
      height: this.container.clientHeight,
      backgroundColor: 0x0a0e27,
    });

    // Create anomalies
    this.createAnomalies();

    // Setup interaction
    this.setupInteraction();

    // Start render loop
    this.scene.startRenderLoop();
  }

  private createAnomalies() {
    ANOMALIES.forEach((anomaly) => {
      const color = this.getAnomalyColor(anomaly.type);
      const sphere = this.scene.createGlowingSphere(
        {
          x: anomaly.position[0],
          y: anomaly.position[1],
          z: anomaly.position[2],
        } as any,
        1 + anomaly.intensity * 0.5,
        color,
        anomaly.intensity
      );

      // Store reference for interaction
      this.anomalySpheres.set(anomaly.id, sphere);

      // Add orbit animation
      this.animateOrbit(sphere, anomaly.intensity);
    });
  }

  private getAnomalyColor(type: string): number {
    switch (type) {
      case 'black-hole':
        return 0x00d9ff; // electric blue
      case 'coronal-storm':
        return 0xfbbf24; // supernova gold
      case 'magnetic-loop':
        return 0xa78bfa; // nebula violet
      default:
        return 0x00d9ff;
    }
  }

  private animateOrbit(sphere: THREE.Mesh, speed: number) {
    const startPos = sphere.position.clone();
    const timeline = gsap.timeline({ repeat: -1 });

    timeline.to(sphere.position, {
      x: startPos.x + Math.sin(Date.now() * 0.001) * 2,
      y: startPos.y + Math.cos(Date.now() * 0.0005) * 1,
      duration: 4 / speed,
      ease: 'sine.inOut',
    });

    // Rotation animation
    timeline.to(
      sphere.rotation,
      {
        x: Math.PI * 2,
        y: Math.PI * 2,
        duration: 6 / speed,
        ease: 'none',
      },
      0
    );
  }

  private setupInteraction() {
    const canvas = this.scene.renderer.domElement;

    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      // Raycasting for hover detection
      this.raycaster.setFromCamera(this.mouse, this.scene.camera);

      const spheres = Array.from(this.anomalySpheres.values());
      const intersects = this.raycaster.intersectObjects(spheres);

      if (intersects.length > 0) {
        const hoveredSphere = intersects[0].object;
        const anomalyId = Array.from(this.anomalySpheres.entries()).find(
          ([_, sphere]) => sphere === hoveredSphere
        )?.[0];

        if (anomalyId) {
          this.onAnomalyHover?.(anomalyId);

          // Animate hover effect
          gsap.to(hoveredSphere, {
            scale: 1.3,
            duration: 0.3,
            overwrite: 'auto',
          });

          // Increase glow
          if (hoveredSphere instanceof THREE.Mesh) {
            const material = hoveredSphere.material as THREE.MeshStandardMaterial;
            gsap.to(material, {
              emissiveIntensity: 1.5,
              duration: 0.3,
            });
          }
        }
      } else {
        this.onAnomalyHover?.(null);

        // Reset all spheres
        this.anomalySpheres.forEach((sphere) => {
          gsap.to(sphere, {
            scale: 1,
            duration: 0.3,
            overwrite: 'auto',
          });

          if (sphere instanceof THREE.Mesh) {
            const material = sphere.material as THREE.MeshStandardMaterial;
            const anomaly = ANOMALIES.find(
              (a) =>
                this.anomalySpheres.get(a.id) === sphere
            );
            gsap.to(material, {
              emissiveIntensity: anomaly?.intensity || 0.8,
              duration: 0.3,
            });
          }
        });
      }
    });

    canvas.addEventListener('click', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.scene.camera);
      const spheres = Array.from(this.anomalySpheres.values());
      const intersects = this.raycaster.intersectObjects(spheres);

      if (intersects.length > 0) {
        const clickedSphere = intersects[0].object;
        const anomalyId = Array.from(this.anomalySpheres.entries()).find(
          ([_, sphere]) => sphere === clickedSphere
        )?.[0];

        if (anomalyId) {
          // Trigger zoom animation
          const anomaly = ANOMALIES.find((a) => a.id === anomalyId);
          if (anomaly) {
            this.scene.cameraTransition(
              {
                x: anomaly.position[0],
                y: anomaly.position[1],
                z: anomaly.position[2] + 3,
              } as any,
              {
                x: anomaly.position[0],
                y: anomaly.position[1],
                z: anomaly.position[2],
              } as any,
              800
            );
          }
        }
      }
    });
  }

  dispose() {
    this.scene.dispose();
  }
}

interface VelcVisualizationComponentProps {
  onAnomalyHover?: (anomalyId: string | null) => void;
}

export default function VelcVisualizationComponent({
  onAnomalyHover,
}: VelcVisualizationComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const vizRef = useRef<VelcVisualization | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    try {
      vizRef.current = new VelcVisualization({
        container: containerRef.current,
        onAnomalyHover,
      });
    } catch (error) {
      console.error('Failed to initialize VELC visualization:', error);
    }

    return () => {
      vizRef.current?.dispose();
    };
  }, [onAnomalyHover]);

  return <div ref={containerRef} className="w-full h-full" />;
}
