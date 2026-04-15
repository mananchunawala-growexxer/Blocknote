import React, { useState, useEffect, useRef } from "react";
import type { BlockType } from "../types/block";

interface SlashMenuProps {
  blockId: string;
  position: { top: number; left: number };
  onSelectType: (type: BlockType) => void;
  onClose: (clearText?: boolean) => void;
}

const BLOCK_MENU_ITEMS: Array<{ type: BlockType; label: string; description: string; icon: string }> = [
  { type: "paragraph", label: "Paragraph", description: "Start typing", icon: "¶" },
  { type: "heading_1", label: "Heading 1", description: "Large title", icon: "H1" },
  { type: "heading_2", label: "Heading 2", description: "Medium title", icon: "H2" },
  { type: "todo", label: "To-do", description: "Checkbox with text", icon: "☑" },
  { type: "code", label: "Code", description: "Monospace text", icon: "<>" },
  { type: "divider", label: "Divider", description: "Horizontal line", icon: "─" },
  { type: "image", label: "Image", description: "Embed image from URL", icon: "▣" },
];

/**
 * SlashMenu component
 * Shows when user types "/" in empty block
 * Allows filtering by typing (e.g. "/hea" → headings)
 * "/" and filter text NOT persisted in block content
 */
export const SlashMenu: React.FC<SlashMenuProps> = ({ blockId, position, onSelectType, onClose }) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Filter items based on query
  const filteredItems = BLOCK_MENU_ITEMS.filter(
    (item) =>
      item.label.toLowerCase().includes(query.toLowerCase()) ||
      item.description.toLowerCase().includes(query.toLowerCase()),
  );

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose(true);
        return;
      }

      if (e.key === "ArrowDown") {
        if (filteredItems.length === 0) return;
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
        return;
      }

      if (e.key === "ArrowUp") {
        if (filteredItems.length === 0) return;
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          onSelectType(filteredItems[selectedIndex].type);
        }
        return;
      }

      // Regular character input → filter
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // "/" is only the command trigger, not a searchable character.
        if (e.key === "/") {
          return;
        }
        setQuery((prev) => prev + e.key);
        setSelectedIndex(0);
        return;
      }

      // Backspace → remove from query
      if (e.key === "Backspace") {
        setQuery((prev) => prev.slice(0, -1));
        setSelectedIndex(0);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredItems, selectedIndex, onSelectType, onClose]);

  // Auto-close if no results
  useEffect(() => {
    if (filteredItems.length === 0 && query.length > 0) {
      // Keep menu open but show "No results"
    }
  }, [filteredItems, query]);

  return (
    <div
      ref={menuRef}
      className="slash-menu"
      data-anchor-block-id={blockId}
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <div className="slash-menu-header">
        <span>/ {query || "commands"}</span>
      </div>

      {filteredItems.length === 0 ? (
        <div className="slash-menu-empty">No block types match "{query}"</div>
      ) : (
        <ul className="slash-menu-items">
          {filteredItems.map((item, index) => (
            <li
              key={item.type}
              className={`slash-menu-item ${index === selectedIndex ? "selected" : ""}`}
              onClick={() => onSelectType(item.type)}
            >
              <span className="slash-menu-item-icon" aria-hidden="true">
                {item.icon}
              </span>
              <div className="slash-menu-item-copy">
                <div className="slash-menu-item-label">{item.label}</div>
                <div className="slash-menu-item-description">{item.description}</div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="slash-menu-footer">
        <span className="hint">↑↓ Navigate • Enter Select • Esc Close</span>
      </div>
    </div>
  );
};
