import * as THREE from 'three';
import gsap from 'gsap';

/**
 * Advanced Nebula Field Generator
 * 
 * Creates realistic nebula effects with:
 * - Procedural dust clouds
 * - Multiple emission layers
 * - Realistic light scattering
 * - Dynamic color shifts
 * - Parallax depth effects
 */

export class NebulaGenerator {
  scene: THREE.Scene;
  nebulaMeshes: THREE.Mesh[] = [];
  particleSystems: THREE.Points[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Create a realistic nebula cloud with layered dust and emission
   */
  createNebula(
    position: THREE.Vector3,
    scale: number,
    colors: number[],
    intensity: number = 1
  ): THREE.Group {
    const nebulaGroup = new THREE.Group();
    nebulaGroup.position.copy(position);

    // Layer 1: Dense dust cloud (dark matter)
    const dustGeometry = new THREE.IcosahedronGeometry(scale, 6);
    const dustMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      metalness: 0.3,
      roughness: 0.9,
      emissive: colors[0] || 0x7c3aed,
      emissiveIntensity: intensity * 0.3,
    });
    const dustMesh = new THREE.Mesh(dustGeometry, dustMaterial);
    dustMesh.scale.set(1, 0.8, 0.9);
    nebulaGroup.add(dustMesh);

    // Layer 2: Emission nebula (bright gas)
    const emissionGeometry = new THREE.IcosahedronGeometry(scale * 0.8, 5);
    const emissionMaterial = new THREE.MeshStandardMaterial({
      color: colors[1] || 0x00d9ff,
      metalness: 0.1,
      roughness: 0.7,
      emissive: colors[1] || 0x00d9ff,
      emissiveIntensity: intensity * 0.8,
      transparent: true,
      opacity: 0.6,
    });
    const emissionMesh = new THREE.Mesh(emissionGeometry, emissionMaterial);
    emissionMesh.scale.set(0.9, 0.85, 0.95);
    nebulaGroup.add(emissionMesh);

