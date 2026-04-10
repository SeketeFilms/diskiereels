// Sound effects hook for mobile interactions
const createAudioContext = () => {
  try {
    return new (window.AudioContext || (window as any).webkitAudioContext)();
  } catch {
    return null;
  }
};

let audioContext: AudioContext | null = null;

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = createAudioContext();
  }
  return audioContext;
};

// Play a beep/tone sound
const playTone = (frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.1) => {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    // Resume context if suspended (required for mobile)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;
    gainNode.gain.value = volume;

    // Fade out to avoid click
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch (error) {
    console.log('Sound effect failed:', error);
  }
};

export const useSoundEffects = () => {
  const playLikeSound = () => {
    // Two quick ascending tones for like - cheerful pop sound
    playTone(800, 0.08, 'sine', 0.08);
    setTimeout(() => playTone(1200, 0.12, 'sine', 0.06), 60);
  };

  const playSwipeSound = () => {
    // Quick swoosh sound
    playTone(300, 0.05, 'sine', 0.04);
  };

  const playSuccessSound = () => {
    // Pleasant success chime
    playTone(523, 0.1, 'sine', 0.06);
    setTimeout(() => playTone(659, 0.1, 'sine', 0.06), 80);
    setTimeout(() => playTone(784, 0.15, 'sine', 0.06), 160);
  };

  const playTapSound = () => {
    // Subtle tap feedback
    playTone(600, 0.03, 'sine', 0.03);
  };

  // Initialize audio context on first user interaction
  const initAudio = () => {
    const ctx = getAudioContext();
    if (ctx?.state === 'suspended') {
      ctx.resume();
    }
  };

  return { 
    playLikeSound, 
    playSwipeSound, 
    playSuccessSound, 
    playTapSound,
    initAudio 
  };
};
