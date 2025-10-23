import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import PageContainer from "@/components/layout/PageContainer";
import SEO from "@/components/common/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getBackendUrl } from "@/lib/utils";
import { useSession } from "@/contexts/SessionContext";
import { useSocket } from "@/contexts/SocketContext";
import RecommendationPopup from "@/components/modals/RecommendationPopup";

const frontendUrl = import.meta.env.VITE_FRONTEND_BASE_URL;

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
}

interface BackendResponse {
  type: "chat" | "recommendation";
  role: "assistant";
  content?: string;
  title?: string;
  health?: Array<{ label: string; description: string }>;
  reply?: string; // For backward compatibility
}

interface Recommendation {
  title: string;
  content: string;
  health?: Array<{ label: string; description: string }>;
}

const Chat = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: sessionLoading } = useSession();
  const { 
    isConnected, 
    sendMessage: socketSendMessage, 
    acceptRecommendation: socketAcceptRecommendation,
    requestHistory,
    onReceiveMessage,
    onReceiveRecommendation,
    onChatHistory,
    onError
  } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasProcessedInitialMessage = useRef(false);
  const [textareaHeight, setTextareaHeight] = useState(48); // Initial height in pixels
  const [borderRadius, setBorderRadius] = useState(24); // Initial border radius
  const [loadingMessage, setLoadingMessage] = useState("Keji is thinking...");
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ Set up WebSocket event listeners
  useEffect(() => {
    // Handle incoming messages
    const cleanupMessage = onReceiveMessage((data) => {
      console.log('📨 Received message from WebSocket:', data);
      const aiMessage: Message = {
        id: data.message_id?.toString() || Date.now().toString(),
        text: data.content || "Yeah, how can I help you?",
        sender: "ai",
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setLoading(false);
      // Clear loading timer
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
      setLoadingMessage("Keji is thinking...");
    });

    // Handle incoming recommendations
    const cleanupRecommendation = onReceiveRecommendation((data) => {
      console.log('📌 Received recommendation from WebSocket:', data);
      setRecommendation({
        title: data.title || "Food Recommendation",
        content: data.content || "Here's a food suggestion for you.",
        health: data.health
      });
      setLoading(false);
      // Clear loading timer
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
      setLoadingMessage("Keji is thinking...");
    });

    // Handle chat history
    const cleanupHistory = onChatHistory((data) => {
      console.log('📖 Received chat history from WebSocket:', data);
      const historyMessages: Message[] = data.messages.map(
        (m: { text: string; sender: string; timestamp: string }, index: number) => ({
          id: `history-${index}`,
          text: m.text,
          sender: m.sender,
          timestamp: new Date(m.timestamp),
        })
      );
      setMessages(historyMessages);
    });

    // Handle errors
    const cleanupError = onError((data) => {
      console.error('⚠️ WebSocket error:', data);
      const errorMessage: Message = {
        id: Date.now().toString(),
        text: data.message || "Sorry, I'm having trouble responding right now. Please try again.",
        sender: "ai",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setLoading(false);
      // Clear loading timer
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
      setLoadingMessage("Keji is thinking...");
    });

    // Cleanup all handlers on unmount
    return () => {
      cleanupMessage();
      cleanupRecommendation();
      cleanupHistory();
      cleanupError();
      // Clear loading timer on unmount
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    };
  }, [onReceiveMessage, onReceiveRecommendation, onChatHistory, onError]);

  // ✅ Fetch chat history when component mounts and socket is connected
  useEffect(() => {
    if (user && isConnected) {
      console.log('📖 Requesting chat history via WebSocket');
      requestHistory();
    }
  }, [user, isConnected, requestHistory]);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (!recommendation) {
      scrollToBottom();
    }
  }, [messages, recommendation]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      }, 100);
    }
  }, []);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const adjustHeight = () => {
      textarea.style.height = "auto";

      const lineHeight = 16; // Tailwind text-base = 16px
      const minHeight = 12;  // placeholder only
      const maxLines = 5;
      const maxHeight = lineHeight * maxLines;

      let scrollHeight = textarea.scrollHeight;
      let lines = Math.ceil(scrollHeight / lineHeight);

      lines = Math.max(1, lines);

      let newHeight = Math.min(Math.max(lines * lineHeight, minHeight), maxHeight);

      let newBorderRadius = 24;

      if (lines === 1) newBorderRadius = 24;
      else if (lines === 2) newBorderRadius = 20;
      else if (lines === 3) newBorderRadius = 16;
      else if (lines === 4) newBorderRadius = 12;
      else {
        newBorderRadius = 8;
        textarea.style.overflowY = "auto";
      }

      if (lines < maxLines) {
        textarea.style.overflowY = "hidden";
      }

      setTextareaHeight(newHeight);
      setBorderRadius(newBorderRadius);
      textarea.style.height = `${newHeight}px`;
    };

    adjustHeight();
  }, [inputMessage]);


  const sendMessage = useCallback((messageText: string, files?: File[]) => {
    if (!messageText.trim() && !files?.length) return;
    
    // Ensure user is authenticated before sending message
    if (!user) {
      console.error("User not authenticated");
      return;
    }

    // Check WebSocket connection
    if (!isConnected) {
      console.error("WebSocket not connected");
      const errorMessage: Message = {
        id: Date.now().toString(),
        text: "Connection lost. Please refresh the page.",
        sender: "ai",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      text: messageText,
      sender: "user",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setSelectedFiles([]);
    setLoading(true);
    setLoadingMessage("Keji is thinking...");

    // Set up progressive loading messages to show processing is ongoing
    let messageIndex = 0;
    const progressMessages = [
      "Keji is thinking...",
      "Analyzing your request...",
      "Processing information...",
      "Preparing your answer...",
      "Almost ready...",
      "Still working on it..."
    ];

    // Clear any existing timer
    if (loadingTimerRef.current) {
      clearTimeout(loadingTimerRef.current);
    }

    // Update loading message every 8 seconds
    const updateLoadingMessage = () => {
      messageIndex++;
      if (messageIndex < progressMessages.length) {
        setLoadingMessage(progressMessages[messageIndex]);
        loadingTimerRef.current = setTimeout(updateLoadingMessage, 8000);
      } else {
        // After all messages, just show "Still processing..."
        setLoadingMessage("Still processing... Keji is working hard!");
      }
    };

    // Start the timer for the first update (after 8 seconds)
    loadingTimerRef.current = setTimeout(updateLoadingMessage, 8000);

    // Send message via WebSocket
    console.log('📤 Sending message via WebSocket:', messageText);
    socketSendMessage(messageText, files);
  }, [user, isConnected, socketSendMessage]);

  useEffect(() => {
    const initialMessage = location.state?.message;
    const initialFiles = location.state?.files;
    
    // Process if there's a message OR files (or both)
    if ((initialMessage || (initialFiles && initialFiles.length > 0)) && !hasProcessedInitialMessage.current) {
      hasProcessedInitialMessage.current = true;
      // Ensure files are properly passed as array
      const filesToSend = initialFiles && Array.isArray(initialFiles) ? initialFiles : [];
      sendMessage(initialMessage || "", filesToSend.length > 0 ? filesToSend : undefined);
    }
  }, [location.state, sendMessage]);

  const handleSendMessage = () => {
    sendMessage(inputMessage, selectedFiles.length > 0 ? selectedFiles : undefined);
    inputRef.current?.focus();
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
    // Clear the input so same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleRecommendationClose = () => {
    setRecommendation(null);
  };

  const handleRecommendationAccept = (acceptanceMessage: string) => {
    // Save the recommendation via WebSocket
    if (recommendation) {
      console.log('✅ Accepting recommendation via WebSocket:', recommendation.title);
      socketAcceptRecommendation(recommendation.title, recommendation.content);
      
      // Add the recommendation to the message list
      const recMessage: Message = {
        id: Date.now().toString(),
        text: `${recommendation.title}: ${recommendation.content}`,
        sender: "ai",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, recMessage]);
    }
    
    setRecommendation(null);
    
    // Send the acceptance message
    if (acceptanceMessage) {
      sendMessage(acceptanceMessage);
    }
  };

  // Show loading while session is being validated
  if (sessionLoading) {
    return (
      <PageContainer variant="static">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer variant="static">
      <SEO title="Chat — Keji AI" description="Chat with your AI food assistant" />

      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <header className="p-2 mt-6 flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => navigate("/homepage")}
                className="mr-4 p-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ width: 24, height: 24 }}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="black"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 5 L7 12 L15 19" />
                  <line x1="7" y1="12" x2="21" y2="12" />
                </svg>
              </Button>
              {/* Connection indicator */}
              <div className="flex items-center gap-2 mr-4">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-xs text-muted-foreground">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </header>

            {/* Chat body (scrollable) */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden border-background_dark border-b rounded-b-3xl">
              <div className="max-w-2xl mx-auto space-y-4 px-2 sm:px-0 pb-4">
              {messages.map((message) => {
            const isUser = message.sender === "user";
            return (
              <div
                key={message.id}
                className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
              >
                <div
                  className={`flex w-full max-w-[75%] sm:max-w-[70%] gap-2 ${
                    isUser ? "flex-row-reverse" : ""
                  }`}
                >
                  {/* Avatar/logo (only for AI) */}
                  {!isUser && (
                    <div className="w-7 h-7 flex-shrink-0 bg-white rounded-full overflow-hidden flex items-center justify-center">
                      <img
                        src="assets/Asset 1@2x.png"
                        alt="logo"
                        className="w-3 h-3 object-cover"
                      />
                    </div>
                  )}

                  {/* Bubble + timestamp grouped */}
                  <div
                    className={`flex flex-col ${
                      isUser ? "items-end" : "items-start"
                    } max-w-full`}
                  >
                    <div
                      className={`px-3 py-1 rounded-[0.8rem] min-w-0 max-w-full overflow-hidden break-words ${
                        isUser
                          ? "bg-ingredient-green text-ingredient-green-foreground rounded-br-none"
                          : "bg-white text-foreground rounded-bl-none"
                      }`}
                    >
                      <p className="text-sm sm:text-base break-words whitespace-pre-wrap leading-relaxed">
                        {message.text}
                      </p>
                    </div>
                    <div
                      className={`text-[10px] text-gray-400 mt-1 ${
                        isUser ? "text-right" : "text-left"
                      }`}
                    >
                      {new Date(message.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-end gap-2 max-w-[80%]">
                  <div className="w-7 h-7 bg-white rounded-full overflow-hidden flex items-center justify-center mb-1">
                    <img
                      src="assets/Asset 1@2x.png"
                      alt="logo"
                      className="w-3 h-3 object-cover"
                    />
                  </div>
                  <div className="bg-muted text-foreground px-4 py-3 rounded-2xl">
                    <div className="flex flex-col gap-1">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                        <div
                          className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                          style={{ animationDelay: "0.1s" }}
                        ></div>
                        <div
                          className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                          style={{ animationDelay: "0.2s" }}
                        ></div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {loadingMessage}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
                <div ref={messagesEndRef} />
              </div>
            </div>

        {/* Input section (sticky bottom, always visible) */}
        <div className="flex-shrink-0 sticky bottom-0 bg-background">
          <div className="w-full px-2 py-2">
            {/* File preview section */}
            {selectedFiles.length > 0 && (
              <div className="mb-2 px-2">
                <div className="flex flex-wrap gap-2">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 bg-background-light border border-background_dark rounded-lg px-3 py-2"
                    >
                      <span className="text-sm text-foreground truncate max-w-[120px]">
                        {file.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(index)}
                        className="h-5 w-5 p-0 hover:bg-destructive/10"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M18 6 6 18" />
                          <path d="M6 6l12 12" />
                        </svg>
                        <span className="sr-only">Remove file</span>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-end gap-2 w-full">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                className="hidden"
                onChange={handleFileChange}
              />

              <div 
                className="flex items-end p-2 bg-background-light border border-background_dark/50 shadow-base rounded-3xl transition-all duration-200 flex-1"
                style={{ 
                  borderRadius: `${borderRadius}px`,
                  minHeight: `${textareaHeight + 12}px`
                }}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleFileSelect}
                  className="h-9 w-9 flex-shrink-0"
                >
                  <img
                    src="assets/All Icon Used/ic_round-plus.png"
                    alt="Upload"
                    className="h-9 w-9 object-contain"
                  />
                </Button>

                <Textarea
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="What can I eat this morn?"
                  className="flex-1 bg-transparent border-0 ring-0 outline-none focus:border-0 focus:ring-0 text-base placeholder:text-muted-foreground placeholder:text-sm px-2 py-2 resize-none min-h-[10px] leading-[1.2]"
                  onKeyDown={(e) => {
                    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                    if (e.key === "Enter") {
                      if (isMobile) {
                        if (e.ctrlKey || e.metaKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      } else {
                        if (!e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }
                    }
                  }}
                  rows={1}
                />

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full flex-shrink-0"
                  onClick={handleSendMessage}
                  disabled={
                    loading ||
                    (!inputMessage.trim() && selectedFiles.length === 0)
                  }
                >
                  <img
                    src="assets/All Icon Used/proicons_send.png"
                    alt="Send"
                    className="h-6 w-6 object-contain"
                  />
                  <span className="sr-only">Send message</span>
                </Button>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="rounded-full p-0 hover:opacity-80 transition h-12 w-12 flex-shrink-0"
              >
                <img
                  src="assets/All Icon Used/mic icon.png"
                  alt="Mic"
                  className="h-12 w-12 object-contain"
                />
                <span className="sr-only">Voice input</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Recommendation Popup (overlay) */}
        {recommendation && (
          <RecommendationPopup
            recommendation={recommendation}
            onClose={handleRecommendationClose}
            onAccept={handleRecommendationAccept}
          />
        )}
      </div>
    </PageContainer>
  );
};

export default Chat;
