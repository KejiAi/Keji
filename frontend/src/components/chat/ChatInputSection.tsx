import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
// import InlineVoiceIndicator from "@/components/voice/InlineVoiceIndicator";
import { useToast } from "@/hooks/use-toast";

interface ChatInputSectionProps {
  message: string;
  onMessageChange: (message: string) => void;
  onSendMessage: () => void;
  selectedFiles: File[];
  onFilesChange: (files: File[]) => void;
  placeholder?: string;
  isSendDisabled?: boolean;
  isFixed?: boolean;
  maxAttachments?: number;
  showVoiceInput?: boolean;
}

const ChatInputSection = ({
  message,
  onMessageChange,
  onSendMessage,
  selectedFiles,
  onFilesChange,
  placeholder = "What can I eat this morn?",
  isSendDisabled = false,
  isFixed = false,
  maxAttachments = 2,
  showVoiceInput = true,
}: ChatInputSectionProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [textareaHeight, setTextareaHeight] = useState(48);
  const [borderRadius, setBorderRadius] = useState(24);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const adjustHeight = () => {
      textarea.style.height = "auto";
      const scrollHeight = textarea.scrollHeight;
      const lineHeight = 24;
      const minHeight = 48;
      const maxHeight = 120;
      
      let lines = Math.floor(scrollHeight / lineHeight);
      lines = Math.max(2, lines);
      
      let newHeight = minHeight;
      let newBorderRadius = 24;
      
      if (lines <= 2) {
        newHeight = minHeight;
        newBorderRadius = 24;
      } else if (lines === 3) {
        newHeight = 72;
        newBorderRadius = 18;
      } else if (lines === 4) {
        newHeight = 96;
        newBorderRadius = 12;
      } else {
        newHeight = maxHeight;
        newBorderRadius = 8;
        textarea.style.overflowY = "auto";
      }
      
      if (lines < 5) {
        textarea.style.overflowY = "hidden";
      }
      
      setTextareaHeight(newHeight);
      setBorderRadius(newBorderRadius);
      textarea.style.height = `${newHeight}px`;
    };

    adjustHeight();
  }, [message]);

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const combined = [...selectedFiles, ...newFiles];
      if (combined.length > maxAttachments) {
        toast({
          title: "Attachment limit reached",
          description: `You can only attach up to ${maxAttachments} files at a time.`,
        });
      }
      onFilesChange(combined.slice(0, maxAttachments));
      e.target.value = '';
    }
  };

  const removeFile = (index: number) => {
    onFilesChange(selectedFiles.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (e.key === "Enter") {
      if (isMobile) {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          onSendMessage();
        }
      } else {
        if (!e.shiftKey) {
          e.preventDefault();
          onSendMessage();
        }
      }
    }
  };

  const containerClassName = isFixed 
    ? "fixed bottom-0 left-0 right-0 bg-[#FFFBFB]" 
    : "bg-[#FFFBFB] flex-shrink-0";

  return (
    <div className={containerClassName} style={{ borderTopLeftRadius: '40px', borderTopRightRadius: '40px' }}>
      <div className="w-full">
        {/* File preview - DISABLED FOR NOW, uncomment when ready
        {selectedFiles.length > 0 && (
          <div className="px-2 mx-4 mt-3">
            <div className="flex flex-wrap gap-3">
              {selectedFiles.map((file, index) => {
                const isImage = file.type.startsWith('image/');
                const fileUrl = isImage ? URL.createObjectURL(file) : null;
                
                return (
                  <div key={index} className="relative group">
                    <div className="flex flex-col items-center gap-1 bg-muted p-2 rounded-lg">
                      {isImage && fileUrl ? (
                        <img 
                          src={fileUrl} 
                          alt={file.name}
                          className="w-16 h-16 object-cover rounded"
                          onLoad={() => URL.revokeObjectURL(fileUrl)}
                        />
                      ) : (
                        <div className="w-16 h-16 bg-background flex items-center justify-center rounded">
                          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                          </svg>
                        </div>
                      )}
                      <span className="text-xs truncate max-w-[64px] text-center">{file.name}</span>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="absolute -top-0 -right-0 bg-white text-black text-2xl rounded-full w-6 h-6 flex items-center justify-center hover:opacity-80 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        */}

        {/* Hidden file input - DISABLED FOR NOW, uncomment when ready
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
          className="hidden"
          onChange={handleFileChange}
        />
        */}
        
        {/* Chat input */}
        <div 
          className="flex items-end p-2 flex-1 mx-4 mt-3 transition-all duration-200"
          style={textareaHeight > 48 ? { 
            borderRadius: `${borderRadius}px`,
            minHeight: `${textareaHeight + 16}px`
          } : { borderRadius: '24px' }}
        > 
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            // placeholder={isVoiceRecording ? "Transcription will appear here..." : placeholder} //disabled for now
            placeholder={placeholder}
            className="flex-1 bg-transparent text-base placeholder:text-muted-foreground/70 placeholder:text-base px-2 py-3 resize-none min-h-[48px]"
            onKeyDown={handleKeyDown}
            rows={1}
          />
        </div>

        {/* Inline Voice Indicator - DISABLED FOR NOW, uncomment when ready
        {showVoiceInput && (
          <InlineVoiceIndicator
            isRecording={isVoiceRecording}
            onStopRecording={() => setIsVoiceRecording(false)}
            onTranscription={(text) => {
              onMessageChange(message ? `${message} ${text}` : text);
            }}
          />
        )}
        */}

        {/* Buttons container */}
        <div className="flex items-center px-4 pb-4 pt-1 justify-end mb-2">  {/* justify between later when not disabled but for now center */}
          {/* Plus button (file upload) - DISABLED FOR NOW, uncomment when ready
          <button onClick={handleFileSelect} className="flex-shrink-0 mb-1">
            <img src="assets/All Icon Used/ic_round-plus2.png" alt="Upload Button" className="h-10 w-10 object-contain" />
          </button>
          */}

          <div className="flex items-center justify-center gap-[10px]">
            {/* Mic button - DISABLED FOR NOW, uncomment when ready
            {showVoiceInput && (
              <Button
                variant="ghost"
                size="icon"
                className={`p-0 hover:opacity-80 transition ${isVoiceRecording ? 'bg-budget-red/20 rounded-full' : ''}`}
                onClick={() => setIsVoiceRecording(!isVoiceRecording)}
              >
                <img
                  src="assets/All Icon Used/mic-HP.png"
                  alt={isVoiceRecording ? "Stop recording" : "Start recording"}
                  className={`h-6 w-6 object-contain ${isVoiceRecording ? 'animate-pulse' : ''}`}
                />
                <span className="sr-only">{isVoiceRecording ? "Stop recording" : "Voice input"}</span>
              </Button>
            )}
            */}

            {/* Send button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-[44px] w-[44px] rounded-full bg-black flex-shrink-0 p-0"
              onClick={onSendMessage}
              // disabled={isSendDisabled || (!message.trim() && selectedFiles.length === 0)} //disabled for now
              disabled={isSendDisabled || !message.trim()}
            >
              <img
                src="assets/All Icon Used/iconamoon_send-fill-HP.png"
                alt="Send"
                className="h-6 w-6 object-contain"
              />
              <span className="sr-only">Send message</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInputSection;
