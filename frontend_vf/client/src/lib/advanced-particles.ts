import * as THREE from 'three';
import gsap from 'gsap';

/**
 * Advanced Particle System Manager
 * 
 * Creates sophisticated particle effects:
 * - Cosmic dust clouds
 * - Energy waves
 * - Stellar explosions
 * - Wormhole vortex
 * - Aurora effects
 */

export class AdvancedParticles {
  scene: THREE.Scene;
  particleSystems: THREE.Points[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Create cosmic dust cloud with volumetric lighting effect
   */
  createCosmicDust(
    position: THREE.Vector3,
    particleCount: number = 5000,
    color: number = 0x7c3aed,
    scale: number = 50
  ): THREE.Points {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors_attr = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const velocities = new Float32Array(particleCount * 3);

    const baseColor = new THREE.Color(color);

    for (let i = 0; i < particleCount; i++) {
      // Random position in sphere with bias toward center
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = Math.pow(Math.random(), 0.5) * scale;

      positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r + position.x;
      positions[i * 3 + 1] = Math.cos(phi) * r + position.y;
      positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r + position.z;

      // Color variation
      const colorVariation = 0.3;
      colors_attr[i * 3] = Math.max(0, baseColor.r - Math.random() * colorVariation);
      colors_attr[i * 3 + 1] = Math.max(0, baseColor.g - Math.random() * colorVariation);
      colors_attr[i * 3 + 2] = Math.max(0, baseColor.b + Math.random() * colorVariation);

      // Size variation
      sizes[i] = Math.random() * 1.5 + 0.5;

      // Velocity for drift effect
      velocities[i * 3] = (Math.random() - 0.5) * 0.02;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors_attr, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.3,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      fog: true,
    });

    const points = new THREE.Points(geometry, material);
    this.scene.add(points);
    this.particleSystems.push(points);

    // Animate drift
    const positionAttribute = geometry.getAttribute('position') as THREE.BufferAttribute;
    const velocityArray = velocities;

    const animate = () => {
      const positions = positionAttribute.array as Float32Array;

      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] += velocityArray[i * 3];
        positions[i * 3 + 1] += velocityArray[i * 3 + 1];
        positions[i * 3 + 2] += velocityArray[i * 3 + 2];

        // Wrap around
        if (Math.abs(positions[i * 3] - position.x) > scale * 1.5) {
          positions[i * 3] = position.x + (Math.random() - 0.5) * scale;
        }
        if (Math.abs(positions[i * 3 + 1] - position.y) > scale * 1.5) {
          positions[i * 3 + 1] = position.y + (Math.random() - 0.5) * scale;
        }
        if (Math.abs(positions[i * 3 + 2] - position.z) > scale * 1.5) {
          positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * scale;
        }
      }

      positionAttribute.needsUpdate = true;
      requestAnimationFrame(animate);
    };

    animate();

    return points;
  }

  /**
   * Create energy wave effect
   */
  createEnergyWave(
    position: THREE.Vector3,
    color: number = 0x00d9ff,
    radius: number = 10
  ): THREE.Group {
    const waveGroup = new THREE.Group();
    waveGroup.position.copy(position);

    // Create expanding rings
    for (let i = 0; i < 3; i++) {
      const ringGeometry = new THREE.TorusGeometry(radius * (1 + i * 0.5), 0.5, 32, 100);
      const ringMaterial = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 1.5 - i * 0.3,
        transparent: true,
        opacity: 0.8 - i * 0.2,
      });

      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = Math.PI * 0.3 * i;
      waveGroup.add(ring);

      // Animate expansion
      gsap.to(ring.scale, {
        x: 2,
        y: 2,
        z: 2,
        duration: 2,
        ease: 'power2.out',
      });

      gsap.to(ringMaterial, {
        opacity: 0,
        emissiveIntensity: 0,
        duration: 2,
        ease: 'power2.out',
      });
    }

    return waveGroup;
  }

  /**
   * Create aurora borealis effect
   */
  createAurora(
    position: THREE.Vector3,
    primaryColor: number = 0x00d9ff,
    secondaryColor: number = 0x7c3aed
  ): THREE.Points {
    const particleCount = 2000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors_attr = new Float32Array(particleCount * 3);

    const color1 = new THREE.Color(primaryColor);
    const color2 = new THREE.Color(secondaryColor);

    for (let i = 0; i < particleCount; i++) {
      // Wave-like distribution
      const t = Math.random();
      const x = (Math.random() - 0.5) * 100;
      const y = Math.sin(t * Math.PI * 4) * 20 + Math.random() * 10;
      const z = (Math.random() - 0.5) * 50;

      positions[i * 3] = x + position.x;
      positions[i * 3 + 1] = y + position.y;
      positions[i * 3 + 2] = z + position.z;

      // Color gradient
      const colorMix = Math.random();
      const mixedColor = color1.clone().lerp(color2, colorMix);

      colors_attr[i * 3] = mixedColor.r;
      colors_attr[i * 3 + 1] = mixedColor.g;
      colors_attr[i * 3 + 2] = mixedColor.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors_attr, 3));

    const material = new THREE.PointsMaterial({
      size: 0.8,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      fog: true,
    });

    const points = new THREE.Points(geometry, material);
    this.scene.add(points);
    this.particleSystems.push(points);

    // Pulsing animation
    gsap.to(material, {
      opacity: 0.3,
      duration: 3,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });

    return points;
  }

  /**
   * Create stellar explosion effect
   */
  createStellarExplosion(
    position: THREE.Vector3,
    particleCount: number = 1000,
    color: number = 0xff6b35
  ): THREE.Points {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors_attr = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);

    const baseColor = new THREE.Color(color);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;

      // Random outward velocity
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = Math.random() * 0.5 + 0.2;

      velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      velocities[i * 3 + 1] = Math.cos(phi) * speed;
      velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;

      // Color variation
      colors_attr[i * 3] = baseColor.r + Math.random() * 0.2;
      colors_attr[i * 3 + 1] = baseColor.g * (0.5 + Math.random() * 0.5);
      colors_attr[i * 3 + 2] = baseColor.b * (0.5 + Math.random() * 0.5);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors_attr, 3));

    const material = new THREE.PointsMaterial({
      size: 0.5,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      fog: true,
    });

    const points = new THREE.Points(geometry, material);
    this.scene.add(points);
    this.particleSystems.push(points);

    // Animate explosion
    const positionAttribute = geometry.getAttribute('position') as THREE.BufferAttribute;
    let time = 0;

    const animate = () => {
      const positions = positionAttribute.array as Float32Array;
      time += 0.016;

      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] += velocities[i * 3];
        positions[i * 3 + 1] += velocities[i * 3 + 1];
        positions[i * 3 + 2] += velocities[i * 3 + 2];

        // Gravity effect
        velocities[i * 3 + 1] -= 0.001;
      }

      positionAttribute.needsUpdate = true;

      if (time < 3) {
        requestAnimationFrame(animate);
      }
    };

    animate();

    // Fade out
    gsap.to(material, {
      opacity: 0,
      duration: 3,
      ease: 'power2.in',
    });

    return points;
  }

  dispose() {
    this.particleSystems.forEach((points) => {
      if (points.geometry) points.geometry.dispose();
      if (points.material instanceof THREE.Material) {
        points.material.dispose();
      }
    });
    this.particleSystems = [];
  }
}
