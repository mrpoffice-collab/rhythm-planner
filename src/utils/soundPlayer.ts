import { SoundPack, db } from '../db/database';

type SoundCue = 'focus-start' | '5min-warning' | 'break-start' | 'segment-end' | 'plan-complete';

let audioContext: AudioContext | null = null;
let audioUnlocked = false;

/**
 * Initialize audio context after user gesture
 */
export const unlockAudio = async (): Promise<boolean> => {
  if (audioUnlocked) return true;

  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    // Play silent sound to unlock
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0;
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.01);

    audioUnlocked = true;
    console.log('SOUND audio unlocked');
    return true;
  } catch (error) {
    console.error('Failed to unlock audio:', error);
    return false;
  }
};

/**
 * Get frequency and duration for sound pack and cue
 */
const getSoundParams = (pack: SoundPack, cue: SoundCue): { freq: number[]; duration: number } => {
  switch (pack) {
    case 'Chime':
      switch (cue) {
        case 'focus-start':
          return { freq: [523.25, 659.25], duration: 0.4 }; // C5 -> E5
        case '5min-warning':
          return { freq: [440, 554.37], duration: 0.3 }; // A4 -> C#5
        case 'break-start':
          return { freq: [392, 493.88], duration: 0.4 }; // G4 -> B4
        case 'segment-end':
          return { freq: [587.33], duration: 0.3 }; // D5
        case 'plan-complete':
          return { freq: [523.25, 659.25, 783.99], duration: 0.5 }; // C5 -> E5 -> G5
      }
      break;

    case 'Bell':
      switch (cue) {
        case 'focus-start':
          return { freq: [698.46, 830.61], duration: 0.5 }; // F5 -> G#5
        case '5min-warning':
          return { freq: [587.33, 698.46], duration: 0.4 }; // D5 -> F5
        case 'break-start':
          return { freq: [523.25, 622.25], duration: 0.5 }; // C5 -> D#5
        case 'segment-end':
          return { freq: [698.46], duration: 0.4 }; // F5
        case 'plan-complete':
          return { freq: [698.46, 830.61, 987.77], duration: 0.6 }; // F5 -> G#5 -> B5
      }
      break;

    case 'Pop':
      switch (cue) {
        case 'focus-start':
          return { freq: [800, 1200], duration: 0.1 }; // Short pop
        case '5min-warning':
          return { freq: [1000, 1400], duration: 0.1 };
        case 'break-start':
          return { freq: [600, 900], duration: 0.1 };
        case 'segment-end':
          return { freq: [1200], duration: 0.1 };
        case 'plan-complete':
          return { freq: [800, 1200, 1600], duration: 0.15 };
      }
      break;
  }
};

/**
 * Play a sound cue with user preferences
 */
export const playSound = async (cue: SoundCue): Promise<void> => {
  try {
    const prefs = await db.userPrefs.get(1);
    if (!prefs || !prefs.timerSoundsEnabled || prefs.timerVolume === 0) {
      return;
    }

    if (!audioUnlocked) {
      console.warn('Audio not unlocked yet. Call unlockAudio() first.');
      return;
    }

    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const params = getSoundParams(prefs.timerSoundPack, cue);
    if (!params) return;

    const volume = prefs.timerVolume / 100;
    const now = audioContext.currentTime;

    // Play sequence of tones
    for (let i = 0; i < params.freq.length; i++) {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = prefs.timerSoundPack === 'Pop' ? 'square' : 'sine';
      oscillator.frequency.value = params.freq[i];

      gainNode.gain.setValueAtTime(volume * 0.3, now + i * 0.15);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + params.duration);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start(now + i * 0.15);
      oscillator.stop(now + i * 0.15 + params.duration);
    }

    console.log(`SOUND cue:${cue} played`);
  } catch (error) {
    console.error('Error playing sound:', error);
  }
};

/**
 * Show toast if audio is blocked
 */
export const checkAudioAndPrompt = (): boolean => {
  if (!audioUnlocked) {
    // Show toast or prompt user to enable sounds
    const event = new CustomEvent('audio-blocked');
    window.dispatchEvent(event);
    return false;
  }
  return true;
};
