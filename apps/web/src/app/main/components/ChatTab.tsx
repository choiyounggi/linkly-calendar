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
import styles from "./ChatTab.module.css";

type ChatMessage = {
  id: string;
  sender: "me" | "partner";
  sentAtMs: number;
  kind: "text" | "image";
  text?: string;
  imageSrc?: string;
};

const seedMessages: Array<Pick<ChatMessage, "sender" | "kind" | "text" | "imageSrc">> = [
  { sender: "partner", kind: "text", text: "오늘 일정 어때?" },
  { sender: "me", kind: "text", text: "저녁 7시에 가능해!" },
  { sender: "partner", kind: "text", text: "좋아, 그럼 카페에서 만나자." },
  { sender: "me", kind: "text", text: "오케이! 기대돼 😊" },
  {
    sender: "partner",
    kind: "image",
    imageSrc: "https://placehold.co/320x200?text=Chat+Photo",
  },
];

const INITIAL_BATCH = 30;
const LOAD_BATCH = 20;
const SCROLL_THRESHOLD = 80;
const STICKY_BOTTOM_THRESHOLD = 32;
const TOTAL_MESSAGES = 200;

const buildDummyMessages = () => {
  const messages: ChatMessage[] = [];
  const startTime = Date.now() - TOTAL_MESSAGES * 60_000;

  for (let index = 0; index < TOTAL_MESSAGES; index += 1) {
    const seed = seedMessages[index % seedMessages.length];
    const sentAtMs = startTime + index * 60_000;

    messages.push({
      id: `msg-${index + 1}`,
      sender: seed.sender,
      sentAtMs,
      kind: seed.kind,
      text: seed.kind === "text" ? `${seed.text} (#${index + 1})` : undefined,
      imageSrc: seed.kind === "image" ? seed.imageSrc : undefined,
    });
  }

  return messages;
};

export default function ChatTab() {
  const [message, setMessage] = useState("");
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [inputBarHeight, setInputBarHeight] = useState(0);
  const inputBarRef = useRef<HTMLDivElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const isPrependingRef = useRef(false);
  const shouldStickToBottomRef = useRef(true);
  const previousScrollHeightRef = useRef<number | null>(null);
  const previousMessageCountRef = useRef(0);
  const hasInitialScrollRef = useRef(false);

  const [allMessages, setAllMessages] = useState<ChatMessage[]>(() => buildDummyMessages());
  const sortedMessages = useMemo(
    () => [...allMessages].sort((a, b) => a.sentAtMs - b.sentAtMs),
    [allMessages]
  );
  const initialStartIndex = useMemo(
    () => Math.max(0, sortedMessages.length - INITIAL_BATCH),
    [sortedMessages.length]
  );
  const [startIndex, setStartIndex] = useState(initialStartIndex);

  const visibleMessages = useMemo(
    () => sortedMessages.slice(startIndex),
    [sortedMessages, startIndex]
  );

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
      const inset = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop
      );
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

  const appendMessage = useCallback((nextMessage: ChatMessage) => {
    setAllMessages((prev) => [...prev, nextMessage]);
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed) return;

    appendMessage({
      id: `msg-${Date.now()}`,
      sender: "me",
      sentAtMs: Date.now(),
      kind: "text",
      text: trimmed,
    });
    setMessage("");
  }, [appendMessage, message]);

  const handleAddMessage = useCallback(() => {
    appendMessage({
      id: `msg-${Date.now()}-partner`,
      sender: "partner",
      sentAtMs: Date.now(),
      kind: "text",
      text: "새 메시지가 도착했어요!",
    });
  }, [appendMessage]);

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
          onClick={handleAddMessage}
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
