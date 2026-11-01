import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface InlineVoiceIndicatorProps {
  isRecording: boolean;
  onStopRecording: () => void;
  onTranscription: (text: string) => void;
  onError: (description: string) => void;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  readonly error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const InlineVoiceIndicator = ({
  isRecording,
  onStopRecording,
  onTranscription,
  onError,
}: InlineVoiceIndicatorProps) => {
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onStopRecordingRef = useRef(onStopRecording);
  const onTranscriptionRef = useRef(onTranscription);
  const onErrorRef = useRef(onError);

  onStopRecordingRef.current = onStopRecording;
  onTranscriptionRef.current = onTranscription;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!isRecording) return;

    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      onErrorRef.current("Speech recognition is not supported in this browser.");
      onStopRecordingRef.current();
      return;
    }

    let cancelled = false;

    const startRecording = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone access is not available in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      analyserRef.current = audioContext.createAnalyser();
      analyserRef.current.fftSize = 256;
      audioContext.createMediaStreamSource(stream).connect(analyserRef.current);
      analyzeAudio();

      const recognition = new Recognition();
      recognitionRef.current = recognition;
      recognition.lang = navigator.language || "en-US";
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.onresult = (event) => {
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (result.isFinal) {
            const transcript = result[0].transcript.trim();
            if (transcript) onTranscriptionRef.current(transcript);
          }
        }
      };
      recognition.onerror = (event) => {
        const messages: Record<string, string> = {
          "not-allowed": "Allow microphone access in your browser to use voice input.",
          "service-not-allowed": "The browser speech recognition service is unavailable.",
          "no-speech": "No speech was detected. Try again.",
          network: "Speech recognition could not connect. Check your internet connection.",
        };
        onErrorRef.current(messages[event.error] || "Speech recognition stopped unexpectedly.");
        onStopRecordingRef.current();
      };
      recognition.onend = () => onStopRecordingRef.current();
      recognition.start();
    };

    const analyzeAudio = () => {
      if (!analyserRef.current) return;

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        setAudioLevel(Math.min(average / 128, 1));
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    };

    void startRecording().catch((error: unknown) => {
      if (cancelled) return;
      const description =
        error instanceof Error ? error.message : "Unable to start voice input.";
      onErrorRef.current(description);
      onStopRecordingRef.current();
    });

    return () => {
      cancelled = true;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
      analyserRef.current = null;
      setAudioLevel(0);
    };
  }, [isRecording]);

  const baseRippleSize = 64;
  const ripple1Size = baseRippleSize + audioLevel * 35;
  const ripple2Size = baseRippleSize + 18 + audioLevel * 45;
  const ripple3Size = baseRippleSize + 36 + audioLevel * 55;
  const ripple4Size = ripple3Size;

  return (
    <AnimatePresence>
      {isRecording && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          className="flex items-center justify-center pt-8 w-full"
        >
          <div className="relative flex items-center justify-center">
            <motion.div
              className="absolute rounded-full border-2 border-primary"
              animate={{ width: ripple4Size, height: ripple4Size }}
              transition={{ type: "spring", stiffness: 250, damping: 20 }}
              style={{ opacity: 0.15 + audioLevel * 0.1 }}
            />
            <motion.div
              className="absolute rounded-full bg-white"
              animate={{ width: ripple3Size, height: ripple3Size }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              style={{ opacity: 0.3 + audioLevel * 0.2 }}
            />
            <motion.div
              className="absolute rounded-full bg-primary/30"
              animate={{ width: ripple2Size, height: ripple2Size }}
              transition={{ type: "spring", stiffness: 350, damping: 20 }}
              style={{ opacity: 0.4 + audioLevel * 0.3 }}
            />
            <motion.div
              className="absolute rounded-full bg-white"
              animate={{ width: ripple1Size, height: ripple1Size }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              style={{ opacity: 0.5 + audioLevel * 0.3 }}
            />
            <motion.button
              type="button"
              onClick={onStopRecording}
              aria-label="Stop voice input"
              className="relative z-10 w-10 h-10 rounded-full bg-budget-red flex items-center justify-center shadow-lg"
              whileTap={{ scale: 0.95 }}
              animate={{ scale: 1 + audioLevel * 0.1 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <img
                src="/assets/All Icon Used/white mic.png"
                alt=""
                className="h-4 w-4 object-contain"
                style={{ filter: "brightness(0) invert(1)" }}
              />
            </motion.button>
          </div>
          <span className="sr-only" role="status" aria-live="polite">
            Listening for speech
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InlineVoiceIndicator;
