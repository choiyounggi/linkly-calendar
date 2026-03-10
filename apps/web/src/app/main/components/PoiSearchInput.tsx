"use client";

import { useEffect, useRef, useState } from "react";
import { usePoiSearch, type PoiResult } from "../../../hooks/usePoiSearch";
import styles from "./PoiSearchInput.module.css";

interface PoiSearchInputProps {
  value: string;
  onSelect: (poi: PoiResult) => void;
  onClear: () => void;
  placeholder?: string;
}

export default function PoiSearchInput({
  value,
  onSelect,
  onClear,
  placeholder = "장소 검색",
}: PoiSearchInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const { results, loading, search, clear } = usePoiSearch();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (text: string) => {
    setInputValue(text);
    if (text.trim()) {
      search(text);
      setIsOpen(true);
    } else {
      clear();
      onClear();
      setIsOpen(false);
    }
  };

  const handleSelect = (poi: PoiResult) => {
    setInputValue(poi.name);
    setIsOpen(false);
    clear();
    onSelect(poi);
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => handleInputChange(e.target.value)}
        placeholder={placeholder}
        className={styles.input}
      />
      {isOpen && (results.length > 0 || loading) && (
        <ul className={styles.dropdown}>
          {loading && <li className={styles.loading}>검색 중...</li>}
          {results.map((poi, idx) => (
            <li key={`${poi.name}-${idx}`} className={styles.item} onClick={() => handleSelect(poi)}>
              <span className={styles.name}>{poi.name}</span>
              <span className={styles.address}>{poi.address}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
