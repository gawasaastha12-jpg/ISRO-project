import * as THREE from 'three';

/**
 * Cosmic Three.js Scene Manager
 * Handles creation and management of 3D scenes for VELC, SOLEXS, and Correlation Engine modules
 * 
 * Design Philosophy:
 * - Deep space backgrounds with particle nebulae
 * - Glowing objects with electric blue and purple accents
 * - Smooth camera transitions using GSAP
 * - Performance optimized with LOD and instancing
 */

export interface SceneConfig {
  container: HTMLElement;
  width: number;
  height: number;
  backgroundColor?: number;
}

export class CosmicScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  container: HTMLElement;
  particleSystem?: THREE.Points;
  animationFrameId?: number;

  constructor(config: SceneConfig) {
    this.container = config.container;

    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(config.backgroundColor || 0x0a0e27);
    this.scene.fog = new THREE.FogExp2(0x0a0e27, 0.0008);

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(
      75,
      config.width / config.height,
      0.1,
      10000
    );
    this.camera.position.z = 5;

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(config.width, config.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Add lighting
    this.setupLighting();

    // Add particle nebula
    this.createParticleNebula();

    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());
  }

  private setupLighting() {
    // Ambient light - soft cosmic glow
    const ambientLight = new THREE.AmbientLight(0x7c3aed, 0.4);
    this.scene.add(ambientLight);

    // Point light - electric blue
    const pointLight = new THREE.PointLight(0x00d9ff, 1);
    pointLight.position.set(10, 10, 10);
    pointLight.castShadow = true;
    pointLight.shadow.mapSize.width = 2048;
    pointLight.shadow.mapSize.height = 2048;
    this.scene.add(pointLight);

    // Directional light - subtle
    const directionalLight = new THREE.DirectionalLight(0xfbbf24, 0.3);
    directionalLight.position.set(-10, 10, 5);
    this.scene.add(directionalLight);
  }

  private createParticleNebula() {
    const particleCount = 1000;
    const geometry = new THREE.BufferGeometry();

    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      // Position - random in sphere
      positions[i] = (Math.random() - 0.5) * 100;
      positions[i + 1] = (Math.random() - 0.5) * 100;
      positions[i + 2] = (Math.random() - 0.5) * 100;

      // Color - mix of electric blue and purple
      const useBlue = Math.random() > 0.5;
      if (useBlue) {
        colors[i] = 0; // R
        colors[i + 1] = 0.85; // G
        colors[i + 2] = 1; // B (electric blue)
      } else {
        colors[i] = 0.49; // R
        colors[i + 1] = 0.23; // G
        colors[i + 2] = 0.93; // B (deep purple)
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true,
    });

    this.particleSystem = new THREE.Points(geometry, material);
    this.scene.add(this.particleSystem);
  }

  /**
   * Create a glowing sphere (for anomalies, black holes, etc.)
   */
  createGlowingSphere(
    position: THREE.Vector3,
    radius: number = 1,
    color: number = 0x00d9ff,
    intensity: number = 1
  ): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: intensity,
      metalness: 0.8,
      roughness: 0.2,
    });

    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(position);
    sphere.castShadow = true;
    sphere.receiveShadow = true;

    this.scene.add(sphere);
    return sphere;
  }

  /**
   * Create a glowing torus (for orbital paths, rings, etc.)
   */
  createGlowingTorus(
    position: THREE.Vector3,
    radius: number = 2,
    tubeRadius: number = 0.1,
    color: number = 0x7c3aed
  ): THREE.Mesh {
    const geometry = new THREE.TorusGeometry(radius, tubeRadius, 32, 100);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.8,
      metalness: 0.6,
      roughness: 0.3,
    });

    const torus = new THREE.Mesh(geometry, material);
    torus.position.copy(position);
    torus.castShadow = true;
    torus.receiveShadow = true;

    this.scene.add(torus);
    return torus;
  }

  /**
   * Create a particle burst effect (for flares, explosions)
   */
  createParticleBurst(
    position: THREE.Vector3,
    particleCount: number = 100,
    color: number = 0xfbbf24,
    speed: number = 0.5
  ): THREE.Points {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = position.x;
      positions[i + 1] = position.y;
      positions[i + 2] = position.z;

      // Random velocity in all directions
      velocities[i] = (Math.random() - 0.5) * speed;
      velocities[i + 1] = (Math.random() - 0.5) * speed;
      velocities[i + 2] = (Math.random() - 0.5) * speed;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));

    const material = new THREE.PointsMaterial({
      color,
      size: 0.2,
      transparent: true,
      opacity: 1,
      sizeAttenuation: true,
    });

    const burst = new THREE.Points(geometry, material);
    this.scene.add(burst);

    // Animate burst
    let age = 0;
    const maxAge = 2; // 2 seconds
    const animate = () => {
      age += 0.016; // ~60fps
      const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
      const velAttr = geometry.getAttribute('velocity') as THREE.BufferAttribute;
      const positions = posAttr.array as Float32Array;
      const velocities = velAttr.array as Float32Array;

      for (let i = 0; i < positions.length; i += 3) {
        positions[i] += velocities[i];
        positions[i + 1] += velocities[i + 1];
        positions[i + 2] += velocities[i + 2];
      }

      posAttr.needsUpdate = true;
      material.opacity = 1 - age / maxAge;

      if (age < maxAge) {
        requestAnimationFrame(animate);
      } else {
        this.scene.remove(burst);
      }
    };

    animate();
    return burst;
  }

  /**
   * Animate particle nebula with mouse parallax
   */
  animateParticles(mouseX: number, mouseY: number) {
    if (this.particleSystem) {
      this.particleSystem.rotation.x += mouseY * 0.0001;
      this.particleSystem.rotation.y += mouseX * 0.0001;
    }
  }

  /**
   * Smooth camera transition
   */
  async cameraTransition(
    targetPos: THREE.Vector3,
    targetLookAt: THREE.Vector3,
    duration: number = 1000
  ): Promise<void> {
    return new Promise((resolve) => {
      const startPos = this.camera.position.clone();
      const startLookAt = new THREE.Vector3();
      this.camera.getWorldDirection(startLookAt);
      startLookAt.multiplyScalar(this.camera.position.length()).add(this.camera.position);

      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function: cubic-bezier(0.34, 1.56, 0.64, 1)
        const easeProgress = this.easeOutElastic(progress);

        this.camera.position.lerpVectors(startPos, targetPos, easeProgress);
        this.camera.lookAt(targetLookAt);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      animate();
    });
  }

  /**
   * Elastic easing function
   */
  private easeOutElastic(t: number): number {
    const c5 = (2 * Math.PI) / 4.5;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c5) + 1;
  }

  /**
   * Start render loop
   */
  startRenderLoop() {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  /**
   * Stop render loop
   */
  stopRenderLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  /**
   * Handle window resize
   */
  private onWindowResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Cleanup
   */
  dispose() {
    this.stopRenderLoop();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}

export default CosmicScene;
