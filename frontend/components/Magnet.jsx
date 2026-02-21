"use client";

/**
 * Magnet — Filter Tool Component
 *
 * A draggable magnet widget users can place on the canvas.
 * Type a constraint, and matching cards get pulled toward it.
 */

import { memo, useState, useCallback } from "react";
import { Handle, Position } from "@xyflow/react";
import { motion } from "framer-motion";

const styles = {
    magnet: {
        width: 220,
        borderRadius: "var(--radius-lg)",
        background: "linear-gradient(135deg, rgba(236, 72, 153, 0.12), rgba(139, 92, 246, 0.12))",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(236, 72, 153, 0.25)",
        overflow: "hidden",
        cursor: "grab",
    },
    header: {
        padding: "12px 14px 8px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        borderBottom: "1px solid rgba(236, 72, 153, 0.15)",
    },
    icon: {
        fontSize: 20,
    },
    title: {
        fontSize: 12,
        fontWeight: 600,
        color: "var(--accent-pink)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
    },
    body: {
        padding: "10px 14px 14px",
    },
    input: {
        width: "100%",
        padding: "8px 12px",
        fontSize: 13,
        color: "var(--text-primary)",
        background: "rgba(255, 255, 255, 0.06)",
        border: "1px solid rgba(236, 72, 153, 0.2)",
        borderRadius: "var(--radius-sm)",
        outline: "none",
        fontFamily: "inherit",
        transition: "border-color var(--transition-fast)",
    },
    hint: {
        fontSize: 10,
        color: "var(--text-muted)",
        marginTop: 6,
        textAlign: "center",
    },
    active: {
        animation: "magnet-pulse 2s ease-in-out infinite",
    },
};

function MagnetNode({ data, id }) {
    const [constraint, setConstraint] = useState(data.constraint || "");
    const [isActive, setIsActive] = useState(false);

    const handleSubmit = useCallback(
        (e) => {
            e.preventDefault();
            if (constraint.trim() && data.onActivate) {
                setIsActive(true);
                data.onActivate(id, constraint.trim());
            }
        },
        [constraint, data, id]
    );

    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === "Enter") {
                handleSubmit(e);
            }
            // Prevent xyflow from capturing keyboard events
            e.stopPropagation();
        },
        [handleSubmit]
    );

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.6, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{
                type: "spring",
                stiffness: 400,
                damping: 20,
            }}
            style={{
                ...styles.magnet,
                ...(isActive ? styles.active : {}),
            }}
        >
            <div style={styles.header}>
                <span style={styles.icon}>🧲</span>
                <span style={styles.title}>Magnet Filter</span>
            </div>

            <div style={styles.body}>
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        value={constraint}
                        onChange={(e) => setConstraint(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Type a constraint..."
                        style={{
                            ...styles.input,
                            borderColor: isActive ? "rgba(236, 72, 153, 0.5)" : "rgba(236, 72, 153, 0.2)",
                        }}
                    />
                </form>
                <div style={styles.hint}>
                    {isActive ? "🔴 Active — pulling matching cards" : "Press Enter to activate"}
                </div>
            </div>

            <Handle type="source" position={Position.Right} style={{ opacity: 0, pointerEvents: "none" }} />
            <Handle type="target" position={Position.Left} style={{ opacity: 0, pointerEvents: "none" }} />
        </motion.div>
    );
}

export default memo(MagnetNode);
