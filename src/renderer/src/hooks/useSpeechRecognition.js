import { useState, useRef, useCallback } from "react";

export default function useSpeechRecognition({ onResult }) {
  const [isListening, setIsListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef(null);

  const isSupported =
    typeof window !== "undefined" &&
    ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

  const start = useCallback(() => {
    if (!isSupported || isListening) return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }
      if (finalText) {
        setInterim("");
        setIsListening(false);
        recRef.current = null;
        onResult(finalText.trim());
      } else {
        setInterim(interimText);
      }
    };

    rec.onerror = () => {
      setIsListening(false);
      setInterim("");
      recRef.current = null;
    };

    rec.onend = () => {
      setIsListening(false);
      setInterim("");
      recRef.current = null;
    };

    recRef.current = rec;
    rec.start();
    setIsListening(true);
  }, [isSupported, isListening, onResult]);

  const stop = useCallback(() => {
    if (recRef.current) {
      recRef.current.stop();
      recRef.current = null;
    }
    setIsListening(false);
    setInterim("");
  }, []);

  return { isListening, interim, start, stop, isSupported };
}
