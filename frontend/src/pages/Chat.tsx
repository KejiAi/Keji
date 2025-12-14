import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import PageContainer from "@/components/layout/PageContainer";
import SEO from "@/components/common/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getBackendUrl } from "@/lib/utils";
import { useSession } from "@/contexts/SessionContext";
import { useSocket } from "@/contexts/SocketContext";
import type { OutgoingFile } from "@/contexts/SocketContext";
import type { SocketHistoryMessage } from "@/contexts/SocketContext";
import RecommendationPopup from "@/components/modals/RecommendationPopup";
import { ConnectionStatus } from "@/components/common/ConnectionStatus";

const frontendUrl = import.meta.env.VITE_FRONTEND_BASE_URL;

interface MessageAttachment {
  name: string;
  url?: string;
  previewUrl?: string;
  type?: string;
  size?: number;
  status?: "pending" | "uploaded" | "error";
}

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
  attachments?: MessageAttachment[];
  clientId?: string;
  serverId?: number;
}

const IMAGE_FILE_REGEX = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;

const isImageAttachmentType = (attachment: MessageAttachment): boolean => {
  if (attachment.type && attachment.type.toLowerCase().startsWith("image/")) {
    return true;
  }
  return IMAGE_FILE_REGEX.test(attachment.name.toLowerCase());
};

