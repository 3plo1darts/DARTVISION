
// Semplice oscillatore per feedback audio senza asset esterni
export const playBeep = (duration: number = 200, frequency: number = 800, type: OscillatorType = 'sine', volume: number = 0.1) => {
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
  
  // Fade out per evitare clic udibili
  gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration / 1000);

  setTimeout(() => {
    oscillator.stop();
    audioCtx.close();
  }, duration + 100);
};

export const playSuccessChime = () => {
  playBeep(100, 600, 'sine');
  setTimeout(() => playBeep(200, 1000, 'sine'), 100);
};

export const playDartBlip = () => {
  // Suono "cyber" molto corto e sottile
  playBeep(50, 1800, 'sine', 0.05);
};
