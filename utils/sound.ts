// Simple oscillator beep for audio feedback without external assets
export const playBeep = (duration: number = 200, frequency: number = 800, type: OscillatorType = 'sine') => {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;

  const audioCtx = new AudioContext();
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start();
  
  // Fade out to avoid clicking
  gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration / 1000);

  setTimeout(() => {
    oscillator.stop();
  }, duration);
};

export const playSuccessChime = () => {
  playBeep(100, 600, 'sine');
  setTimeout(() => playBeep(200, 1000, 'sine'), 100);
};