    // Layer 3: Bright core (ionized gas)
    const coreGeometry = new THREE.IcosahedronGeometry(scale * 0.5, 4);
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: colors[2] || 0xfbbf24,
      metalness: 0,
      roughness: 0.5,
      emissive: colors[2] || 0xfbbf24,
      emissiveIntensity: intensity * 1.2,
      transparent: true,
      opacity: 0.8,
    });
    const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
    coreMesh.scale.set(0.7, 0.7, 0.7);
    nebulaGroup.add(coreMesh);

    // Animate layers with different speeds for depth
    gsap.to(dustMesh.rotation, {
      x: Math.PI * 2,
      y: Math.PI * 2,
      duration: 40,
      repeat: -1,
      ease: 'none',
    });

    gsap.to(emissionMesh.rotation, {
      x: -Math.PI * 2,
      z: Math.PI * 2,
      duration: 30,
      repeat: -1,
      ease: 'none',
    });

    gsap.to(coreMesh.rotation, {
      y: Math.PI * 2,
      z: Math.PI,
      duration: 20,
      repeat: -1,
      ease: 'none',
    });

    this.nebulaMeshes.push(dustMesh, emissionMesh, coreMesh);
    return nebulaGroup;
  }

  /**
   * Create a particle field for nebula dust
   */
  createDustField(
    position: THREE.Vector3,
    particleCount: number,
    colors: number[],
    radius: number = 50
  ): THREE.Points {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors_attr = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      // Random position in sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const r = Math.random() * radius;

      positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r + position.x;
      positions[i * 3 + 1] = Math.cos(phi) * r + position.y;
      positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r + position.z;

      // Random color from palette
      const color = new THREE.Color(colors[Math.floor(Math.random() * colors.length)]);
      colors_attr[i * 3] = color.r;
      colors_attr[i * 3 + 1] = color.g;
      colors_attr[i * 3 + 2] = color.b;

      // Size variation
      sizes[i] = Math.random() * 2 + 0.5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors_attr, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.5,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      fog: true,
    });

    const points = new THREE.Points(geometry, material);
    this.scene.add(points);
    this.particleSystems.push(points);

    // Animate particles with slow drift
    gsap.to(points.rotation, {
      x: Math.PI * 2,
      y: Math.PI * 2,
      z: Math.PI,
      duration: 120,
      repeat: -1,
      ease: 'none',
    });

    return points;
  }

  /**
   * Create a black hole with accretion disk
   */
  createBlackHole(
    position: THREE.Vector3,
    scale: number = 2
  ): THREE.Group {
    const blackHoleGroup = new THREE.Group();
    blackHoleGroup.position.copy(position);

    // Event horizon (dark sphere)
    const horizonGeometry = new THREE.SphereGeometry(scale, 32, 32);
    const horizonMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      metalness: 1,
      roughness: 0,
      emissive: 0x1a1a2e,
      emissiveIntensity: 0.5,
    });
    const horizon = new THREE.Mesh(horizonGeometry, horizonMaterial);
    blackHoleGroup.add(horizon);

    // Accretion disk (rotating ring)
    const diskGeometry = new THREE.TorusGeometry(scale * 2.5, scale * 0.8, 16, 100);
    const diskMaterial = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xfbbf24,
      emissiveIntensity: 1,
      metalness: 0.5,
      roughness: 0.3,
      transparent: true,
      opacity: 0.8,
    });
    const disk = new THREE.Mesh(diskGeometry, diskMaterial);
    disk.rotation.x = Math.PI * 0.3;
    blackHoleGroup.add(disk);

    // Radiation jets
    const jetGeometry = new THREE.ConeGeometry(scale * 0.5, scale * 3, 16);
    const jetMaterial = new THREE.MeshStandardMaterial({
      color: 0x00d9ff,
      emissive: 0x00d9ff,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.7,
    });

    const jetTop = new THREE.Mesh(jetGeometry, jetMaterial);
    jetTop.position.z = scale * 2;
    blackHoleGroup.add(jetTop);

    const jetBottom = new THREE.Mesh(jetGeometry, jetMaterial);
    jetBottom.rotation.z = Math.PI;
    jetBottom.position.z = -scale * 2;
    blackHoleGroup.add(jetBottom);

    // Animate accretion disk rotation
    gsap.to(disk.rotation, {
      y: Math.PI * 2,
      duration: 8,
      repeat: -1,
      ease: 'none',
    });

    // Pulsing jets
    gsap.to(jetMaterial, {
      emissiveIntensity: 2,
      duration: 1.5,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });

    this.nebulaMeshes.push(horizon, disk, jetTop, jetBottom);
    return blackHoleGroup;
  }

  /**
   * Create a wormhole visualization
   */
  createWormhole(
    position: THREE.Vector3,
    scale: number = 3
  ): THREE.Group {
    const wormholeGroup = new THREE.Group();
    wormholeGroup.position.copy(position);

    // Create concentric rings for wormhole tunnel effect
    for (let i = 0; i < 5; i++) {
      const ringGeometry = new THREE.TorusGeometry(scale * (1 + i * 0.3), scale * 0.2, 16, 100);
      const ringMaterial = new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0x7c3aed : 0x00d9ff,
        emissive: i % 2 === 0 ? 0x7c3aed : 0x00d9ff,
        emissiveIntensity: 0.8 + i * 0.2,
        metalness: 0.7,
        roughness: 0.2,
        transparent: true,
        opacity: 0.6 - i * 0.08,
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = Math.PI * 0.2 * i;
      wormholeGroup.add(ring);

      // Animate each ring
      gsap.to(ring.rotation, {
        y: Math.PI * 2 * (i % 2 === 0 ? 1 : -1),
        duration: 10 - i * 1.5,
        repeat: -1,
        ease: 'none',
      });
    }

    // Center vortex
    const vortexGeometry = new THREE.SphereGeometry(scale * 0.5, 32, 32);
    const vortexMaterial = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xfbbf24,
      emissiveIntensity: 2,
      metalness: 0,
      roughness: 0.4,
    });
    const vortex = new THREE.Mesh(vortexGeometry, vortexMaterial);
    wormholeGroup.add(vortex);

    // Pulsing effect
    gsap.to(vortex.scale, {
      x: 1.2,
      y: 1.2,
      z: 1.2,
      duration: 2,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });

    this.nebulaMeshes.push(...wormholeGroup.children as THREE.Mesh[]);
    return wormholeGroup;
  }

  /**
   * Create a stellar explosion/supernova effect
   */
  createSupernova(
    position: THREE.Vector3,
    scale: number = 1
  ): THREE.Group {
    const supernovaGroup = new THREE.Group();
    supernovaGroup.position.copy(position);

    // Explosion sphere
    const explosionGeometry = new THREE.IcosahedronGeometry(scale, 5);
    const explosionMaterial = new THREE.MeshStandardMaterial({
      color: 0xff6b35,
      emissive: 0xff6b35,
      emissiveIntensity: 2,
      metalness: 0.2,
      roughness: 0.6,
      transparent: true,
      opacity: 0.8,
    });
    const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
    supernovaGroup.add(explosion);

    // Expanding shockwave
    gsap.to(explosion.scale, {
      x: 3,
      y: 3,
      z: 3,
      duration: 2,
      ease: 'power2.out',
    });

    gsap.to(explosionMaterial, {
      opacity: 0,
      emissiveIntensity: 0,
      duration: 2,
      ease: 'power2.out',
    });

    this.nebulaMeshes.push(explosion);
    return supernovaGroup;
  }

  dispose() {
    this.nebulaMeshes.forEach((mesh) => {
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose();
      }
    });

    this.particleSystems.forEach((points) => {
      if (points.geometry) points.geometry.dispose();
      if (points.material instanceof THREE.Material) {
        points.material.dispose();
      }
    });

    this.nebulaMeshes = [];
    this.particleSystems = [];
  }
}
