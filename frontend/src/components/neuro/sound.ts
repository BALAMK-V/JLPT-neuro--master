let audioContext: AudioContext | null = null;

function ctx() {
  audioContext ??= new AudioContext();
  return audioContext;
}

function tone(frequency: number, duration: number, type: OscillatorType, gain = 0.035) {
  try {
    const context = ctx();
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    envelope.gain.setValueAtTime(0.0001, context.currentTime);
    envelope.gain.exponentialRampToValueAtTime(gain, context.currentTime + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(envelope);
    envelope.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration + 0.02);
  } catch {
    // Sound cues are progressive enhancement.
  }
}

export const neuroSounds = {
  tick() {
    tone(680, 0.07, "sine", 0.025);
  },
  whoosh() {
    tone(240, 0.16, "triangle", 0.02);
    setTimeout(() => tone(420, 0.12, "triangle", 0.018), 40);
  },
  chime() {
    tone(520, 0.14, "sine", 0.026);
    setTimeout(() => tone(780, 0.18, "sine", 0.024), 95);
  },
};
