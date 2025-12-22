import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";

interface VoiceRecordingOverlayProps {
  isRecording: boolean;
  onStopRecording: () => void;
  onTranscription: (text: string) => void;
  selectedFiles?: File[];
  onRemoveFile?: (index: number) => void;
  onSendMessage?: () => void;
}

const VoiceRecordingOverlay = ({
  isRecording,
  onStopRecording,
  onTranscription,
  selectedFiles = [],
  onRemoveFile,
  onSendMessage,
}: VoiceRecordingOverlayProps) => {
  const [audioLevel, setAudioLevel] = useState(0);
  const [transcribedText, setTranscribedText] = useState("");
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
        // For now, we'll simulate transcription
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
    const textToSend = transcribedText || "Voice message recorded";
    onTranscription(textToSend);
    setTranscribedText("");
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

  // Calculate ripple sizes based on audio level
  const baseRippleSize = 64;
  const ripple1Size = baseRippleSize + audioLevel * 35;
  const ripple2Size = baseRippleSize + 18 + audioLevel * 45;
  const ripple3Size = baseRippleSize + 36 + audioLevel * 55;
  const ripple4Size = ripple3Size; // Same size as ripple 3

  return (
    <AnimatePresence>
      {isRecording && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center w-full px-4"
        >
          {/* Selected images preview */}
          {selectedFiles.length > 0 && (
            <div className="flex gap-2 mb-4 w-full overflow-x-auto pb-2">
              {selectedFiles.map((file, index) => (
                <div key={index} className="relative flex-shrink-0">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Selected ${index + 1}`}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                  {onRemoveFile && (
                    <button
                      onClick={() => onRemoveFile(index)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Transcription text area and send button */}
          <div className="w-full flex items-start gap-3 mb-6">
            <div className="flex-1 relative">
              <Textarea
                value={transcribedText}
                onChange={(e) => setTranscribedText(e.target.value)}
                placeholder="Transcription will appear here..."
                className="min-h-[60px] max-h-[120px] resize-none bg-background border-border/50 text-foreground placeholder:text-muted-foreground/50 rounded-xl px-4 py-3"
                style={{ fontSize: '16px' }}
              />
            </div>
            <button
              onClick={() => {
                if (transcribedText.trim() || selectedFiles.length > 0) {
                  onTranscription(transcribedText);
                  setTranscribedText("");
                  onStopRecording();
                  onSendMessage?.();
                }
              }}
              className="flex-shrink-0 w-10 h-10 rounded-full bg-foreground flex items-center justify-center mt-2"
            >
              <img
                src="/assets/All Icon Used/proicons_send2.png"
                alt="Send"
                className="h-5 w-5 object-contain invert"
              />
            </button>
          </div>

          {/* Ripple effect container */}
          <div className="relative flex items-center justify-center py-4">
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
            
            {/* Mic button */}
            <motion.button
              onClick={onStopRecording}
              className="relative z-10 w-12 h-12 rounded-full bg-budget-red flex items-center justify-center shadow-lg"
              whileTap={{ scale: 0.95 }}
              animate={{
                scale: 1 + audioLevel * 0.1,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <img
                src="/assets/All Icon Used/white mic.png"
                alt="Stop recording"
                className="h-5 w-5 object-contain invert brightness-0"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
            </motion.button>
          </div>

          {/* Recording indicator text */}
          <motion.p
            className="mt-4 text-sm text-muted-foreground"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            Tap to stop recording
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VoiceRecordingOverlay;
