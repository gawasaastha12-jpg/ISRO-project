/**
 * Immersive Audio Engine for Cosmic Intelligence Platform
 * 
 * Features:
 * - Procedural sound generation (bass rumbles, whooshes, crackles)
 * - Spatial audio with panning
 * - Doppler effect simulation
 * - Ambient soundscapes
 * - Sound design cues for each scene
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
    this.masterGain.gain.value = 0.8; // Start at 80% volume
    this.masterGain.connect(audioContext.destination);

    console.log('AudioEngine: Initialized. Context state:', audioContext.state);
  }

  /**
   * Helper to ensure AudioContext is resumed before playing sounds
   */
  private ensureResumed() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().then(() => {
        console.log('AudioEngine: Context auto-resumed on play call. State:', this.audioContext.state);
      }).catch((err) => {
        console.warn('AudioEngine: Context is suspended and could not be resumed automatically.', err);
      });
    }
  }

  /**
   * Explicitly resumes the AudioContext if it was suspended.
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
   * Deep bass rumble for awe moments
   */
  /**
   * Deep bass rumble for awe moments
   * Ramps from 75Hz -> 45Hz at 0.75 gain for laptop speaker audibility.
   */
  playDeepBassRumble(duration: number = 3) {
    this.ensureResumed();
    console.log('AudioEngine: Playing Deep Bass Rumble. State:', this.audioContext?.state);

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(75, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(45, this.audioContext.currentTime + duration);

    gain.gain.setValueAtTime(0.75, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, this.audioContext.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(this.audioContext.currentTime);
    osc.stop(this.audioContext.currentTime + duration);

    this.currentOscillators.push(osc);
    this.currentGains.push(gain);
  }

  playRumble(duration: number = 3) {
    this.playDeepBassRumble(duration);
  }

  /**
   * Cosmic explosion sound
   * Boosted white noise burst with 0.9 gain.
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
    filter.frequency.setValueAtTime(300, this.audioContext.currentTime);
    filter.frequency.exponentialRampToValueAtTime(5000, this.audioContext.currentTime + 0.5);

    gain.gain.setValueAtTime(0.9, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    source.start(this.audioContext.currentTime);
    source.stop(this.audioContext.currentTime + duration);

    this.currentGains.push(gain);
  }

  /**
   * Wormhole whoosh with Doppler effect
   * frequency shifts from 880Hz -> 440Hz -> 220Hz at 0.85 gain.
   */
  playWormholeWhoosh(duration: number = 1.5) {
    this.ensureResumed();
    console.log('AudioEngine: Playing Wormhole Whoosh. State:', this.audioContext?.state);

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'sine';
    // Doppler effect: frequency shifts from high to low
    osc.frequency.setValueAtTime(880, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, this.audioContext.currentTime + duration * 0.7);
    osc.frequency.exponentialRampToValueAtTime(220, this.audioContext.currentTime + duration);

    gain.gain.setValueAtTime(0.85, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, this.audioContext.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(this.audioContext.currentTime);
    osc.stop(this.audioContext.currentTime + duration);

    this.currentOscillators.push(osc);
    this.currentGains.push(gain);
  }

  /**
   * Solar flare crackle
   * Denser crackle at 0.65 gain.
   */
  playFlareCrackle() {
    this.ensureResumed();
    console.log('AudioEngine: Playing Flare Crackle. State:', this.audioContext?.state);

    const bufferSize = this.audioContext.sampleRate * 0.3;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    // Sparse crackle pattern
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() > 0.82 ? (Math.random() * 2 - 1) * 0.5 : 0;
    }

    const source = this.audioContext.createBufferSource();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    source.buffer = buffer;
    filter.type = 'highpass';
    filter.frequency.value = 3000;

    gain.gain.setValueAtTime(0.65, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    source.start(this.audioContext.currentTime);
    source.stop(this.audioContext.currentTime + 0.3);

    this.currentGains.push(gain);
  }

  /**
   * Ambient space hum
   * Configured at 110Hz and 220Hz at 0.35/0.18 gain.
   */
  playAmbientHum(duration: number = 5) {
    this.ensureResumed();
    console.log('AudioEngine: Playing Ambient Hum. State:', this.audioContext?.state);

    const osc1 = this.audioContext.createOscillator();
    const gain1 = this.audioContext.createGain();
    osc1.type = 'sine';
    osc1.frequency.value = 110; // Low frequency hum

    const osc2 = this.audioContext.createOscillator();
    const gain2 = this.audioContext.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = 220; // Harmonic for laptop speakers

    gain1.gain.setValueAtTime(0, this.audioContext.currentTime);
    gain1.gain.linearRampToValueAtTime(0.35, this.audioContext.currentTime + 0.5);
    gain1.gain.linearRampToValueAtTime(0.35, this.audioContext.currentTime + duration - 0.5);
    gain1.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration);

    gain2.gain.setValueAtTime(0, this.audioContext.currentTime);
    gain2.gain.linearRampToValueAtTime(0.18, this.audioContext.currentTime + 0.5);
    gain2.gain.linearRampToValueAtTime(0.18, this.audioContext.currentTime + duration - 0.5);
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
   * Ramps from 350Hz -> 120Hz at 0.8 gain.
   */
  playCollisionImpact() {
    this.ensureResumed();
    console.log('AudioEngine: Playing Collision Impact. State:', this.audioContext?.state);

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(350, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, this.audioContext.currentTime + 0.1);

    gain.gain.setValueAtTime(0.8, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(this.audioContext.currentTime);
    osc.stop(this.audioContext.currentTime + 0.1);

    this.currentOscillators.push(osc);
    this.currentGains.push(gain);
  }

  /**
   * Ambient choir/ethereal sound
   * Each harmonic boosted to 0.12 gain.
   */
  playAmbientChoir(duration: number = 5) {
    this.ensureResumed();
    console.log('AudioEngine: Playing Ambient Choir. State:', this.audioContext?.state);

    const frequencies = [110, 220, 330, 440, 550]; // A notes

    frequencies.forEach((freq) => {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, this.audioContext.currentTime);
      gain.gain.linearRampToValueAtTime(0.12, this.audioContext.currentTime + 1);
      gain.gain.linearRampToValueAtTime(0.12, this.audioContext.currentTime + duration - 1);
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
   */
  playSilence(duration: number = 1) {
    if (!this.audioContext) return;
    console.log('AudioEngine: playSilence called. Setting master gain to 0.');
    this.masterGain.gain.cancelScheduledValues(this.audioContext.currentTime);
    this.masterGain.gain.value = 0;
  }

  /**
   * Resume audio after silence
   */
  resumeAudio(duration: number = 1) {
    if (!this.audioContext) return;
    this.ensureResumed();
    console.log('AudioEngine: resumeAudio called. Setting master gain to 0.8.');
    this.masterGain.gain.cancelScheduledValues(this.audioContext.currentTime);
    this.masterGain.gain.value = 0.8;
  }

  /**
   * AI voice narration using browser SpeechSynthesis
   */
  speak(text: string) {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      console.log('AudioEngine: Narrating text: "', text.substring(0, 30) + '..."');
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();

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
   * Stop all current sounds and speech narration
   */
  stopAll() {
    console.log('AudioEngine: Stopping all active sounds and speech.');
    
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

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
    if (audioEngine.audioContext && audioEngine.audioContext.state === 'suspended') {
      audioEngine.audioContext.resume().then(() => {
        console.log('AudioEngine: Context resumed on interaction');
      }).catch((err) => {
        console.warn('AudioEngine: Failed to resume on user interaction:', err);
      });
    }
  };
  window.addEventListener('click', resumeAudio);
  window.addEventListener('keydown', resumeAudio);
  window.addEventListener('touchstart', resumeAudio);
}
