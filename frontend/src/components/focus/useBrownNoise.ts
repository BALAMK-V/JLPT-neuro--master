import { useEffect, useRef, useState } from "react";

type BrownNoiseController = {
  playing: boolean;
  start: () => Promise<void>;
  stop: () => void;
  setVolume: (v: number) => void;
};

export function useBrownNoise(initialVolume = 0.35): BrownNoiseController {
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const lastOutRef = useRef(0);
  const [playing, setPlaying] = useState(false);

  const stop = () => {
    try {
      nodeRef.current?.disconnect();
      gainRef.current?.disconnect();
      nodeRef.current = null;
      gainRef.current = null;
      if (ctxRef.current) {
        ctxRef.current.close();
      }
      ctxRef.current = null;
    } finally {
      setPlaying(false);
    }
  };

  const start = async () => {
    if (playing) return;

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx: AudioContext = new AudioCtx();
    await ctx.resume();

    const gain = ctx.createGain();
    gain.gain.value = initialVolume;

    // ScriptProcessorNode is deprecated but broadly supported and simplest for a no-file noise generator.
    const node = ctx.createScriptProcessor(4096, 1, 1);
    node.onaudioprocess = (e) => {
      const out = e.outputBuffer.getChannelData(0);
      let lastOut = lastOutRef.current;
      for (let i = 0; i < out.length; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.02 * white) / 1.02;
        out[i] = lastOut * 3.5; // normalize-ish
      }
      lastOutRef.current = lastOut;
    };

    node.connect(gain);
    gain.connect(ctx.destination);

    ctxRef.current = ctx;
    gainRef.current = gain;
    nodeRef.current = node;
    setPlaying(true);
  };

  const setVolume = (v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    if (gainRef.current) gainRef.current.gain.value = clamped;
  };

  useEffect(() => () => stop(), []);

  return { playing, start, stop, setVolume };
}

