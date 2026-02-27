"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Plus, Send } from "lucide-react";
import { io } from "socket.io-client";
import styles from "./ChatTab.module.css";

type ChatMessage = {
  id: string;
  sender: "me" | "partner";
  sentAtMs: number;
  kind: "text" | "image";
  text?: string;
  imageSrc?: string;
};

type ApiChatMessage = {
  id: string;
  coupleId: string;
  senderUserId: string;
  kind: "TEXT" | "IMAGE";
  text?: string | null;
  imageUrl?: string | null;
  sentAtMs?: number;
};

const CHAT_NAMESPACE = "/ws/chat";
const CHAT_EVENTS = {
  connected: "chat:connected",
  error: "chat:error",
  message: "chat:message",
  join: "chat:join",
  sync: "chat:sync",
  ping: "chat:ping",
  pong: "chat:pong",
};

const HEALTHCHECK_INTERVAL_MS = 15_000;
const HEALTHCHECK_STALE_MS = 40_000;
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 15_000;
const RECONNECT_JITTER = 0.2;

const INITIAL_BATCH = 30;
const LOAD_BATCH = 20;
const SCROLL_THRESHOLD = 80;
const STICKY_BOTTOM_THRESHOLD = 32;

type ChatIdentity = {
  coupleId: string;
  userId: string;
};

const readStoredIdentity = (): ChatIdentity | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const storageCoupleId = window.localStorage.getItem("coupleId");
  const storageUserId = window.localStorage.getItem("userId");

  const coupleId = params.get("coupleId") ?? storageCoupleId ?? null;
  const userId = params.get("userId") ?? storageUserId ?? null;

  if (!coupleId || !userId) {
    return null;
  }

  return { coupleId, userId };
};

const readProviderUserId = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const storageProviderUserId = window.localStorage.getItem("providerUserId");

  return params.get("providerUserId") ?? storageProviderUserId ?? null;
};

