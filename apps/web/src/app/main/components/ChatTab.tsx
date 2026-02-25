"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

export default function ChatTab() {
  const [message, setMessage] = useState("");
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [inputBarHeight, setInputBarHeight] = useState(0);
  const inputBarRef = useRef<HTMLDivElement | null>(null);

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

  const messageListPaddingBottom = inputBarHeight + keyboardInset + 12;

  return (
    <div className={styles.chatTab}>
      <div
        className={styles.messageList}
        style={{ paddingBottom: messageListPaddingBottom }}
      >
        {seedMessages.map((item) => (
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

      <div
        className={styles.inputBar}
        ref={inputBarRef}
        style={{
          transform: keyboardInset ? `translateY(-${keyboardInset}px)` : undefined,
        }}
      >
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
