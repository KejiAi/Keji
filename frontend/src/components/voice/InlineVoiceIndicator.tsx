import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface InlineVoiceIndicatorProps {
  isRecording: boolean;
  onStopRecording: () => void;
  onTranscription: (text: string) => void;
}

const InlineVoiceIndicator = ({
  isRecording,
  onStopRecording,
  onTranscription,
}: InlineVoiceIndicatorProps) => {
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (isRecording) {
      startRecording();
    } else {
      stopRecording();
    }

    return () => {
      cleanup();
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      streamRef.current = stream;

      // Set up audio analysis for visualizing audio levels
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      // Start analyzing audio levels
      analyzeAudio();

      // Set up media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        // Here you would typically send to a speech-to-text API
        await handleTranscription(audioBlob);
      };

      mediaRecorder.start(100); // Collect data every 100ms
    } catch (error) {
      console.error("Error accessing microphone:", error);
      onStopRecording();
    }
  };

  const analyzeAudio = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const updateLevel = () => {
      if (!analyserRef.current || !isRecording) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      const normalizedLevel = Math.min(average / 128, 1); // Normalize to 0-1
      
      setAudioLevel(normalizedLevel);
      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };

    updateLevel();
  };

  const handleTranscription = async (audioBlob: Blob) => {
    // Placeholder for actual transcription
    // In production, you would send this to a speech-to-text API
    // Don't call onTranscription with placeholder text - wait for real transcription
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const cleanup = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  };

  // Calculate ripple sizes based on audio level (compact version)
  const baseRippleSize = 64;
  const ripple1Size = baseRippleSize + audioLevel * 35;
  const ripple2Size = baseRippleSize + 18 + audioLevel * 45;
  const ripple3Size = baseRippleSize + 36 + audioLevel * 55;
  const ripple4Size = ripple3Size; // Same size as ripple 3

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
          {/* Ripple effect container - centered */}
          <div className="relative flex items-center justify-center">
            {/* Outermost ripple 4 - slim ring, dimmer */}
            <motion.div
              className="absolute rounded-full border-2 border-primary"
              animate={{
                width: ripple4Size,
                height: ripple4Size,
              }}
              transition={{ type: "spring", stiffness: 250, damping: 20 }}
              style={{
                opacity: 0.15 + audioLevel * 0.1,
              }}
            />
            
            {/* Outer ripple 3 */}
            <motion.div
              className="absolute rounded-full bg-white"
              animate={{
                width: ripple3Size,
                height: ripple3Size,
              }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              style={{
                opacity: 0.3 + audioLevel * 0.2,
              }}
            />
            
            {/* Middle ripple 2 */}
            <motion.div
              className="absolute rounded-full bg-primary/30"
              animate={{
                width: ripple2Size,
                height: ripple2Size,
              }}
              transition={{ type: "spring", stiffness: 350, damping: 20 }}
              style={{
                opacity: 0.4 + audioLevel * 0.3,
              }}
            />
            
            {/* Inner ripple 1 */}
            <motion.div
              className="absolute rounded-full bg-white"
              animate={{
                width: ripple1Size,
                height: ripple1Size,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              style={{
                opacity: 0.5 + audioLevel * 0.3,
              }}
            />
            
            {/* Mic button - tap to stop */}
            <motion.button
              onClick={onStopRecording}
              className="relative z-10 w-10 h-10 rounded-full bg-budget-red flex items-center justify-center shadow-lg"
              whileTap={{ scale: 0.95 }}
              animate={{
                scale: 1 + audioLevel * 0.1,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <img
                src="/assets/All Icon Used/white mic.png"
                alt="Stop recording"
                className="h-4 w-4 object-contain"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InlineVoiceIndicator;

