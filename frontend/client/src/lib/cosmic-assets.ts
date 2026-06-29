/**
 * Cosmic Assets Library
 * 
 * High-quality realistic cosmic imagery for immersive experience
 * All images sourced from NASA/ESA/Hubble Space Telescope
 */

export const COSMIC_IMAGES = {
  // Nebulas
  nebula_pillars: '/manus-storage/0c5DZ9xaYvRt_31173e73.jpg', // Pillars of Creation
  nebula_colorful: '/manus-storage/3BDP7kLJ41E0_7e85ad17.jpg', // Deep field nebula
  nebula_emission: '/manus-storage/astmgtqaa80j_19078b00.jpg', // Emission nebula

  // Black Holes & Cosmic Phenomena
  black_hole: '/manus-storage/DsR9OqAaV9uJ_7c968d1e.jpg', // Black hole visualization
  white_hole: '/manus-storage/6uAT57lzPOP1_b7137eeb.jpg', // White hole concept
  wormhole: '/manus-storage/rLzGU2sRJdzs_b0c31887.jpg', // Wormhole visualization

  // Galaxies & Stars
  galaxy_field: '/manus-storage/SCBge4v8Ew0b_adc7a759.jpg', // Deep space field
  star_field: '/manus-storage/ss78sXutAVqF_6a95e3cd.jpeg', // Star field

  // Coronal phenomena (for VELC)
  coronal_structure: '/manus-storage/0c5DZ9xaYvRt_31173e73.jpg',
  solar_flare: '/manus-storage/astmgtqaa80j_19078b00.jpg',

  // Spectral phenomena (for SOLEXS)
  spectral_emission: '/manus-storage/3BDP7kLJ41E0_7e85ad17.jpg',
  light_spectrum: '/manus-storage/SCBge4v8Ew0b_adc7a759.jpg',

  // Correlation phenomena
  cosmic_collision: '/manus-storage/DsR9OqAaV9uJ_7c968d1e.jpg',
  dimensional_rift: '/manus-storage/6uAT57lzPOP1_b7137eeb.jpg',
};

export const COSMIC_COLORS = {
  nebula_purple: '#7c3aed',
  nebula_blue: '#00d9ff',
  nebula_orange: '#f97316',
  nebula_pink: '#ec4899',
  nebula_cyan: '#06b6d4',
  event_horizon: '#1a1a2e',
  accretion_disk: '#fbbf24',
  radiation: '#fca5a5',
};

export const COSMIC_DESCRIPTIONS = {
  velc: {
    title: 'VELC: Coronal Intelligence',
    subtitle: 'Observing the Sun\'s Outer Atmosphere',
    description:
      'The Visible Emission Line Coronagraph captures the dynamic corona of our star, revealing magnetic structures, coronal mass ejections, and anomalies that shape space weather.',
    narrative:
      'Like a surgeon examining the intricate pathways of a living system, we observe the corona\'s delicate dance of plasma and magnetism.',
  },
  solexs: {
    title: 'SOLEXS: Spectral Intelligence',
    subtitle: 'Decoding Solar Radiation',
    description:
      'The Solar EUV Imaging Spectrograph analyzes extreme ultraviolet radiation, tracking flares, eruptions, and the energy dynamics of solar phenomena.',
    narrative:
      'Every photon tells a story. In the ultraviolet spectrum lies the truth of solar violence and transformation.',
  },
  correlation: {
    title: 'Correlation Engine',
    subtitle: 'Fusion of Intelligence',
    description:
      'Where coronal observations meet spectral analysis, patterns emerge. The Correlation Engine reveals the hidden connections between different solar phenomena.',
    narrative:
      'Truth exists at the intersection of multiple perspectives. When corona and spectrum align, we glimpse the universe\'s deeper logic.',
  },
};
