/**
 * Advanced Animation Effects System
 * 
 * Features:
 * - Realistic physics simulation
 * - Slow-motion effects
 * - Camera shake and turbulence
 * - Motion blur
 * - Lens flares and distortion
 * - Time dilation effects
 */

export class AnimationEffects {
  /**
   * Generate camera shake for turbulence/collision
   */
  static getCameraShake(
    intensity: number = 1,
    frequency: number = 10,
    time: number = 0
  ): { x: number; y: number; z: number } {
    return {
      x: Math.sin(time * frequency) * intensity * 0.1,
      y: Math.cos(time * frequency * 1.3) * intensity * 0.1,
      z: Math.sin(time * frequency * 0.7) * intensity * 0.05,
    };
  }

  /**
   * Generate heat distortion effect
   */
  static getHeatDistortion(time: number, intensity: number = 1): number {
    return Math.sin(time * 3) * intensity * 0.02 + Math.cos(time * 2.5) * intensity * 0.015;
  }

  /**
   * Generate time dilation effect (slowed visuals)
   */
  static getTimeDilationFactor(distanceFromBlackHole: number, maxDistance: number = 100): number {
    // Closer to black hole = slower time
    const normalized = Math.max(0, Math.min(1, 1 - distanceFromBlackHole / maxDistance));
    return 0.3 + normalized * 0.7; // Range: 0.3x to 1x speed
  }

  /**
   * Generate lens flare positions
   */
  static getLensFlarePositions(lightPos: { x: number; y: number }, screenSize: { width: number; height: number }) {
    const centerX = screenSize.width / 2;
    const centerY = screenSize.height / 2;

    const dx = lightPos.x - centerX;
    const dy = lightPos.y - centerY;

    return [
      { x: lightPos.x, y: lightPos.y, scale: 1, opacity: 0.8 },
      { x: centerX + dx * 0.5, y: centerY + dy * 0.5, scale: 0.6, opacity: 0.5 },
      { x: centerX + dx * 0.3, y: centerY + dy * 0.3, scale: 0.4, opacity: 0.3 },
      { x: centerX - dx * 0.2, y: centerY - dy * 0.2, scale: 0.3, opacity: 0.2 },
    ];
  }

  /**
   * Generate motion blur effect
   */
  static getMotionBlurAmount(velocity: number, maxVelocity: number = 10): number {
    return Math.min(1, velocity / maxVelocity) * 0.3; // Max 30% blur
  }

  /**
   * Generate gravitational lensing distortion
   */
  static getGravitationalLensing(
    pixelX: number,
    pixelY: number,
    centerX: number,
    centerY: number,
    strength: number = 1
  ): { x: number; y: number } {
    const dx = pixelX - centerX;
    const dy = pixelY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) return { x: 0, y: 0 };

    const angle = Math.atan2(dy, dx);
    const distortion = (strength * 50) / (distance + 1);

    return {
      x: Math.cos(angle) * distortion,
      y: Math.sin(angle) * distortion,
    };
  }

  /**
   * Generate relativistic warping effect
   */
  static getRelativisticWarp(time: number, intensity: number = 1): number {
    // Creates a stretching effect that increases with velocity
    return Math.sin(time * 2) * intensity * 0.1;
  }

  /**
   * Generate particle physics
   */
  static updateParticlePhysics(
    particle: {
      x: number;
      y: number;
      z: number;
      vx: number;
      vy: number;
      vz: number;
      life: number;
      maxLife: number;
    },
    gravity: { x: number; y: number; z: number } = { x: 0, y: -0.1, z: 0 },
    damping: number = 0.99
  ) {
    // Apply gravity
    particle.vx += gravity.x;
    particle.vy += gravity.y;
    particle.vz += gravity.z;

    // Apply damping
    particle.vx *= damping;
    particle.vy *= damping;
    particle.vz *= damping;

    // Update position
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.z += particle.vz;

    // Update life
    particle.life += 1;
  }

  /**
   * Generate slow-motion time factor
   */
  static getSlowMotionFactor(
    targetTime: number,
    currentTime: number,
    duration: number,
    minFactor: number = 0.3
  ): number {
    const progress = (currentTime - targetTime) / duration;
    if (progress < 0) return 1;
    if (progress > 1) return 1;

    // Ease in slow motion
    const eased = Math.sin(progress * Math.PI) * 0.5 + 0.5;
    return 1 - eased * (1 - minFactor);
  }

  /**
   * Generate chromatic aberration effect
   */
  static getChromaticAberration(
    time: number,
    intensity: number = 1
  ): { r: number; g: number; b: number } {
    const offset = Math.sin(time * 2) * intensity * 0.02;
    return {
      r: offset,
      g: 0,
      b: -offset,
    };
  }

  /**
   * Generate depth of field blur
   */
  static getDepthOfFieldBlur(
    distance: number,
    focusDistance: number = 50,
    maxBlur: number = 10
  ): number {
    const blur = Math.abs(distance - focusDistance) * 0.1;
    return Math.min(maxBlur, blur);
  }

  /**
   * Generate vignette effect
   */
  static getVignetteIntensity(
    x: number,
    y: number,
    width: number,
    height: number,
    strength: number = 0.5
  ): number {
    const centerX = width / 2;
    const centerY = height / 2;
    const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);

    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return 1 - (distance / maxDistance) * strength;
  }
}

/**
 * Easing functions for cinematic animations
 */
export const CinematicEasing = {
  // Slow start, fast end
  easeInQuad: (t: number) => t * t,

  // Fast start, slow end
  easeOutQuad: (t: number) => t * (2 - t),

  // Smooth acceleration and deceleration
  easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),

  // Cubic easing for more dramatic effect
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => 1 + (t - 1) * (t - 1) * (t - 1),
  easeInOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 + (t - 1) * (2 * (t - 2)) * (2 * (t - 2)),

  // Elastic easing for bouncy effects
  easeOutElastic: (t: number) => {
    const c5 = (2 * Math.PI) / 4.5;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c5) + 1;
  },

  // Back easing for overshoot effects
  easeOutBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};