const formatFileSize = (bytes?: number): string => {
  if (!bytes || Number.isNaN(bytes)) {
    return "";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const buildPreviewAttachments = (
  files: File[],
  existing?: MessageAttachment[]
): MessageAttachment[] => {
  if (!files.length) {
    return [];
  }

  return files.map((file, index) => {
    const existingAttachment = existing?.[index];
    const previewUrl =
      existingAttachment?.previewUrl ??
      (typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
        ? URL.createObjectURL(file)
        : undefined);

    return {
      name: file.name,
      type: file.type,
      size: file.size,
      previewUrl,
      status: "pending",
    };
  });
};

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
  const { toast } = useToast();
  const { 
    isConnected,
    isReconnecting, 
    hasSyncedHistory,
    sendMessage: socketSendMessage, 
    acceptRecommendation: socketAcceptRecommendation,
    requestHistory,
    onReceiveMessage,
    onReceiveChunk,
    onReceiveRecommendation,
    onChatHistory,
    onError,
    onMessageSaved
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
  const [pendingInitialPayload, setPendingInitialPayload] = useState<{ message: string; files?: File[] } | null>(null);
  const pendingInitialPayloadRef = useRef<{ message: string; files?: File[] } | null>(null);
  const pendingInitialMessageRef = useRef<Message | null>(null);
  const hasInsertedPendingMessageRef = useRef(false);
  const [textareaHeight, setTextareaHeight] = useState(48); // Initial height in pixels
  const [borderRadius, setBorderRadius] = useState(24); // Initial border radius
  const [loadingMessage, setLoadingMessage] = useState("Keji is thinking");
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentChunkGroupRef = useRef<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);

  const revokeAttachmentPreviews = useCallback((attachments?: MessageAttachment[]) => {
    if (!attachments) return;
    if (typeof URL === "undefined" || typeof URL.revokeObjectURL !== "function") {
      return;
    }

    attachments.forEach((attachment) => {
      if (attachment.previewUrl) {
        try {
          URL.revokeObjectURL(attachment.previewUrl);
        } catch (error) {
          console.warn("Failed to revoke preview URL", error);
        }
      }
    });
  }, []);

  const updateMessagesWithAttachments = useCallback(
    (
      prevMessages: Message[],
      attachments: MessageAttachment[],
      targetClientId?: string,
      targetServerId?: number
    ) => {
      if (!attachments.length) {
        return prevMessages;
      }

      const nextMessages = [...prevMessages];
      for (let i = nextMessages.length - 1; i >= 0; i -= 1) {
        const message = nextMessages[i];
        const matchesClientId = targetClientId && message.clientId === targetClientId;
        const matchesServerId =
          typeof targetServerId === "number" && message.serverId === targetServerId;
        const matchesFallback = !targetClientId && !targetServerId && message.sender === "user";

        if (matchesClientId || matchesServerId || matchesFallback) {
          revokeAttachmentPreviews(message.attachments);
          nextMessages[i] = {
            ...message,
            attachments: attachments.map((attachment) => ({
              ...attachment,
              status: "uploaded" as const,
            })),
            serverId: targetServerId ?? message.serverId,
          };
          break;
        }
      }

      return nextMessages;
    },
    [revokeAttachmentPreviews]
  );

  const markAttachmentsAsError = useCallback(
    (prevMessages: Message[], targetClientId?: string, targetServerId?: number) => {
      const nextMessages = [...prevMessages];
      for (let i = nextMessages.length - 1; i >= 0; i -= 1) {
        const message = nextMessages[i];
        const matchesClientId = targetClientId && message.clientId === targetClientId;
        const matchesServerId =
          typeof targetServerId === "number" && message.serverId === targetServerId;
        const matchesFallback = !targetClientId && !targetServerId && message.sender === "user";

        if (matchesClientId || matchesServerId || matchesFallback) {
          nextMessages[i] = {
            ...message,
            attachments: (message.attachments || []).map((attachment) => ({
              ...attachment,
              status: "error" as const,
            })),
          };
          break;
        }
      }
      return nextMessages;
    },
    []
  );

  useEffect(() => {
    pendingInitialPayloadRef.current = pendingInitialPayload;
  }, [pendingInitialPayload]);

  useEffect(() => {
    if (!lightboxImage) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightboxImage(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [lightboxImage]);

  // ✅ Set up WebSocket event listeners
  useEffect(() => {
    // Handle incoming messages (short, non-chunked messages)
    const cleanupMessage = onReceiveMessage((data) => {
      console.log('📨 Received message from WebSocket:', data);
      const isAck = Boolean(data.is_ack);
      const targetClientId = (data as { client_message_id?: string }).client_message_id;
      const targetServerId = typeof data.user_message_id === "number" ? data.user_message_id : undefined;

      const ackAttachments: MessageAttachment[] =
        data.uploaded_files?.map((file) => ({
          name: file.name,
          url: file.url,
          type: file.type,
          size: file.size,
        })) ?? [];

      setMessages((prev) => {
        let updatedMessages = prev;

        if (ackAttachments.length > 0) {
          updatedMessages = updateMessagesWithAttachments(
            prev,
            ackAttachments,
            targetClientId,
            targetServerId
          );
        } else if (isAck && data.upload_errors?.length) {
          updatedMessages = markAttachmentsAsError(prev, targetClientId, targetServerId);
        }

        // Only add a message bubble if there's actual content (skip empty ack messages)
        if (data.content && data.content.trim()) {
          const aiMessage: Message = {
            id: data.message_id?.toString() || Date.now().toString(),
            text: data.content,
            sender: "ai",
            timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
          };
          return [...updatedMessages, aiMessage];
        }

        return updatedMessages;
      });
      
      if (!isAck) {
        setLoading(false);
        // Clear loading timer
        if (loadingTimerRef.current) {
          clearTimeout(loadingTimerRef.current);
          loadingTimerRef.current = null;
        }
        setLoadingMessage("Keji is thinking");
      }
    });

    // Handle incoming message chunks (long messages sent in parts)
    const cleanupChunk = onReceiveChunk((data) => {
      console.log('📦 Received chunk:', data.chunk_index + 1, '/', data.total_chunks);
      
      // SAFETY CHECK: If first chunk looks like a recommendation JSON, try to parse it
      if (data.chunk_index === 0) {
        try {
          // Check if chunk contains recommendation structure
          const chunkText = data.chunk.trim();
          if (chunkText.startsWith('{') && (chunkText.includes('"type":"recommendation"') || chunkText.includes("'type': 'recommendation'"))) {
            // Try to parse as complete recommendation JSON
            const parsed = JSON.parse(chunkText);
            if (parsed.type === 'recommendation' && parsed.title && parsed.content) {
              console.warn('⚠️ Recommendation received as chunk - this should not happen! Parsing as recommendation.');
              setRecommendation({
                title: parsed.title,
                content: parsed.content,
                health: parsed.health
              });
              setLoading(false);
              if (loadingTimerRef.current) {
                clearTimeout(loadingTimerRef.current);
                loadingTimerRef.current = null;
              }
              setLoadingMessage("Keji is thinking");
              return; // Don't process as chunk
            }
          }
        } catch (e) {
          // Not a complete JSON, continue with normal chunk processing
          console.debug('Chunk is not a recommendation JSON, processing normally');
        }
      }
      
      // First chunk - change from "thinking" to "typing" and add as first bubble
      if (data.chunk_index === 0) {
        setLoading(false);
        if (loadingTimerRef.current) {
          clearTimeout(loadingTimerRef.current);
          loadingTimerRef.current = null;
        }
        setLoadingMessage("Keji is typing");
        currentChunkGroupRef.current = data.message_group_id;
        
        // Add first chunk as a separate message bubble
        const firstChunkMessage: Message = {
          id: `${data.message_group_id}-${data.chunk_index}`,
          text: data.chunk,
          sender: "ai",
          timestamp: new Date(data.timestamp),
        };
        setMessages((prev) => [...prev, firstChunkMessage]);
      } else {
        // Subsequent chunks - add each as a new bubble
        const chunkMessage: Message = {
          id: `${data.message_group_id}-${data.chunk_index}`,
          text: data.chunk,
          sender: "ai",
          timestamp: new Date(data.timestamp),
        };
        setMessages((prev) => [...prev, chunkMessage]);
      }
      
      // Final chunk - clear typing indicator
      if (data.is_final) {
        currentChunkGroupRef.current = null;
        setLoadingMessage("Keji is thinking");
      }
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
      setLoadingMessage("Keji is thinking");
    });

    // Handle chat history
    const cleanupHistory = onChatHistory((data) => {
      console.log('📖 Received chat history from WebSocket:', data);
      
      // Keep each chunk as a separate message bubble
      const historyMessages: Message[] = data.messages.map((m, index) => {
        const attachments =
          m.attachments?.map((attachment) => ({
            name: attachment.name,
            url: attachment.url,
            type: attachment.type,
            size:
              typeof attachment.size === "number"
                ? attachment.size
                : attachment.size
                ? Number(attachment.size)
                : undefined,
            status: attachment.url ? ("uploaded" as const) : undefined,
          })) ?? [];

        return {
          id:
            m.is_chunked && m.message_group_id
              ? `${m.message_group_id}-${m.chunk_index}`
              : `history-${index}`,
          text: m.text,
          sender: m.sender === "bot" ? "ai" : "user",
          timestamp: new Date(m.timestamp),
          serverId: typeof m.message_id === "number" ? m.message_id : undefined,
          attachments: attachments.length > 0 ? attachments : undefined,
        };
      });

      // If there's a pending message coming from navigation, check if it's already in history
      if (pendingInitialMessageRef.current) {
        const pendingText = pendingInitialMessageRef.current.text.trim();
        const pendingAttachments = pendingInitialMessageRef.current.attachments ?? [];
        const pendingAttachmentNames = pendingAttachments
          .map((attachment) => attachment.name)
          .filter((name): name is string => Boolean(name))
          .sort();

        const matchesPendingMessage = (msg: Message): boolean => {
          if (msg.sender !== "user") {
            return false;
          }

          const msgText = msg.text.trim();
          const msgAttachmentNames = (msg.attachments ?? [])
            .map((attachment) => attachment.name)
            .filter((name): name is string => Boolean(name))
            .sort();

          const attachmentsMatch =
            pendingAttachmentNames.length > 0 &&
            pendingAttachmentNames.length === msgAttachmentNames.length &&
            pendingAttachmentNames.every((name, index) => name === msgAttachmentNames[index]);

          if (pendingText && pendingAttachmentNames.length > 0) {
            return msgText === pendingText && attachmentsMatch;
          }

          if (pendingText) {
            return msgText === pendingText;
          }

          if (pendingAttachmentNames.length > 0) {
            return attachmentsMatch;
          }

          return false;
        };

        // Check if the pending message is already in history (backend saved it)
        const historyIndex = historyMessages.findIndex(matchesPendingMessage);
        const isInHistory = historyIndex >= 0;
        
        if (isInHistory) {
          const historyMessage = historyMessages[historyIndex];
          const pendingMessage = pendingInitialMessageRef.current;
          const historyHasUploadedAttachments =
            (historyMessage.attachments ?? []).some((attachment) => Boolean(attachment.url));

          historyMessages[historyIndex] = {
            ...historyMessage,
            text: historyMessage.text || pendingMessage.text,
            attachments:
              historyHasUploadedAttachments && historyMessage.attachments?.length
                ? historyMessage.attachments
                : pendingAttachments.length > 0
                ? pendingAttachments
                : historyMessage.attachments,
            clientId: pendingMessage.clientId ?? historyMessage.clientId,
          };

          if (historyHasUploadedAttachments && pendingMessage.attachments) {
            revokeAttachmentPreviews(pendingMessage.attachments);
          }

          pendingInitialMessageRef.current = null;
          pendingInitialPayloadRef.current = null;
          hasInsertedPendingMessageRef.current = true;
        } else {
          // Not in history yet, check if it's already in historyMessages (from previous append)
          const alreadyAppended = historyMessages.some(
            msg => msg.id === pendingInitialMessageRef.current!.id
          );
          
          if (!alreadyAppended) {
            // Not in historyMessages either, append it so user sees it immediately
            historyMessages.push({
              ...pendingInitialMessageRef.current,
            });
            hasInsertedPendingMessageRef.current = true;
          }
        }
      }
      
      setMessages(historyMessages);
    });

    const cleanupSaved = onMessageSaved((data) => {
      if (!data?.message_id || !data.client_message_id) {
        return;
      }

      setMessages((prev) => {
        const index = prev.findIndex((msg) => msg.clientId === data.client_message_id);
        if (index === -1) {
          return prev;
        }
        const next = [...prev];
        next[index] = {
          ...next[index],
          serverId: data.message_id,
        };
        return next;
      });
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
      setLoadingMessage("Keji is thinking");
    });

    // Cleanup all handlers on unmount
    return () => {
      cleanupMessage();
      cleanupChunk();
      cleanupRecommendation();
      cleanupHistory();
      cleanupSaved();
      cleanupError();
      // Clear loading timer on unmount
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    };
  }, [
    onReceiveMessage,
    onReceiveChunk,
    onReceiveRecommendation,
    onChatHistory,
    onError,
    onMessageSaved,
    updateMessagesWithAttachments,
    markAttachmentsAsError,
    revokeAttachmentPreviews,
  ]);

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
  }, [messages.length]);

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

      const scrollHeight = textarea.scrollHeight;
      let lines = Math.ceil(scrollHeight / lineHeight);

      lines = Math.max(1, lines);

      const newHeight = Math.min(Math.max(lines * lineHeight, minHeight), maxHeight);

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


  const MAX_ATTACHMENTS = 2;

  const convertFilesToPayload = useCallback(async (files: File[]): Promise<OutgoingFile[]> => {
    const conversions = files.map(
      (file) =>
        new Promise<OutgoingFile>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.includes(",") ? result.split(",")[1] : result;
            resolve({
              name: file.name,
              size: file.size,
              type: file.type,
              data: base64,
            });
          };
          reader.onerror = () => reject(reader.error || new Error("File read error"));
          reader.readAsDataURL(file);
        })
    );

    return Promise.all(conversions);
  }, []);

  const sendMessage = useCallback(async (messageText: string, files?: File[], existingClientId?: string) => {
    const trimmedMessage = messageText.trim();
    const hasText = trimmedMessage.length > 0;
    const hasFiles = !!files?.length;

    if (files && files.length > MAX_ATTACHMENTS) {
      toast({
        title: "Attachment limit reached",
        description: `You can only attach up to ${MAX_ATTACHMENTS} files at a time.`,
      });
      return;
    }

    if (!hasText && !hasFiles) return;
    
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
        text: isReconnecting 
          ? "Reconnecting to server... Please wait a moment and try again." 
          : "Connection lost. Reconnecting automatically...",
        sender: "ai",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      return;
    }

    const displayText = hasText ? messageText : "";

    const clientId = existingClientId ?? Date.now().toString();
    const previewAttachments =
      hasFiles && !existingClientId ? buildPreviewAttachments(files!) : undefined;

    const newMessage: Message = {
      id: clientId,
      text: displayText,
      sender: "user",
      timestamp: new Date(),
      attachments: previewAttachments,
      clientId,
    };

    setMessages((prev) => {
      const next = [...prev];
      const existingIndex = next.findIndex((msg) => msg.id === clientId);

      if (existingIndex >= 0) {
        const existing = next[existingIndex];
        next[existingIndex] = {
          ...existing,
          ...newMessage,
          attachments: previewAttachments ?? existing.attachments,
        };
      } else {
        next.push(newMessage);
      }

      if (pendingInitialMessageRef.current?.id === clientId) {
        pendingInitialMessageRef.current = next.find((msg) => msg.id === clientId) || null;
      }

      return next;
    });
    setInputMessage("");
    setSelectedFiles([]);
    setLoading(true);
    setLoadingMessage("Keji is thinking");

    // Send message via WebSocket
    let outgoingFiles: OutgoingFile[] | undefined;
    if (files?.length) {
      try {
        outgoingFiles = await convertFilesToPayload(files);
      } catch (error) {
        console.error("Failed to process files", error);
        const errorMessage: Message = {
          id: Date.now().toString(),
          text: "Unable to read one of the files you attached. Please try again.",
          sender: "ai",
          timestamp: new Date(),
        };
        setMessages((prev) => {
          const existingMessage = prev.find((msg) => msg.id === clientId);
          if (previewAttachments?.length) {
            revokeAttachmentPreviews(previewAttachments);
          } else if (existingMessage?.attachments) {
            revokeAttachmentPreviews(existingMessage.attachments);
          }

          const next = prev.filter((msg) => msg.id !== clientId);
          if (pendingInitialMessageRef.current?.id === clientId) {
            pendingInitialMessageRef.current = null;
          }

          return [...next, errorMessage];
        });
        setLoading(false);
        return;
      }
    }

    console.log('📤 Sending message via WebSocket:', trimmedMessage || displayText);
    socketSendMessage(messageText, outgoingFiles, clientId);
  }, [user, isConnected, socketSendMessage, isReconnecting, convertFilesToPayload, revokeAttachmentPreviews]);

  useEffect(() => {
    if (hasProcessedInitialMessage.current) {
      return;
    }

    const state = location.state as { message?: string; files?: File[] } | null;
    const initialMessage = state?.message;
    const initialFiles = state?.files;

    const hasMessage = typeof initialMessage === "string" && initialMessage.trim().length > 0;
    const hasFiles = Array.isArray(initialFiles) && initialFiles.length > 0;

    if ((hasMessage || hasFiles) && !pendingInitialPayload) {
      hasProcessedInitialMessage.current = true;
      const filesToSend = hasFiles ? (initialFiles as File[]) : [];
      const payload = {
        message: initialMessage || "",
        files: filesToSend,
      };

      // Prepare pending references so history render can include the outgoing message immediately
      pendingInitialPayloadRef.current = payload;
      setPendingInitialPayload(payload);

      const displayTextFromState = hasMessage ? initialMessage ?? "" : "";

      if (displayTextFromState || filesToSend.length > 0) {
        const pendingId = `pending-${Date.now()}`;
        const previewAttachments =
          filesToSend.length > 0 ? buildPreviewAttachments(filesToSend) : undefined;

        pendingInitialMessageRef.current = {
          id: pendingId,
          clientId: pendingId,
          text: displayTextFromState,
          sender: "user",
          timestamp: new Date(),
          attachments: previewAttachments,
        };
      } else {
        pendingInitialMessageRef.current = null;
      }
      hasInsertedPendingMessageRef.current = false;

      // Clear navigation state so refreshes do not resend the message
      navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    }
  }, [location.pathname, location.search, location.state, navigate, pendingInitialPayload]);

  useEffect(() => {
    if (!pendingInitialPayload) {
      return;
    }

    if (!hasSyncedHistory || !isConnected) {
      return;
    }

    const filesToSend =
      pendingInitialPayload.files && pendingInitialPayload.files.length > 0
        ? pendingInitialPayload.files
        : undefined;

    const processPending = async () => {
      if (!pendingInitialPayload.message?.trim() && !filesToSend?.length) {
        setPendingInitialPayload(null);
        pendingInitialPayloadRef.current = null;
        hasInsertedPendingMessageRef.current = false;
        return;
      }

      try {
        await sendMessage(
          pendingInitialPayload.message || "",
          filesToSend,
          pendingInitialMessageRef.current?.id
        );
      } finally {
        setPendingInitialPayload(null);
        pendingInitialPayloadRef.current = null;
        // Keep pendingInitialMessageRef until history confirms the upload
      }
    };

    void processPending();
  }, [pendingInitialPayload, hasSyncedHistory, isConnected, sendMessage]);

  const handleSendMessage = () => {
    void sendMessage(inputMessage, selectedFiles.length > 0 ? selectedFiles : undefined);
    inputRef.current?.focus();
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files);
      const combined = [...selectedFiles, ...newFiles];
      if (combined.length > MAX_ATTACHMENTS) {
        toast({
          title: "Attachment limit reached",
          description: `You can only attach up to ${MAX_ATTACHMENTS} files at a time.`,
        });
      }
      setSelectedFiles(combined.slice(0, MAX_ATTACHMENTS));
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
      socketAcceptRecommendation(recommendation.title, recommendation.content, acceptanceMessage);
      
      // Add AI message with just the title (no health benefits)
      const aiMessage: Message = {
        id: Date.now().toString(),
        text: recommendation.title,
        sender: "ai",
        timestamp: new Date(),
      };
      
      // Add user's acceptance message
      const userMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: acceptanceMessage,
        sender: "user",
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, aiMessage, userMessage]);
      
      // Show loading indicator while waiting for AI confirmation response
      setLoading(true);
      setLoadingMessage("Keji is thinking");
    }
    
    setRecommendation(null);
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
      <ConnectionStatus />

      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <header className="p-2 mt-6 flex items-center justify-between flex-shrink-0">
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
                <div
                  className={`w-2 h-2 rounded-full ${
                    isConnected
                      ? hasSyncedHistory
                        ? 'bg-green-500'
                        : 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                />
                <span className="text-xs text-muted-foreground">
                  {isConnected
                    ? hasSyncedHistory
                      ? 'Connected'
                      : 'Syncing history...'
                    : 'Disconnected'}
                </span>
              </div>
            </header>

            {/* Chat body (scrollable) - separate div with bottom border */}
            <div className="flex-1 relative overflow-y-auto overflow-x-hidden bg-background border-b-2 border-budget-red/50 rounded-b-[28px]">
              <div className="max-w-2xl mx-auto space-y-4 px-2 sm:px-0 pb-8">
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
                      className={`px-3 py-2 rounded-[0.8rem] min-w-0 max-w-full overflow-hidden break-words ${
                        isUser
                          ? "bg-ingredient-green text-ingredient-green-foreground rounded-br-none"
                          : "bg-white text-foreground rounded-bl-none"
                      }`}
                    >
                      <div className="flex flex-col gap-2">
                        {message.text && message.text.trim().length > 0 && (
                          <p className="text-sm sm:text-base break-words whitespace-pre-wrap leading-relaxed">
                            {message.text}
                          </p>
                        )}

                        {message.attachments?.length ? (
                          <div
                            className={`grid gap-2 ${
                              message.attachments.length > 1 ? "sm:grid-cols-2" : ""
                            }`}
                          >
                            {message.attachments.map((attachment, index) => {
                              const displayUrl = attachment.url || attachment.previewUrl;
                              const isImage =
                                !!displayUrl && isImageAttachmentType(attachment);
                              const href = attachment.url || attachment.previewUrl;
                              const key = `${message.id}-attachment-${index}`;
                              return (
                                <div key={key} className="relative">
                                  {isImage && displayUrl ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setLightboxImage({
                                          src: displayUrl,
                                          alt: attachment.name || "Uploaded image",
                                        })
                                      }
                                      className="block group w-full"
                                    >
                                      <img
                                        src={displayUrl}
                                        alt={attachment.name}
                                        className="max-h-48 w-full rounded-lg object-cover border border-background_dark/20"
                                      />
                                    </button>
                                  ) : (
                                    <a
                                      href={href || undefined}
                                      target={href ? "_blank" : undefined}
                                      rel={href ? "noopener noreferrer" : undefined}
                                      className={`flex items-center gap-2 bg-background-light border border-background_dark/20 rounded-lg px-3 py-2 text-xs sm:text-sm ${
                                        attachment.status === "pending" ? "pointer-events-none opacity-80" : ""
                                      }`}
                                      aria-disabled={!href}
                                    >
                                      <div className="w-10 h-10 flex items-center justify-center bg-background rounded">
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          width="24"
                                          height="24"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="1.5"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          className="text-muted-foreground"
                                        >
                                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                          <polyline points="14 2 14 8 20 8"></polyline>
                                          <line x1="10" y1="13" x2="14" y2="13"></line>
                                          <line x1="10" y1="17" x2="14" y2="17"></line>
                                          <line x1="8" y1="9" x2="9" y2="9"></line>
                                        </svg>
                                      </div>
                                      <div className="flex flex-col min-w-0">
                                        <span className="font-medium truncate">{attachment.name}</span>
                                        {attachment.size ? (
                                          <span className="text-[10px] text-muted-foreground">
                                            {formatFileSize(attachment.size)}
                                          </span>
                                        ) : null}
                                      </div>
                                    </a>
                                  )}

                                  {attachment.status === "pending" && (
                                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center rounded-lg text-white text-xs font-medium">
                                      Uploading...
                                    </div>
                                  )}

                                  {attachment.status === "error" && (
                                    <div className="absolute inset-0 bg-red-600/70 backdrop-blur-sm flex items-center justify-center rounded-lg text-white text-xs font-medium text-center px-2">
                                      Upload failed
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
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
                      <div className="text-xs text-muted-foreground flex items-center gap-0">
                        <span>{loadingMessage}</span>
                        <span className="inline-flex">
                          <span className="animate-[bounce_1.4s_ease-in-out_infinite]">.</span>
                          <span className="animate-[bounce_1.4s_ease-in-out_0.2s_infinite]">.</span>
                          <span className="animate-[bounce_1.4s_ease-in-out_0.4s_infinite]">.</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Typing indicator when receiving chunks */}
            {!loading && currentChunkGroupRef.current && (
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
                      <div className="text-xs text-muted-foreground flex items-center gap-0">
                        <span>Keji is typing</span>
                        <span className="inline-flex">
                          <span className="animate-[bounce_1.4s_ease-in-out_infinite]">.</span>
                          <span className="animate-[bounce_1.4s_ease-in-out_0.2s_infinite]">.</span>
                          <span className="animate-[bounce_1.4s_ease-in-out_0.4s_infinite]">.</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
                <div ref={messagesEndRef} />
              </div>
            </div>

        {/* Spacer between chat interface and input section */}
        <div className="h-3 flex-shrink-0 bg-background"></div>

        {/* Input section - separate div that sits below chat interface */}
        <div className="bg-[#FFFBFB] flex-shrink-0" style={{ borderTopLeftRadius: '40px', borderTopRightRadius: '40px' }}>
          <div className="w-full">
            {/* File preview - displayed above */}
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

            {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                className="hidden"
                onChange={handleFileChange}
              />

            {/* Chat input placeholder - displayed above */}
              <div 
              className="flex items-end p-2 flex-1 mx-4 mt-3 transition-all duration-200"
              style={textareaHeight > 48 ? { 
                  borderRadius: `${borderRadius}px`,
                minHeight: `${textareaHeight + 16}px`
              } : { borderRadius: '24px' }}
            > 
                <Textarea
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="What can I eat this morn?"
                className="flex-1 bg-transparent text-base placeholder:text-muted-foreground/70 placeholder:text-base px-2 py-3 resize-none min-h-[48px]"
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
            </div>

            {/* Buttons container - displayed below and centralized */}
            <div className="flex items-center px-4 pb-4 pt-1 justify-between mb-2">
              <button onClick={handleFileSelect} className="flex-shrink-0 mb-1">
                  <img src="assets/All Icon Used/ic_round-plus2.png" alt="Upload Button" className="h-10 w-10 object-contain" />
              </button>

              <div className="flex items-center justify-center gap-[10px]">
                <Button
                  variant="ghost"
                  size="icon"
                  className="p-0 hover:opacity-80 transition"
                >
                  <img
                    src="assets/All Icon Used/mic-HP.png"
                    alt="mic"
                    className="h-6 w-6 object-contain"
                  />
                  <span className="sr-only">Voice input</span>
                </Button>

              <Button
                variant="ghost"
                size="icon"
                  className="h-[44px] w-[44px] rounded-full bg-black flex-shrink-0 p-0"
                  onClick={handleSendMessage}
                  disabled={
                    loading ||
                    (!inputMessage.trim() && selectedFiles.length === 0)
                  }
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

        {/* Recommendation Popup (overlay) */}
        {recommendation && (
          <RecommendationPopup
            recommendation={recommendation}
            onClose={handleRecommendationClose}
            onAccept={handleRecommendationAccept}
          />
        )}

        {lightboxImage && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4 py-6"
            onClick={() => setLightboxImage(null)}
            role="presentation"
          >
            <div
              className="relative max-w-5xl w-full max-h-[90vh]"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="absolute top-4 right-4 text-white/90 hover:text-white transition"
                aria-label="Close image preview"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-8 w-8"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <img
                src={lightboxImage.src}
                alt={lightboxImage.alt}
                className="w-full max-h-[90vh] object-contain rounded-xl shadow-xl"
              />
              {lightboxImage.alt && (
                <div className="mt-3 text-center text-sm text-white/80">{lightboxImage.alt}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
};

export default Chat;
