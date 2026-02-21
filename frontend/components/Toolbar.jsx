"use client";

/**
 * Toolbar — Side Toolbar
 *
 * Floating toolbar with action buttons:
 * - Add Magnet
 * - Re-orbit (recalculate gravity)
 * - Clear Canvas
 * - Connection status indicator
 */

import { motion } from "framer-motion";

const styles = {
    toolbar: {
        position: "fixed",
        top: "50%",
        left: 20,
        transform: "translateY(-50%)",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: 6,
        background: "rgba(22, 22, 35, 0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-card)",
    },
    button: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 44,
        height: 44,
        borderRadius: "var(--radius-md)",
        border: "none",
        cursor: "pointer",
        fontSize: 20,
        background: "transparent",
        color: "var(--text-secondary)",
        transition: "all var(--transition-fast)",
        position: "relative",
    },
    tooltip: {
        position: "absolute",
        left: "calc(100% + 10px)",
        top: "50%",
        transform: "translateY(-50%)",
        padding: "5px 10px",
        fontSize: 11,
        fontWeight: 500,
        color: "var(--text-primary)",
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-sm)",
        whiteSpace: "nowrap",
        pointerEvents: "none",
        boxShadow: "var(--shadow-card)",
    },
    divider: {
        width: "80%",
        height: 1,
        background: "var(--border-subtle)",
        margin: "2px auto",
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: "50%",
        margin: "0 auto",
    },
};

function ToolButton({ icon, label, onClick, disabled, color }) {
    return (
        <motion.button
            whileHover={{ scale: 1.05, background: "rgba(255,255,255,0.06)" }}
            whileTap={{ scale: 0.95 }}
            style={{
                ...styles.button,
                ...(disabled ? { opacity: 0.4, cursor: "not-allowed" } : {}),
                ...(color ? { color } : {}),
            }}
            onClick={disabled ? undefined : onClick}
            title={label}
        >
            {icon}
        </motion.button>
    );
}

export default function Toolbar({ onAddMagnet, onReorbit, onClear, cardCount, status }) {
    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 25 }}
            style={styles.toolbar}
        >
            <ToolButton
                icon="🧲"
                label="Add Magnet"
                onClick={onAddMagnet}
            />

            <ToolButton
                icon="🌀"
                label="Re-orbit (recalculate gravity)"
                onClick={onReorbit}
                disabled={cardCount < 2}
            />

            <div style={styles.divider} />

            <ToolButton
                icon="🗑️"
                label="Clear Canvas"
                onClick={onClear}
                disabled={cardCount === 0}
                color="var(--accent-pink)"
            />

            <div style={styles.divider} />

            {/* Status indicator */}
            <div
                style={{
                    ...styles.button,
                    cursor: "default",
                    flexDirection: "column",
                    gap: 4,
                }}
                title={`Backend: ${status?.status || "unknown"}`}
            >
                <div
                    style={{
                        ...styles.statusDot,
                        background:
                            status?.status === "ok"
                                ? "var(--accent-green)"
                                : status?.status === "degraded"
                                    ? "var(--accent-amber)"
                                    : "var(--accent-pink)",
                    }}
                />
                <span style={{ fontSize: 9, color: "var(--text-muted)" }}>
                    {cardCount}
                </span>
            </div>
        </motion.div>
    );
}
