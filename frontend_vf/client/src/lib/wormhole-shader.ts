/**
 * Wormhole Distortion Shader
 * 
 * Creates a dramatic radial distortion effect with:
 * - Radial warping from center
 * - Chromatic aberration (color separation)
 * - Particle swirl effect
 * - Time-based animation
 * 
 * Design Philosophy:
 * - Simulates passage through a wormhole
 * - Inspired by Interstellar's tesseract sequence
 * - Smooth, organic motion
 */

export const wormholeVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const wormholeFragmentShader = `
  uniform sampler2D tDiffuse;
  uniform float uTime;
  uniform float uIntensity;
  uniform vec2 uCenter;
  
  varying vec2 vUv;

  // Simplex noise function for organic motion
  vec3 mod289(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
  }

  vec2 mod289(vec2 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
  }

  vec3 permute(vec3 x) {
    return mod289(((x * 34.0) + 1.0) * x);
  }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                        0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                       -0.577350269189626,  // -1.0 + 2.0 * C.x
                        0.024390243902439); // 1.0 / 41.0
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v - i + dot(i, C.xx) ;
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
      + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
      dot(x12.zw,x12.zw)), 0.0);
    m = m*m ;
    m = m*m ;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    vec2 uv = vUv;
    vec2 center = uCenter;
    vec2 delta = uv - center;
    float dist = length(delta);
    float angle = atan(delta.y, delta.x);

    // Radial distortion - creates wormhole tunnel effect
    float wormholeIntensity = uIntensity * (1.0 - smoothstep(0.0, 1.5, dist));
    
    // Radial warping
    float warp = sin(dist * 10.0 - uTime * 3.0) * 0.1 * wormholeIntensity;
    float radialDistort = dist + warp;
    
    // Spiral effect - creates swirl
    float spiralAngle = angle + uTime * 2.0 + sin(dist * 5.0) * 0.5;
    
    // Reconstruct UV with distortion
    vec2 distortedUv = center + vec2(
      cos(spiralAngle) * radialDistort,
      sin(spiralAngle) * radialDistort
    );

    // Add noise for organic motion
    float noise = snoise(vUv * 5.0 + uTime);
    distortedUv += noise * 0.02 * wormholeIntensity;

    // Chromatic aberration (color separation)
    float aberration = 0.01 * wormholeIntensity;
    
    vec4 colorR = texture2D(tDiffuse, distortedUv + vec2(aberration, 0.0));
    vec4 colorG = texture2D(tDiffuse, distortedUv);
    vec4 colorB = texture2D(tDiffuse, distortedUv - vec2(aberration, 0.0));

    vec4 color = vec4(
      colorR.r,
      colorG.g,
      colorB.b,
      colorG.a
    );

    // Add glow effect at center
    float glowIntensity = smoothstep(0.5, 0.0, dist) * wormholeIntensity;
    vec3 glowColor = mix(
      vec3(0.0, 0.85, 1.0),  // electric blue
      vec3(0.49, 0.23, 0.93), // deep purple
      sin(uTime) * 0.5 + 0.5
    );
    
    color.rgb += glowColor * glowIntensity * 0.5;

    // Fade edges
    float edgeFade = smoothstep(1.0, 0.8, dist);
    color.rgb *= edgeFade;

    gl_FragColor = color;
  }
`;

/**
 * Particle swirl shader for wormhole transition
 */
export const particleVertexShader = `
  attribute float aSize;
  attribute vec3 aVelocity;
  
  uniform float uTime;
  uniform float uIntensity;
  
  varying float vOpacity;
  varying vec3 vColor;

  void main() {
    vec3 pos = position;
    
    // Spiral motion
    float angle = atan(pos.y, pos.x) + uTime * 2.0;
    float radius = length(pos.xy);
    
    pos.x = cos(angle) * radius;
    pos.y = sin(angle) * radius;
    pos.z += uTime * 3.0 * uIntensity;

    // Velocity-based movement
    pos += aVelocity * uTime * uIntensity;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * (1.0 - uTime * uIntensity);

    // Fade out over time
    vOpacity = 1.0 - (uTime * uIntensity);
    
    // Color variation
    vColor = vec3(
      0.0 + sin(uTime) * 0.2,
      0.85 + cos(uTime * 0.5) * 0.15,
      1.0
    );
  }
`;

export const particleFragmentShader = `
  varying float vOpacity;
  varying vec3 vColor;

  void main() {
    // Create circular particle with soft edges
    vec2 center = gl_PointCoord - 0.5;
    float dist = length(center);
    
    if (dist > 0.5) discard;
    
    float alpha = (1.0 - dist * 2.0) * vOpacity;
    
    gl_FragColor = vec4(vColor, alpha);
  }
`;

/**
 * Clock distortion shader for "warped clocks" effect
 */
export const clockDistortionVertexShader = `
  varying vec2 vUv;
  varying vec3 vPos;

  void main() {
    vUv = uv;
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const clockDistortionFragmentShader = `
  uniform float uTime;
  uniform float uIntensity;
  
  varying vec2 vUv;
  varying vec3 vPos;

  void main() {
    vec2 uv = vUv;
    
    // Create circular clock face
    vec2 center = vec2(0.5, 0.5);
    vec2 delta = uv - center;
    float dist = length(delta);
    float angle = atan(delta.y, delta.x);

    // Distort based on distance from center
    float distortion = sin(dist * 10.0 - uTime * 3.0) * 0.1 * uIntensity;
    float distortedDist = dist + distortion;

    // Create radial lines (clock hands)
    float lines = abs(sin(angle * 12.0)) * 0.3;
    
    // Warped effect
    float warp = sin(angle * 4.0 + uTime * 2.0) * distortion;
    
    // Color based on distortion
    vec3 color = mix(
      vec3(0.0, 0.85, 1.0),  // electric blue
      vec3(0.49, 0.23, 0.93), // deep purple
      sin(uTime + angle) * 0.5 + 0.5
    );

    // Apply clock pattern
    float clock = step(0.45, distortedDist) * step(distortedDist, 0.5);
    clock += lines * step(0.4, distortedDist) * step(distortedDist, 0.5);

    // Blend with distortion
    color = mix(color, vec3(1.0), clock * 0.5);
    
    // Fade at edges
    float alpha = smoothstep(0.55, 0.45, distortedDist);
    
    gl_FragColor = vec4(color, alpha * uIntensity);
  }
`;