const createClientMessageId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export default function ChatTab() {
  const [message, setMessage] = useState("");
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [inputBarHeight, setInputBarHeight] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "reconnecting" | "offline"
  >("connecting");
  const inputBarRef = useRef<HTMLDivElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const healthcheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef(0);
  const lastSeenMessageRef = useRef<{ id: string; sentAtMs: number } | null>(null);
  const isUnmountingRef = useRef(false);
  const isPrependingRef = useRef(false);
  const shouldStickToBottomRef = useRef(true);
  const previousScrollHeightRef = useRef<number | null>(null);
  const previousMessageCountRef = useRef(0);
  const hasInitialScrollRef = useRef(false);

  const [chatIdentity, setChatIdentity] = useState<ChatIdentity | null>(() =>
    readStoredIdentity()
  );
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  const chatApiBaseUrl = apiBaseUrl ? `${apiBaseUrl}/chat` : "/chat";
  const chatApiUrl = `${chatApiBaseUrl}/messages`;
  const chatIdentityUrl = `${chatApiBaseUrl}/identity`;
  const chatSocketUrl = apiBaseUrl ? `${apiBaseUrl}${CHAT_NAMESPACE}` : CHAT_NAMESPACE;
  const coupleId = chatIdentity?.coupleId ?? "";
  const userId = chatIdentity?.userId ?? "";

  const [allMessages, setAllMessages] = useState<ChatMessage[]>([]);
  const seenMessageIdsRef = useRef(new Set<string>());
  const [startIndex, setStartIndex] = useState(0);

  const sortedMessages = useMemo(
    () => [...allMessages].sort((a, b) => a.sentAtMs - b.sentAtMs),
    [allMessages]
  );

  const visibleMessages = useMemo(
    () => sortedMessages.slice(startIndex),
    [sortedMessages, startIndex]
  );

  const appendMessage = useCallback((nextMessage: ChatMessage) => {
    setAllMessages((prev) => {
      if (seenMessageIdsRef.current.has(nextMessage.id)) {
        return prev;
      }

      seenMessageIdsRef.current.add(nextMessage.id);
      lastActivityRef.current = Date.now();
      if (
        !lastSeenMessageRef.current ||
        nextMessage.sentAtMs >= lastSeenMessageRef.current.sentAtMs
      ) {
        lastSeenMessageRef.current = {
          id: nextMessage.id,
          sentAtMs: nextMessage.sentAtMs,
        };
      }
      return [...prev, nextMessage];
    });
  }, []);

  const mapApiMessage = useCallback(
    (payload: ApiChatMessage): ChatMessage | null => {
      if (!payload?.id) return null;

      return {
        id: payload.id,
        sender: payload.senderUserId === userId ? "me" : "partner",
        sentAtMs: payload.sentAtMs ?? Date.now(),
        kind: payload.kind === "IMAGE" ? "image" : "text",
        text: payload.text ?? undefined,
        imageSrc: payload.imageUrl ?? undefined,
      };
    },
    [userId]
  );

  const handleIncomingMessage = useCallback(
    (payload: ApiChatMessage) => {
      const mapped = mapApiMessage(payload);
      if (!mapped) return;
      appendMessage(mapped);
    },
    [appendMessage, mapApiMessage]
  );

  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    reconnectAttemptRef.current = 0;
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current || isUnmountingRef.current) return;

    const attempt = reconnectAttemptRef.current + 1;
    reconnectAttemptRef.current = attempt;

    const baseDelay = Math.min(
      RECONNECT_MAX_DELAY_MS,
      RECONNECT_BASE_DELAY_MS * 2 ** (attempt - 1)
    );
    const jitter = baseDelay * RECONNECT_JITTER * (Math.random() * 2 - 1);
    const delay = Math.max(0, Math.round(baseDelay + jitter));

    setConnectionStatus("reconnecting");
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      socketRef.current?.connect();
    }, delay);
  }, []);

  const sendJoin = useCallback(
    (socketInstance: ReturnType<typeof io>) => {
      socketInstance.emit(CHAT_EVENTS.join, { coupleId, userId });
    },
    [coupleId, userId]
  );

  const requestResync = useCallback(
    (socketInstance: ReturnType<typeof io>) => {
      const lastSeen = lastSeenMessageRef.current;
      socketInstance
        .timeout(5000)
        .emit(
          CHAT_EVENTS.sync,
          {
            coupleId,
            userId,
            lastMessageId: lastSeen?.id ?? null,
            sinceMs: lastSeen?.sentAtMs ?? null,
          },
          (error: Error | null, response: unknown) => {
            if (error) return;
            const payload = response as { messages?: ApiChatMessage[] } | ApiChatMessage[];
            const items = Array.isArray(payload)
              ? payload
              : payload?.messages ?? [];
            if (!Array.isArray(items)) return;
            items.forEach(handleIncomingMessage);
          }
        );
    },
    [coupleId, userId, handleIncomingMessage]
  );

  useEffect(() => {
    if (chatIdentity) return;
    const providerUserId = readProviderUserId();
    const controller = new AbortController();

    const fetchIdentity = async () => {
      try {
        const params = new URLSearchParams();
        if (providerUserId) {
          params.set("providerUserId", providerUserId);
        }
        const url = params.toString()
          ? `${chatIdentityUrl}?${params.toString()}`
          : chatIdentityUrl;
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          console.warn("Failed to fetch chat identity", response.statusText);
          return;
        }
        const payload = await response.json();
        const identity = payload?.identity;
        if (!identity?.coupleId || !identity?.userId) return;
        setChatIdentity({ coupleId: identity.coupleId, userId: identity.userId });
        if (typeof window !== "undefined") {
          window.localStorage.setItem("coupleId", identity.coupleId);
          window.localStorage.setItem("userId", identity.userId);
          if (identity.providerUserId) {
            window.localStorage.setItem("providerUserId", identity.providerUserId);
          }
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.warn("Failed to fetch chat identity", error);
      }
    };

    void fetchIdentity();

    return () => controller.abort();
  }, [chatIdentity, chatIdentityUrl]);

  useEffect(() => {
    if (!chatIdentity) return;

    const controller = new AbortController();

    const fetchMessages = async () => {
      try {
        const params = new URLSearchParams({
          coupleId: chatIdentity.coupleId,
          userId: chatIdentity.userId,
          limit: String(INITIAL_BATCH + LOAD_BATCH),
        });
        const response = await fetch(`${chatApiUrl}?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          console.warn("Failed to fetch chat messages", response.statusText);
          return;
        }
        const payload = await response.json();
        const items = Array.isArray(payload?.messages) ? payload.messages : [];
        const mapped = items
          .map((item: ApiChatMessage) => mapApiMessage(item))
          .filter(Boolean) as ChatMessage[];
        setAllMessages(mapped);
        seenMessageIdsRef.current = new Set(mapped.map((item) => item.id));
        if (mapped.length > 0) {
          const latest = mapped.reduce((current, next) =>
            next.sentAtMs > current.sentAtMs ? next : current
          );
          lastSeenMessageRef.current = { id: latest.id, sentAtMs: latest.sentAtMs };
        }
        setStartIndex(Math.max(0, mapped.length - INITIAL_BATCH));
        hasInitialScrollRef.current = false;
      } catch (error) {
        if (controller.signal.aborted) return;
        console.warn("Failed to fetch chat messages", error);
      }
    };

    void fetchMessages();

    return () => controller.abort();
  }, [chatApiUrl, chatIdentity, mapApiMessage]);

  useEffect(() => {
    if (!coupleId || !userId) return;
    isUnmountingRef.current = false;
    const socket = io(chatSocketUrl, {
      transports: ["websocket"],
      auth: { coupleId, userId },
      reconnection: false,
      autoConnect: true,
    });

    socketRef.current = socket;
    queueMicrotask(() => setConnectionStatus("connecting"));

    const handleConnect = () => {
      clearReconnectTimer();
      setConnectionStatus("connected");
      markActivity();
      sendJoin(socket);
      requestResync(socket);
    };

    const handleDisconnect = () => {
      if (isUnmountingRef.current) return;
      setConnectionStatus("offline");
      scheduleReconnect();
    };

    const handleError = (payload: unknown) => {
      console.warn("Chat socket error", payload);
      if (isUnmountingRef.current) return;
      setConnectionStatus("offline");
      scheduleReconnect();
    };

    const handleChatConnected = () => {
      markActivity();
      setConnectionStatus("connected");
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleError);
    socket.on(CHAT_EVENTS.connected, handleChatConnected);
    socket.on(CHAT_EVENTS.message, handleIncomingMessage);
    socket.on(CHAT_EVENTS.error, handleError);
    socket.on(CHAT_EVENTS.pong, markActivity);

    const engine = socket.io.engine;
    if (engine) {
      engine.on("ping", markActivity);
      engine.on("pong", markActivity);
    }

    healthcheckIntervalRef.current = setInterval(() => {
      const instance = socketRef.current;
      if (!instance || !instance.connected) return;
      if (Date.now() - lastActivityRef.current > HEALTHCHECK_STALE_MS) {
        instance.disconnect();
        scheduleReconnect();
      } else {
        instance.emit(CHAT_EVENTS.ping, { at: Date.now() });
      }
    }, HEALTHCHECK_INTERVAL_MS);

    return () => {
      isUnmountingRef.current = true;
      clearReconnectTimer();
      if (healthcheckIntervalRef.current) {
        clearInterval(healthcheckIntervalRef.current);
        healthcheckIntervalRef.current = null;
      }
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleError);
      socket.off(CHAT_EVENTS.connected, handleChatConnected);
      socket.off(CHAT_EVENTS.message, handleIncomingMessage);
      socket.off(CHAT_EVENTS.error, handleError);
      socket.off(CHAT_EVENTS.pong, markActivity);
      if (engine) {
        engine.off("ping", markActivity);
        engine.off("pong", markActivity);
      }
      socket.disconnect();
    };
  }, [
    chatSocketUrl,
    coupleId,
    userId,
    clearReconnectTimer,
    handleIncomingMessage,
    markActivity,
    requestResync,
    scheduleReconnect,
    sendJoin,
  ]);

  useLayoutEffect(() => {
    const inputBar = inputBarRef.current;
    if (!inputBar) return;

    const updateHeight = () => {
      setInputBarHeight(inputBar.getBoundingClientRect().height);
    };

    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(inputBar);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!window.visualViewport) return;

    const viewport = window.visualViewport;
    const updateInset = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setKeyboardInset(inset);
    };

    updateInset();

    viewport.addEventListener("resize", updateInset);
    viewport.addEventListener("scroll", updateInset);

    return () => {
      viewport.removeEventListener("resize", updateInset);
      viewport.removeEventListener("scroll", updateInset);
    };
  }, []);

  const loadOlderMessages = useCallback(() => {
    const list = messageListRef.current;
    if (!list || startIndex === 0 || isPrependingRef.current) return;

    const nextStartIndex = Math.max(0, startIndex - LOAD_BATCH);
    if (nextStartIndex === startIndex) return;

    isPrependingRef.current = true;
    previousScrollHeightRef.current = list.scrollHeight;
    setStartIndex(nextStartIndex);
  }, [startIndex]);

  const updateStickiness = useCallback(() => {
    const list = messageListRef.current;
    if (!list) return;

    const distanceFromBottom =
      list.scrollHeight - list.scrollTop - list.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom <= STICKY_BOTTOM_THRESHOLD;
  }, []);

  const handleScroll = useCallback(() => {
    const list = messageListRef.current;
    if (!list) return;

    updateStickiness();

    if (list.scrollTop <= SCROLL_THRESHOLD) {
      loadOlderMessages();
    }
  }, [loadOlderMessages, updateStickiness]);

  useLayoutEffect(() => {
    const list = messageListRef.current;
    if (!list) return;

    if (isPrependingRef.current && previousScrollHeightRef.current !== null) {
      const previousHeight = previousScrollHeightRef.current;
      const newHeight = list.scrollHeight;
      list.scrollTop += newHeight - previousHeight;
      previousScrollHeightRef.current = null;
      isPrependingRef.current = false;
    }

    const messageCount = sortedMessages.length;
    const previousCount = previousMessageCountRef.current;
    const didAppend = messageCount > previousCount && !isPrependingRef.current;

    if (!hasInitialScrollRef.current) {
      list.scrollTop = list.scrollHeight;
      hasInitialScrollRef.current = true;
      shouldStickToBottomRef.current = true;
    } else if (didAppend && shouldStickToBottomRef.current) {
      list.scrollTop = list.scrollHeight;
    }

    previousMessageCountRef.current = messageCount;
  }, [startIndex, sortedMessages.length]);

  const sendChatMessage = useCallback(
    async ({
      text,
      kind = "TEXT",
      imageUrl,
    }: {
      text?: string;
      kind?: "TEXT" | "IMAGE";
      imageUrl?: string;
    }) => {
      if (!coupleId || !userId) return;
      const clientMessageId = createClientMessageId();
      const sentAtMs = Date.now();

      appendMessage({
        id: clientMessageId,
        sender: "me",
        sentAtMs,
        kind: kind === "IMAGE" ? "image" : "text",
        text: text ?? undefined,
        imageSrc: imageUrl ?? undefined,
      });

      try {
        const response = await fetch(chatApiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            coupleId,
            senderUserId: userId,
            kind,
            text,
            imageUrl,
            clientMessageId,
            sentAtMs,
          }),
        });

        if (!response.ok) {
          console.warn("Failed to send chat message", response.statusText);
        }
      } catch (error) {
        console.warn("Failed to send chat message", error);
      }
    },
    [appendMessage, chatApiUrl, coupleId, userId]
  );

  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed) return;

    void sendChatMessage({ text: trimmed, kind: "TEXT" });
    setMessage("");
  }, [message, sendChatMessage]);

  const handleQuickMessage = useCallback(() => {
    void sendChatMessage({ text: "사진은 곧 공유할게!" });
  }, [sendChatMessage]);

  const connectionLabel = useMemo(() => {
    switch (connectionStatus) {
      case "connected":
        return "연결됨";
      case "reconnecting":
        return "재연결 중";
      case "offline":
        return "오프라인";
      default:
        return "연결 중";
    }
  }, [connectionStatus]);

  return (
    <div
      className={styles.chatTab}
      style={
        {
          "--input-bar-height": `${inputBarHeight}px`,
          "--keyboard-inset": `${keyboardInset}px`,
        } as CSSProperties
      }
    >
      <div className={styles.connectionStatus} data-status={connectionStatus}>
        <span className={styles.connectionDot} />
        {connectionLabel}
      </div>
      <div
        className={styles.messageList}
        ref={messageListRef}
        onScroll={handleScroll}
      >
        {visibleMessages.map((item) => (
          <div
            key={item.id}
            className={`${styles.messageRow} ${
              item.sender === "me" ? styles.messageRowMine : styles.messageRowPartner
            }`}
          >
            <div
              className={`${styles.messageBubble} ${
                item.sender === "me" ? styles.messageBubbleMine : styles.messageBubblePartner
              }`}
            >
              {item.kind === "text" ? (
                item.text
              ) : (
                <img
                  className={styles.messageImage}
                  src={item.imageSrc}
                  alt="공유된 이미지"
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.inputBar} ref={inputBarRef}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Add"
          onClick={handleQuickMessage}
        >
          <Plus className={styles.icon} />
        </button>
        <input
          className={styles.input}
          placeholder="메시지를 입력하세요"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <button
          type="button"
          className={styles.sendButton}
          aria-label="Send"
          onClick={handleSend}
        >
          <Send className={styles.icon} />
        </button>
      </div>
    </div>
  );
}
