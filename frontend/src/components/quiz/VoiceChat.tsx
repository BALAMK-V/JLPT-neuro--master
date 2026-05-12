import { useCallback, useEffect, useRef, useState } from "react";

interface VoiceChatProps {
  userId: number | null;
  onSendSignaling: (action: string, data: Record<string, unknown>) => void;
  incomingSignaling: {
    type: "voice_offer" | "voice_answer" | "voice_ice" | "voice_mute";
    from: number | null;
    from_name: string;
    sdp?: string;
    candidate?: string;
    muted?: boolean;
  } | null;
  roomCode: string;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function VoiceChat({
  userId,
  onSendSignaling,
  incomingSignaling,
}: VoiceChatProps) {
  const [enabled, setEnabled] = useState(false);
  const [muted, setMuted] = useState(true);
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set());

  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStream = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);

  // Cleanup
  useEffect(() => {
    return () => {
      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();
      localStream.current?.getTracks().forEach((t) => t.stop());
      cancelAnimationFrame(rafRef.current);
      audioContextRef.current?.close();
    };
  }, []);

  // Handle incoming signaling
  useEffect(() => {
    if (!incomingSignaling || !enabled) return;

    const { type, from, sdp, candidate } = incomingSignaling;
    if (from === userId) return;
    const peerKey = `peer_${from}`;

    if (type === "voice_offer") {
      handleOffer(peerKey, from!, sdp!);
    } else if (type === "voice_answer") {
      handleAnswer(peerKey, sdp!);
    } else if (type === "voice_ice") {
      handleIce(peerKey, candidate!);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingSignaling, enabled]);

  const ensureStream = useCallback(async () => {
    if (localStream.current) return localStream.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStream.current = stream;

      // Set up audio analysis for speaking detection
      audioContextRef.current = new AudioContext();
      const src = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      src.connect(analyserRef.current);

      return stream;
    } catch {
      return null;
    }
  }, []);

  const getOrCreatePeer = useCallback(
    async (peerKey: string) => {
      if (peerConnections.current.has(peerKey)) {
        return peerConnections.current.get(peerKey)!;
      }
      const stream = await ensureStream();
      if (!stream) return null;

      const pc = new RTCPeerConnection(ICE_SERVERS);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      peerConnections.current.set(peerKey, pc);

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          onSendSignaling("voice_ice", { candidate: JSON.stringify(e.candidate) });
        }
      };

      pc.ontrack = (e) => {
        // Remote audio is played automatically via <audio> element
      };

      return pc;
    },
    [ensureStream, onSendSignaling]
  );

  const handleOffer = async (peerKey: string, fromId: number, sdpStr: string) => {
    const pc = await getOrCreatePeer(peerKey);
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sdpStr)));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    onSendSignaling("voice_answer", { sdp: JSON.stringify(pc.localDescription) });
  };

  const handleAnswer = async (peerKey: string, sdpStr: string) => {
    const pc = peerConnections.current.get(peerKey);
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sdpStr)));
  };

  const handleIce = async (peerKey: string, candidateStr: string) => {
    const pc = peerConnections.current.get(peerKey);
    if (!pc) return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(candidateStr)));
    } catch {
      // ignore
    }
  };

  const toggleVoice = useCallback(async () => {
    if (enabled) {
      // Disable
      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();
      localStream.current?.getTracks().forEach((t) => t.stop());
      localStream.current = null;
      audioContextRef.current?.close();
      audioContextRef.current = null;
      cancelAnimationFrame(rafRef.current);
      setEnabled(false);
      setMuted(true);
      return;
    }

    // Enable
    const stream = await ensureStream();
    if (!stream) {
      return;
    }
    setMuted(false);
    setEnabled(true);

    // Create peer connections for existing players
    // (offers will be triggered when new peers join)
  }, [enabled, ensureStream]);

  const toggleMute = useCallback(() => {
    const newMuted = !muted;
    setMuted(newMuted);
    localStream.current?.getAudioTracks().forEach((t) => {
      t.enabled = !newMuted;
    });
    onSendSignaling("voice_mute", { muted: newMuted });
  }, [muted, onSendSignaling]);

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button
        className="btn"
        onClick={toggleVoice}
        style={{
          fontSize: 13,
          padding: "4px 10px",
          background: enabled ? "rgba(36,209,143,0.2)" : undefined,
          color: enabled ? "var(--good)" : undefined,
        }}
        title={enabled ? "Disable voice chat" : "Enable voice chat"}
      >
        {enabled ? "🎙️ On" : "🎤 Off"}
      </button>
      {enabled && (
        <button
          className="btn"
          onClick={toggleMute}
          style={{
            fontSize: 13,
            padding: "4px 10px",
            color: muted ? "var(--bad)" : "var(--good)",
          }}
          title={muted ? "Unmute" : "Mute"}
        >
          {muted ? "🔇 Muted" : "🔊 Live"}
        </button>
      )}
    </div>
  );
}
