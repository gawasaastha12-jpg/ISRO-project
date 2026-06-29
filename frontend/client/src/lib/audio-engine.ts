/**
 * Immersive Audio Engine for Cosmic Intelligence Platform
 * 
 * Features:
 * - Procedural sound generation (bass rumbles, whooshes, crackles)
 * - Spatial audio with panning
 * - Doppler effect simulation
 * - Ambient soundscapes
 * - Sound design cues for each scene
 * - AI Voice Narration (Text-To-Speech)
 */

export class AudioEngine {
  public audioContext: AudioContext;
  private masterGain: GainNode;
  private currentOscillators: OscillatorNode[] = [];
  private currentGains: GainNode[] = [];

  constructor() {
    // Initialize Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.audioContext = audioContext;

    // Master gain for volume control
    this.masterGain = audioContext.createGain();
    this.masterGain.gain.value = 0.4; // Start at 40% volume for better audibility
    this.masterGain.connect(audioContext.destination);
    console.log('AudioEngine: Initialized. Context state:', audioContext.state);
  }

  /**
   * Explicitly resumes the AudioContext if it was suspended.
   * This is required due to browser autoplay policies.
   */
  async resumeContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log('AudioEngine: AudioContext resumed successfully. State:', this.audioContext.state);
      } catch (error) {
        console.error('AudioEngine: Failed to resume AudioContext:', error);
      }
    }
  }

  /**
   * Helper to ensure AudioContext is running before playing sound.
   */
  private ensureResumed() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().then(() => {
        console.log('AudioEngine: Context auto-resumed on play call. State:', this.audioContext.state);
      }).catch((err) => {
        console.warn('AudioEngine: Context is suspended and could not be resumed automatically. A user gesture is required.', err);
      });
    }
  }

  /**
   * Deep bass rumble for awe moments
   * Frequencies raised from (30Hz -> 20Hz) to (80Hz -> 45Hz) to make it audible on standard speakers.
   */
  playDeepBassRumble(duration: number = 3) {
    this.ensureResumed();
    console.log('AudioEngine: Playing Deep Bass Rumble. State:', this.audioContext?.state);
    
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(45, this.audioContext.currentTime + duration);

    gain.gain.setValueAtTime(0.15, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(this.audioContext.currentTime);
    osc.stop(this.audioContext.currentTime + duration);

    this.currentOscillators.push(osc);
    this.currentGains.push(gain);
  }

  /**
   * Cosmic explosion sound
   */
  playCosmicExplosion(duration: number = 2) {
    this.ensureResumed();
    console.log('AudioEngine: Playing Cosmic Explosion. State:', this.audioContext?.state);

    // White noise burst
    const bufferSize = this.audioContext.sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = this.audioContext.createBufferSource();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    source.buffer = buffer;
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(250, this.audioContext.currentTime);
    filter.frequency.exponentialRampToValueAtTime(4000, this.audioContext.currentTime + 0.6);

    gain.gain.setValueAtTime(0.35, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    source.start(this.audioContext.currentTime);
    source.stop(this.audioContext.currentTime + duration);

    this.currentGains.push(gain);
  }

  /**
   * Wormhole whoosh with Doppler effect
   */
  playWormholeWhoosh(duration: number = 1.5) {
    this.ensureResumed();
    console.log('AudioEngine: Playing Wormhole Whoosh. State:', this.audioContext?.state);
    
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'sine';
    // Doppler effect: frequency shifts from high to low
    osc.frequency.setValueAtTime(1000, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(250, this.audioContext.currentTime + duration * 0.7);
    osc.frequency.exponentialRampToValueAtTime(110, this.audioContext.currentTime + duration);

    gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(this.audioContext.currentTime);
    osc.stop(this.audioContext.currentTime + duration);

    this.currentOscillators.push(osc);
    this.currentGains.push(gain);
  }

  /**
   * Solar flare crackle
   */
  playFlareCrackle() {
    this.ensureResumed();
    console.log('AudioEngine: Playing Flare Crackle. State:', this.audioContext?.state);

    const bufferSize = this.audioContext.sampleRate * 0.4;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    // Sparse crackle pattern
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() > 0.85 ? (Math.random() * 2 - 1) * 0.4 : 0;
    }

    const source = this.audioContext.createBufferSource();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    source.buffer = buffer;
    filter.type = 'highpass';
    filter.frequency.value = 2500;

    gain.gain.setValueAtTime(0.15, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.4);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    source.start(this.audioContext.currentTime);
    source.stop(this.audioContext.currentTime + 0.4);

    this.currentGains.push(gain);
  }

  /**
   * Ambient space hum
   * Enhanced with a harmonic to be audible on standard speakers.
   */
  playAmbientHum(duration: number = 5) {
    this.ensureResumed();
    console.log('AudioEngine: Playing Ambient Hum. State:', this.audioContext?.state);

    // Fundamental frequency
    const osc1 = this.audioContext.createOscillator();
    const gain1 = this.audioContext.createGain();
    osc1.type = 'sine';
    osc1.frequency.value = 110; // Low hum

    // Harmonic for laptop speakers compatibility
    const osc2 = this.audioContext.createOscillator();
    const gain2 = this.audioContext.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = 220; // One octave up

    gain1.gain.setValueAtTime(0, this.audioContext.currentTime);
    gain1.gain.linearRampToValueAtTime(0.06, this.audioContext.currentTime + 0.5);
    gain1.gain.linearRampToValueAtTime(0.06, this.audioContext.currentTime + duration - 0.5);
    gain1.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration);

    gain2.gain.setValueAtTime(0, this.audioContext.currentTime);
    gain2.gain.linearRampToValueAtTime(0.03, this.audioContext.currentTime + 0.5);
    gain2.gain.linearRampToValueAtTime(0.03, this.audioContext.currentTime + duration - 0.5);
    gain2.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration);

    osc1.connect(gain1);
    gain1.connect(this.masterGain);

    osc2.connect(gain2);
    gain2.connect(this.masterGain);

    osc1.start(this.audioContext.currentTime);
    osc1.stop(this.audioContext.currentTime + duration);
    osc2.start(this.audioContext.currentTime);
    osc2.stop(this.audioContext.currentTime + duration);

    this.currentOscillators.push(osc1, osc2);
    this.currentGains.push(gain1, gain2);
  }

  /**
   * Collision/impact sound
   */
  playCollisionImpact() {
    this.ensureResumed();
    console.log('AudioEngine: Playing Collision Impact. State:', this.audioContext?.state);

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(350, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(90, this.audioContext.currentTime + 0.15);

    gain.gain.setValueAtTime(0.25, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(this.audioContext.currentTime);
    osc.stop(this.audioContext.currentTime + 0.15);

    this.currentOscillators.push(osc);
    this.currentGains.push(gain);
  }

  /**
   * Ambient choir/ethereal sound
   */
  playAmbientChoir(duration: number = 5) {
    this.ensureResumed();
    console.log('AudioEngine: Playing Ambient Choir. State:', this.audioContext?.state);

    const frequencies = [110, 220, 330, 440, 550]; // Harmonics

    frequencies.forEach((freq) => {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, this.audioContext.currentTime);
      gain.gain.linearRampToValueAtTime(0.03, this.audioContext.currentTime + 1);
      gain.gain.linearRampToValueAtTime(0.03, this.audioContext.currentTime + duration - 1);
      gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(this.audioContext.currentTime);
      osc.stop(this.audioContext.currentTime + duration);

      this.currentOscillators.push(osc);
      this.currentGains.push(gain);
    });
  }

  /**
   * Silence (fade out all sounds)
   * Prevents scheduling conflicts by stopping active sounds rather than muting masterGain.
   */
  playSilence(duration: number = 1) {
    if (!this.audioContext) return;
    console.log('AudioEngine: playSilence called. Stopping all active sounds.');
    this.stopAll();
  }

  /**
   * Resume audio after silence
   * Restores master volume directly to avoid ramp glitches.
   */
  resumeAudio(duration: number = 1) {
    if (!this.audioContext) return;
    console.log('AudioEngine: resumeAudio called. Ensuring master gain is active.');
    this.masterGain.gain.value = 0.4;
  }

  /**
   * AI voice narration using browser SpeechSynthesis
   */
  speak(text: string) {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      console.log('AudioEngine: Narrating text: "', text.substring(0, 30) + '..."');
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();

      // Find a deep-sounding English speaking voice (Microsoft David, Google US English, Natural voices, etc.)
      const voice = voices.find(v => 
        v.lang.startsWith('en') && 
        (v.name.includes('Natural') || v.name.includes('David') || v.name.includes('Google'))
      ) || voices.find(v => v.lang.startsWith('en')) || voices[0];

      if (voice) {
        utterance.voice = voice;
      }

      utterance.pitch = 0.85; // Deep cinematic pitch
      utterance.rate = 0.88;  // Slightly slower, futuristic rate
      utterance.volume = 1.0;

      window.speechSynthesis.speak(utterance);
    } else {
      console.warn('AudioEngine: Speech synthesis is not supported in this browser.');
    }
  }

  /**
   * Stop all current sounds and narration
   */
  stopAll() {
    console.log('AudioEngine: Stopping all sounds and narration.');
    
    // Stop Speech
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    // Stop Oscillators
    this.currentOscillators.forEach((osc) => {
      try {
        osc.stop();
      } catch (e) {
        // Already stopped
      }
    });

    this.currentOscillators = [];
    this.currentGains = [];
  }

  /**
   * Set master volume
   */
  setVolume(volume: number) {
    this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
  }
}

// Export singleton instance
export const audioEngine = new AudioEngine();

// Auto-resume AudioContext on first user interaction (browser autoplay policy)
if (typeof window !== 'undefined') {
  const resumeAudio = () => {
    audioEngine.resumeContext().then(() => {
      if (audioEngine.audioContext && audioEngine.audioContext.state === 'running') {
        window.removeEventListener('click', resumeAudio);
        window.removeEventListener('keydown', resumeAudio);
        window.removeEventListener('touchstart', resumeAudio);
      }
    });
  };

  window.addEventListener('click', resumeAudio);
  window.addEventListener('keydown', resumeAudio);
  window.addEventListener('touchstart', resumeAudio);
}
