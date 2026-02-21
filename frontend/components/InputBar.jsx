"use client";

/**
 * InputBar — Floating Input Bar
 *
 * Bottom-center floating input where users paste URLs, type notes,
 * or drop content. Triggers card generation.
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const styles = {
    wrapper: {
        position: "fixed",
        bottom: 28,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
    },
    bar: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 8px 8px 20px",
        background: "rgba(22, 22, 35, 0.9)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid var(--border-glow)",
        borderRadius: 999,
        boxShadow: "0 8px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.06)",
        width: 520,
        maxWidth: "calc(100vw - 40px)",
    },
    input: {
        flex: 1,
        padding: "10px 0",
        fontSize: 14,
        color: "var(--text-primary)",
        background: "transparent",
        border: "none",
        outline: "none",
        fontFamily: "inherit",
        caretColor: "var(--accent-purple)",
    },
    button: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 40,
        height: 40,
        borderRadius: "50%",
        border: "none",
        cursor: "pointer",
        fontSize: 18,
        transition: "all var(--transition-fast)",
    },
    submitBtn: {
        background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))",
        color: "white",
    },
    submitBtnDisabled: {
        background: "var(--bg-input)",
        color: "var(--text-muted)",
        cursor: "not-allowed",
    },
    typeToggle: {
        display: "flex",
        gap: 4,
        padding: "4px",
        background: "var(--bg-input)",
        borderRadius: 999,
    },
    typeBtn: {
        padding: "4px 10px",
        fontSize: 11,
        fontWeight: 500,
        borderRadius: 999,
        border: "none",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all var(--transition-fast)",
    },
    loadingDots: {
        display: "flex",
        gap: 4,
        padding: "0 12px",
    },
    hint: {
        fontSize: 11,
        color: "var(--text-muted)",
        letterSpacing: "0.02em",
    },
};

export default function InputBar({ onSubmit, isLoading }) {
    const [content, setContent] = useState("");
    const [contentType, setContentType] = useState("text");

    const handleSubmit = useCallback(
        (e) => {
            e.preventDefault();
            if (content.trim() && !isLoading) {
                // Auto-detect URL
                const type = content.trim().startsWith("http") ? "url" : contentType;
                onSubmit(content.trim(), type);
                setContent("");
            }
        },
        [content, contentType, isLoading, onSubmit]
    );

    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                handleSubmit(e);
            }
        },
        [handleSubmit]
    );

    const handlePaste = useCallback((e) => {
        const pasted = e.clipboardData.getData("text");
        if (pasted.startsWith("http")) {
            setContentType("url");
        }
    }, []);

    return (
        <div style={styles.wrapper}>
            {/* Type toggle */}
            <div style={styles.typeToggle}>
                {["text", "url", "note"].map((type) => (
                    <button
                        key={type}
                        onClick={() => setContentType(type)}
                        style={{
                            ...styles.typeBtn,
                            background: contentType === type ? "var(--accent-purple)" : "transparent",
                            color: contentType === type ? "white" : "var(--text-muted)",
                        }}
                    >
                        {type === "text" ? "✍️ Text" : type === "url" ? "🔗 URL" : "📝 Note"}
                    </button>
                ))}
            </div>

            {/* Input bar */}
            <form onSubmit={handleSubmit} style={styles.bar}>
                <input
                    type="text"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder={
                        contentType === "url"
                            ? "Paste a URL (Zillow, Yelp, Airbnb...)"
                            : contentType === "note"
                                ? "Add a note or requirement..."
                                : "Drop an idea, link, or thought..."
                    }
                    style={styles.input}
                    disabled={isLoading}
                />

                {isLoading ? (
                    <div style={styles.loadingDots}>
                        {[0, 1, 2].map((i) => (
                            <motion.div
                                key={i}
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                                style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    background: "var(--accent-purple)",
                                }}
                            />
                        ))}
                    </div>
                ) : (
                    <button
                        type="submit"
                        disabled={!content.trim()}
                        style={{
                            ...styles.button,
                            ...(content.trim() ? styles.submitBtn : styles.submitBtnDisabled),
                        }}
                    >
                        ↑
                    </button>
                )}
            </form>

            <span style={styles.hint}>
                Drop anything — Claude turns it into a card
            </span>
        </div>
    );
}
