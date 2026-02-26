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

type Message = {
  id: number;
  text: string;
  sender: "me" | "partner";
};

const seedMessages: Message[] = [
  { id: 1, text: "오늘 일정 어때?", sender: "partner" },
  { id: 2, text: "저녁 7시에 가능해!", sender: "me" },
  { id: 3, text: "좋아, 그럼 카페에서 만나자.", sender: "partner" },
  { id: 4, text: "오케이! 기대돼 😊", sender: "me" },
];

const INITIAL_BATCH = 30;
const LOAD_BATCH = 20;
const SCROLL_THRESHOLD = 80;

const buildDummyMessages = () => {
  const messages: Message[] = [];
  let id = 1;

  for (let index = 0; index < 60; index += 1) {
    for (const seed of seedMessages) {
      messages.push({
        id,
        text: `${seed.text} (#${index + 1})`,
        sender: seed.sender,
      });
      id += 1;
    }
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
  const previousScrollHeightRef = useRef<number | null>(null);
  const hasInitialScrollRef = useRef(false);

  const allMessages = useMemo(() => buildDummyMessages(), []);
  const initialStartIndex = useMemo(
    () => Math.max(0, allMessages.length - INITIAL_BATCH),
    [allMessages]
  );
  const [startIndex, setStartIndex] = useState(initialStartIndex);

  const visibleMessages = useMemo(
    () => allMessages.slice(startIndex),
    [allMessages, startIndex]
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

  const handleScroll = useCallback(() => {
    const list = messageListRef.current;
    if (!list) return;

    if (list.scrollTop <= SCROLL_THRESHOLD) {
      loadOlderMessages();
    }
  }, [loadOlderMessages]);

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

    if (!hasInitialScrollRef.current) {
      list.scrollTop = list.scrollHeight;
      hasInitialScrollRef.current = true;
    }
  }, [startIndex]);

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
              {item.text}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.inputBar} ref={inputBarRef}>
        <button type="button" className={styles.iconButton} aria-label="Add">
          <Plus className={styles.icon} />
        </button>
        <input
          className={styles.input}
          placeholder="메시지를 입력하세요"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <button type="button" className={styles.sendButton} aria-label="Send">
          <Send className={styles.icon} />
        </button>
      </div>
    </div>
  );
}
