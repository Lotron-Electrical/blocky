import { useState, useRef, useCallback } from "react";

export default function useSpeechSynthesis({ onStart, onEnd }) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const uttRef = useRef(null);

  const processText = (text) => {
    // Strip code blocks
    let cleaned = text.replace(/```[\s\S]*?```/g, "... here's some code ...");
    // Strip inline code
    cleaned = cleaned.replace(/`[^`]+`/g, "");
    // Strip markdown headers
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, "");
    // Strip markdown bold/italic
    cleaned = cleaned.replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1");
    // Strip markdown links
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    // For long responses, take first ~3 sentences
    if (cleaned.length > 500) {
      const sentences = cleaned.match(/[^.!?]+[.!?]+/g);
      if (sentences && sentences.length > 3) {
        cleaned = sentences.slice(0, 3).join("") + " ...and more.";
      }
    }
    return cleaned.trim();
  };

  const speak = useCallback(
    (text) => {
      if (isMuted || !window.speechSynthesis) return;

      // Cancel any current speech
      window.speechSynthesis.cancel();

      const processed = processText(text);
      if (!processed) return;

      const utt = new SpeechSynthesisUtterance(processed);
      utt.rate = 1.05;
      utt.pitch = 1.0;

      utt.onstart = () => {
        setIsSpeaking(true);
        onStart?.();
      };
      utt.onend = () => {
        setIsSpeaking(false);
        uttRef.current = null;
        onEnd?.();
      };
      utt.onerror = () => {
        setIsSpeaking(false);
        uttRef.current = null;
        onEnd?.();
      };

      uttRef.current = utt;
      window.speechSynthesis.speak(utt);
    },
    [isMuted, onStart, onEnd],
  );

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    uttRef.current = null;
    onEnd?.();
  }, [onEnd]);

  const toggleMute = useCallback(() => {
    setIsMuted((m) => {
      if (!m) {
        // Muting — stop any current speech
        window.speechSynthesis?.cancel();
        setIsSpeaking(false);
        uttRef.current = null;
      }
      return !m;
    });
  }, []);

  return { isSpeaking, speak, stop: stopSpeaking, isMuted, toggleMute };
}
