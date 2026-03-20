import { useState, useRef, useCallback } from "react";
import AudioRecorder from "../stt/audio-recorder";

export default function useSpeechRecognition({
  onResult,
  isTtsSpeaking,
  micDeviceId,
}) {
  const [isListening, setIsListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recRef = useRef(null);
  const recorderRef = useRef(null);
  const whisperReadyRef = useRef(null); // null = unchecked

  const isWebSpeechSupported =
    typeof window !== "undefined" &&
    ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

  // Check if Whisper is available (cached)
  const checkWhisper = useCallback(async () => {
    if (whisperReadyRef.current !== null) return whisperReadyRef.current;
    try {
      const result = await window.blockyAPI?.checkSttReady();
      whisperReadyRef.current = result?.ready || false;
    } catch {
      whisperReadyRef.current = false;
    }
    return whisperReadyRef.current;
  }, []);

  const isSupported = isWebSpeechSupported || !!window.blockyAPI?.checkSttReady;

  // Invalidate Whisper cache (called after download)
  const refreshWhisperStatus = useCallback(() => {
    whisperReadyRef.current = null;
  }, []);

  // ─── Web Speech API path ───

  const startWebSpeech = useCallback(() => {
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
  }, [onResult]);

  // ─── Whisper path ───

  const startWhisper = useCallback(async () => {
    const recorder = new AudioRecorder();
    recorderRef.current = recorder;
    await recorder.start(micDeviceId);
    setIsListening(true);
  }, [micDeviceId]);

  const stopWhisper = useCallback(async () => {
    if (!recorderRef.current) return;

    const wavBuffer = recorderRef.current.stop();
    recorderRef.current = null;
    setIsListening(false);

    if (!wavBuffer) return;

    setIsTranscribing(true);
    setInterim("transcribing...");
    try {
      const text = await window.blockyAPI.transcribe(wavBuffer);
      setInterim("");
      setIsTranscribing(false);
      if (text && text.trim()) {
        onResult(text.trim());
      }
    } catch {
      setInterim("");
      setIsTranscribing(false);
    }
  }, [onResult]);

  // ─── Public API ───

  const start = useCallback(async () => {
    // Echo prevention — don't listen while Blocky is speaking
    if (isTtsSpeaking) return;
    if (isListening) return;

    // Prefer Web Speech API (real-time interim results)
    // Fall back to Whisper if Web Speech unavailable
    if (isWebSpeechSupported) {
      startWebSpeech();
    } else {
      const whisperOk = await checkWhisper();
      if (whisperOk) {
        await startWhisper();
      }
    }
  }, [
    isTtsSpeaking,
    isListening,
    isWebSpeechSupported,
    startWebSpeech,
    checkWhisper,
    startWhisper,
  ]);

  const stop = useCallback(async () => {
    if (recRef.current) {
      // Web Speech path
      recRef.current.stop();
      recRef.current = null;
      setIsListening(false);
      setInterim("");
    } else if (recorderRef.current) {
      // Whisper path — stop recording and transcribe
      await stopWhisper();
    } else {
      setIsListening(false);
      setInterim("");
    }
  }, [stopWhisper]);

  // Force use Whisper (even if Web Speech is available)
  const startWithWhisper = useCallback(async () => {
    if (isTtsSpeaking || isListening) return;
    const whisperOk = await checkWhisper();
    if (whisperOk) {
      await startWhisper();
    }
  }, [isTtsSpeaking, isListening, checkWhisper, startWhisper]);

  return {
    isListening,
    interim,
    isTranscribing,
    start,
    stop,
    startWithWhisper,
    isSupported,
    refreshWhisperStatus,
  };
}
