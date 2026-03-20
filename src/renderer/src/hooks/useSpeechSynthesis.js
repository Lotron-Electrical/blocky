import { useState, useRef, useCallback } from "react";
import PlaybackQueue from "../tts/playback-queue";
import SentenceChunker from "../tts/sentence-chunker";

const PRIORITY = { progress: 0, ack: 1, response: 2 };
const MAX_QUEUE = 3;
const INTER_UTTERANCE_DELAY = 50; // ms gap after cancel() for Windows/Chromium

const processText = (text) => {
  // Short responses — keep as-is
  if (text.length < 100) return text.trim();

  let cleaned = text;
  // Strip code blocks entirely (visual, not verbal)
  cleaned = cleaned.replace(/```[\s\S]*?```/g, "");
  // Strip inline code
  cleaned = cleaned.replace(/`[^`]+`/g, "");
  // Simplify file paths to just filename
  cleaned = cleaned.replace(/(?:[\w./\\-]+\/)+(\w[\w.-]*)/g, "$1");
  // Strip markdown headers
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, "");
  // Strip markdown bold/italic
  cleaned = cleaned.replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1");
  // Strip markdown links
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // Strip list markers
  cleaned = cleaned.replace(/^[\s]*[-*]\s+/gm, "");
  cleaned = cleaned.replace(/^[\s]*\d+\.\s+/gm, "");
  // Collapse whitespace
  cleaned = cleaned
    .replace(/\n{2,}/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ");

  // Truncate at 300 chars / 3 sentences
  if (cleaned.length > 300) {
    const sentences = cleaned.match(/[^.!?]+[.!?]+/g);
    if (sentences && sentences.length > 3) {
      cleaned =
        sentences.slice(0, 3).join("") + " Check the transcript for details.";
    } else if (cleaned.length > 300) {
      cleaned = cleaned.slice(0, 297) + "... Check the transcript for details.";
    }
  }
  return cleaned.trim();
};

export default function useSpeechSynthesis({ onStart, onEnd }) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const amplitudeRef = useRef(0);
  const piperReadyRef = useRef(null); // null = unchecked, true/false
  const playbackRef = useRef(null);

  // Web Speech fallback refs
  const wsQueueRef = useRef([]);
  const wsActiveRef = useRef(null);
  const wsProcessingRef = useRef(false);

  // Get or create PlaybackQueue (Piper path)
  const getPlayback = useCallback(() => {
    if (!playbackRef.current) {
      playbackRef.current = new PlaybackQueue({
        onStart: () => {
          setIsSpeaking(true);
          onStart?.();
        },
        onEnd: () => {
          setIsSpeaking(false);
          amplitudeRef.current = 0;
          onEnd?.();
        },
        onAmplitude: (a) => {
          amplitudeRef.current = a;
        },
      });
    }
    return playbackRef.current;
  }, [onStart, onEnd]);

  // Check if Piper is available (cached after first check)
  const isPiperReady = useCallback(async () => {
    if (piperReadyRef.current !== null) return piperReadyRef.current;
    try {
      const result = await window.blockyAPI?.checkTtsReady();
      piperReadyRef.current = result?.ready || false;
    } catch {
      piperReadyRef.current = false;
    }
    return piperReadyRef.current;
  }, []);

  // Invalidate Piper cache (called after download completes)
  const refreshPiperStatus = useCallback(() => {
    piperReadyRef.current = null;
  }, []);

  // ─── Piper synthesis path ───

  const piperSpeak = useCallback(
    async (text) => {
      const pb = getPlayback();
      try {
        const pcm = await window.blockyAPI.synthesize(text);
        pb.enqueue(pcm);
      } catch {
        // Piper failed — fall back to Web Speech for this utterance
        webSpeechSpeak(text);
      }
    },
    [getPlayback],
  );

  const piperSpeakChunked = useCallback(
    (text) => {
      const chunker = new SentenceChunker((sentence) => {
        piperSpeak(sentence);
      });
      chunker.push(text);
      chunker.flush();
    },
    [piperSpeak],
  );

  const piperStop = useCallback(() => {
    getPlayback().clear();
    setIsSpeaking(false);
    amplitudeRef.current = 0;
    onEnd?.();
  }, [getPlayback, onEnd]);

  // ─── Web Speech fallback path (original logic) ───

  const wsProcessQueue = useCallback(() => {
    if (wsProcessingRef.current) return;
    if (!window.speechSynthesis) return;
    if (wsQueueRef.current.length === 0) {
      setIsSpeaking(false);
      wsActiveRef.current = null;
      onEnd?.();
      return;
    }

    wsProcessingRef.current = true;
    const item = wsQueueRef.current.shift();

    const utt = new SpeechSynthesisUtterance(item.text);
    utt.rate = 1.05;
    utt.pitch = 1.0;

    utt.onstart = () => {
      setIsSpeaking(true);
      onStart?.();
    };
    utt.onend = () => {
      wsProcessingRef.current = false;
      wsActiveRef.current = null;
      wsProcessQueue();
    };
    utt.onerror = () => {
      wsProcessingRef.current = false;
      wsActiveRef.current = null;
      wsProcessQueue();
    };

    wsActiveRef.current = item;
    window.speechSynthesis.speak(utt);
  }, [onStart, onEnd]);

  const webSpeechSpeak = useCallback(
    (text) => {
      if (!window.speechSynthesis || !text) return;
      wsQueueRef.current.push({ text, priority: PRIORITY.response });
      if (!wsActiveRef.current && !wsProcessingRef.current) {
        setTimeout(() => wsProcessQueue(), INTER_UTTERANCE_DELAY);
      }
    },
    [wsProcessQueue],
  );

  const wsEnqueue = useCallback(
    (text, priority) => {
      if (isMuted || !window.speechSynthesis || !text) return;

      const item = { text, priority };

      if (priority === PRIORITY.response) {
        window.speechSynthesis.cancel();
        wsQueueRef.current = [];
        wsProcessingRef.current = false;
        wsActiveRef.current = null;
        wsQueueRef.current.push(item);
        setTimeout(() => wsProcessQueue(), INTER_UTTERANCE_DELAY);
        return;
      }

      if (priority === PRIORITY.ack) {
        if (
          wsActiveRef.current &&
          wsActiveRef.current.priority === PRIORITY.progress
        ) {
          window.speechSynthesis.cancel();
          wsProcessingRef.current = false;
          wsActiveRef.current = null;
        }
        wsQueueRef.current.push(item);
        while (wsQueueRef.current.length > MAX_QUEUE) {
          const idx = wsQueueRef.current.findIndex(
            (q) => q.priority === PRIORITY.progress,
          );
          if (idx >= 0) wsQueueRef.current.splice(idx, 1);
          else wsQueueRef.current.shift();
        }
        if (!wsActiveRef.current) {
          setTimeout(() => wsProcessQueue(), INTER_UTTERANCE_DELAY);
        }
        return;
      }

      if (wsQueueRef.current.length >= 2) return;
      wsQueueRef.current.push(item);
      while (wsQueueRef.current.length > MAX_QUEUE) {
        const idx = wsQueueRef.current.findIndex(
          (q) => q.priority === PRIORITY.progress,
        );
        if (idx >= 0) wsQueueRef.current.splice(idx, 1);
        else wsQueueRef.current.shift();
      }
      if (!wsActiveRef.current && !wsProcessingRef.current) {
        setTimeout(() => wsProcessQueue(), INTER_UTTERANCE_DELAY);
      }
    },
    [isMuted, wsProcessQueue],
  );

  const wsStop = useCallback(() => {
    window.speechSynthesis?.cancel();
    wsQueueRef.current = [];
    wsProcessingRef.current = false;
    setIsSpeaking(false);
    wsActiveRef.current = null;
    onEnd?.();
  }, [onEnd]);

  // ─── Public API (same surface as before) ───

  // High priority — final Claude response
  const speak = useCallback(
    async (text) => {
      if (isMuted) return;
      const processed = processText(text);
      if (!processed) return;

      const piper = await isPiperReady();
      if (piper) {
        // Cancel any current Piper playback
        getPlayback().clear();
        piperSpeakChunked(processed);
      } else {
        wsEnqueue(processed, PRIORITY.response);
      }
    },
    [isMuted, isPiperReady, getPlayback, piperSpeakChunked, wsEnqueue],
  );

  // Medium priority — acknowledge user input
  const speakAck = useCallback(
    async (text) => {
      if (isMuted || !text) return;

      const piper = await isPiperReady();
      if (piper) {
        piperSpeak(text);
      } else {
        wsEnqueue(text, PRIORITY.ack);
      }
    },
    [isMuted, isPiperReady, piperSpeak, wsEnqueue],
  );

  // Low priority — narrate progress
  const speakProgress = useCallback(
    async (text) => {
      if (isMuted || !text) return;

      const piper = await isPiperReady();
      if (piper) {
        piperSpeak(text);
      } else {
        wsEnqueue(text, PRIORITY.progress);
      }
    },
    [isMuted, isPiperReady, piperSpeak, wsEnqueue],
  );

  const stopSpeaking = useCallback(async () => {
    const piper = await isPiperReady();
    if (piper) {
      piperStop();
    } else {
      wsStop();
    }
  }, [isPiperReady, piperStop, wsStop]);

  const toggleMute = useCallback(() => {
    setIsMuted((m) => {
      if (!m) {
        // Muting — stop everything
        getPlayback().clear();
        window.speechSynthesis?.cancel();
        wsQueueRef.current = [];
        wsProcessingRef.current = false;
        setIsSpeaking(false);
        wsActiveRef.current = null;
        amplitudeRef.current = 0;
      }
      return !m;
    });
  }, [getPlayback]);

  return {
    isSpeaking,
    speak,
    speakAck,
    speakProgress,
    stop: stopSpeaking,
    isMuted,
    toggleMute,
    amplitude: amplitudeRef,
    refreshPiperStatus,
  };
}
