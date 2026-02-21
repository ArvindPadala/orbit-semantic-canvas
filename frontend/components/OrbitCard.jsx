"use client";

/**
 * OrbitCard — Dynamic Card Component
 *
 * Renders Claude-generated cards with interactive widgets.
 * Each card type gets a unique widget layout based on its category.
 */

import { memo, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { motion } from "framer-motion";

const styles = {
    card: {
        width: 280,
        padding: 0,
        borderRadius: "var(--radius-lg)",
        background: "var(--bg-card)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "var(--border-subtle)",
        boxShadow: "var(--shadow-card)",
        overflow: "hidden",
        cursor: "grab",
        transition: "box-shadow var(--transition-smooth), border-color var(--transition-smooth)",
        userSelect: "none",
    },
    cardHover: {
        boxShadow: "var(--shadow-card-hover)",
        borderColor: "var(--border-glow)",
    },
    header: {
        padding: "14px 16px 10px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        borderBottom: "1px solid var(--border-subtle)",
    },
    icon: {
        fontSize: 24,
        lineHeight: 1,
    },
    titleWrap: {
        flex: 1,
        minWidth: 0,
    },
    title: {
        fontSize: 14,
        fontWeight: 600,
        color: "var(--text-primary)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    category: {
        fontSize: 11,
        fontWeight: 500,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        marginTop: 2,
    },
    body: {
        padding: "10px 16px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
    },
    summary: {
        fontSize: 12,
        lineHeight: 1.5,
        color: "var(--text-secondary)",
    },
    widget: {
        display: "flex",
        flexDirection: "column",
        gap: 4,
    },
    widgetLabel: {
        fontSize: 11,
        fontWeight: 500,
        color: "var(--text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
    },
    slider: {
        width: "100%",
        height: 4,
        borderRadius: 2,
        background: "var(--bg-input)",
        appearance: "none",
        WebkitAppearance: "none",
        outline: "none",
        cursor: "pointer",
    },
    stars: {
        display: "flex",
        gap: 2,
        fontSize: 14,
    },
    tags: {
        display: "flex",
        flexWrap: "wrap",
        gap: 4,
    },
    tag: {
        fontSize: 11,
        padding: "3px 8px",
        borderRadius: 99,
        background: "var(--bg-input)",
        color: "var(--text-secondary)",
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "var(--border-subtle)",
    },
    textValue: {
        fontSize: 13,
        color: "var(--text-primary)",
    },
    colorDot: {
        display: "flex",
        alignItems: "center",
        gap: 8,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: "50%",
    },
    priceValue: {
        fontSize: 18,
        fontWeight: 700,
        color: "var(--text-primary)",
        letterSpacing: "-0.02em",
    },
    progressBar: {
        width: "100%",
        height: 6,
        borderRadius: 3,
        background: "var(--bg-input)",
        overflow: "hidden",
    },
    progressFill: {
        height: "100%",
        borderRadius: 3,
        transition: "width var(--transition-smooth)",
    },
    accentBar: {
        height: 3,
        width: "100%",
    },
    loadingSkeleton: {
        width: 280,
        padding: 20,
        borderRadius: "var(--radius-lg)",
        background: "var(--bg-card)",
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "var(--border-subtle)",
    },
    deleteBtn: {
        position: "absolute",
        top: 8,
        right: 8,
        width: 24,
        height: 24,
        borderRadius: "50%",
        background: "rgba(239, 68, 68, 0.15)",
        border: "1px solid rgba(239, 68, 68, 0.3)",
        color: "rgba(239, 68, 68, 0.8)",
        fontSize: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "all 0.2s ease",
        zIndex: 10,
        lineHeight: 1,
    },
    deleteBtnHover: {
        background: "rgba(239, 68, 68, 0.3)",
        borderColor: "rgba(239, 68, 68, 0.6)",
        color: "#ef4444",
        transform: "scale(1.1)",
    },
    shimmerLine: {
        height: 12,
        borderRadius: 4,
        background: "linear-gradient(90deg, var(--bg-input) 0%, rgba(139,92,246,0.08) 50%, var(--bg-input) 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s ease-in-out infinite",
    },
};

function WidgetRenderer({ widget, accentColor }) {
    switch (widget.type) {
        case "slider":
            return (
                <div style={styles.widget}>
                    <span style={styles.widgetLabel}>
                        {widget.icon && `${widget.icon} `}{widget.label}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                            type="range"
                            min={widget.min || 0}
                            max={widget.max || 100}
                            defaultValue={widget.value || 50}
                            style={{
                                ...styles.slider,
                                accentColor: accentColor,
                            }}
                            onClick={(e) => e.stopPropagation()}
                        />
                        <span style={{ fontSize: 12, color: "var(--text-secondary)", minWidth: 28, textAlign: "right" }}>
                            {widget.value ?? "–"}
                        </span>
                    </div>
                </div>
            );

        case "rating":
            const rating = typeof widget.value === "number" ? widget.value : 0;
            return (
                <div style={styles.widget}>
                    <span style={styles.widgetLabel}>{widget.label}</span>
                    <div style={styles.stars}>
                        {[1, 2, 3, 4, 5].map((star) => (
                            <span
                                key={star}
                                style={{ opacity: star <= rating ? 1 : 0.2, filter: star <= rating ? "none" : "grayscale(1)" }}
                            >
                                ⭐
                            </span>
                        ))}
                    </div>
                </div>
            );

        case "tags":
            const tagValues = Array.isArray(widget.value) ? widget.value : [];
            return (
                <div style={styles.widget}>
                    <span style={styles.widgetLabel}>{widget.label}</span>
                    <div style={styles.tags}>
                        {tagValues.map((tag, i) => (
                            <span key={i} style={{ ...styles.tag, borderColor: accentColor + "33" }}>
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            );

        case "text":
            return (
                <div style={styles.widget}>
                    <span style={styles.widgetLabel}>{widget.label}</span>
                    <span style={styles.textValue}>{widget.value || "–"}</span>
                </div>
            );

        case "color_indicator":
            return (
                <div style={styles.widget}>
                    <span style={styles.widgetLabel}>{widget.label}</span>
                    <div style={styles.colorDot}>
                        <span style={{ ...styles.dot, background: widget.color || accentColor }} />
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{widget.value || "–"}</span>
                    </div>
                </div>
            );

        case "price":
            return (
                <div style={styles.widget}>
                    <span style={styles.widgetLabel}>{widget.label}</span>
                    <span style={{ ...styles.priceValue, color: accentColor }}>{widget.value || "$–"}</span>
                </div>
            );

        case "progress":
            const progressVal = typeof widget.value === "number" ? widget.value : 0;
            return (
                <div style={styles.widget}>
                    <span style={styles.widgetLabel}>{widget.label} — {progressVal}%</span>
                    <div style={styles.progressBar}>
                        <div
                            style={{
                                ...styles.progressFill,
                                width: `${progressVal}%`,
                                background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)`,
                            }}
                        />
                    </div>
                </div>
            );

        case "toggle":
            return (
                <div style={styles.widget}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={styles.widgetLabel}>{widget.label}</span>
                        <div
                            style={{
                                width: 36,
                                height: 20,
                                borderRadius: 10,
                                background: widget.value ? accentColor : "var(--bg-input)",
                                position: "relative",
                                transition: "background var(--transition-fast)",
                                cursor: "pointer",
                            }}
                        >
                            <div
                                style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: "50%",
                                    background: "white",
                                    position: "absolute",
                                    top: 2,
                                    left: widget.value ? 18 : 2,
                                    transition: "left var(--transition-fast)",
                                }}
                            />
                        </div>
                    </div>
                </div>
            );

        default:
            return null;
    }
}

function OrbitCardNode({ data, id }) {
    const [isHovered, setIsHovered] = useState(false);
    const [deleteHovered, setDeleteHovered] = useState(false);
    const { card, fadedOut, onDelete } = data;

    // Loading state
    if (data.loading) {
        return (
            <div style={styles.loadingSkeleton} className="loading-shimmer">
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <div style={{ ...styles.shimmerLine, width: 28, height: 28, borderRadius: "50%" }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ ...styles.shimmerLine, width: "70%", marginBottom: 6 }} />
                        <div style={{ ...styles.shimmerLine, width: "40%", height: 8 }} />
                    </div>
                </div>
                <div style={{ ...styles.shimmerLine, width: "100%", marginBottom: 8 }} />
                <div style={{ ...styles.shimmerLine, width: "85%", marginBottom: 12 }} />
                <div style={{ ...styles.shimmerLine, width: "60%", height: 20, borderRadius: 10 }} />
            </div>
        );
    }

    if (!card) return null;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{
                opacity: fadedOut ? 0.25 : 1,
                scale: fadedOut ? 0.92 : 1,
                y: 0,
            }}
            transition={{
                type: "spring",
                stiffness: 300,
                damping: 25,
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => { setIsHovered(false); setDeleteHovered(false); }}
            style={{
                ...styles.card,
                ...(isHovered ? styles.cardHover : {}),
                ...(fadedOut ? { filter: "grayscale(0.5)" } : {}),
                position: "relative",
            }}
        >
            {/* Delete button — appears on hover */}
            {isHovered && onDelete && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                        ...styles.deleteBtn,
                        ...(deleteHovered ? styles.deleteBtnHover : {}),
                    }}
                    onMouseEnter={() => setDeleteHovered(true)}
                    onMouseLeave={() => setDeleteHovered(false)}
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(id);
                    }}
                >
                    ✕
                </motion.div>
            )}
            {/* Accent bar at top */}
            <div style={{ ...styles.accentBar, background: `linear-gradient(90deg, ${card.color}, ${card.color}44)` }} />

            {/* Header */}
            <div style={styles.header}>
                <span style={styles.icon}>{card.icon}</span>
                <div style={styles.titleWrap}>
                    <div style={styles.title}>{card.title}</div>
                    <div style={{ ...styles.category, color: card.color }}>{card.category}</div>
                </div>
            </div>

            {/* Body — Summary + Widgets */}
            <div style={styles.body}>
                <p style={styles.summary}>{card.summary}</p>

                {card.widgets &&
                    card.widgets.map((widget, idx) => (
                        <WidgetRenderer key={idx} widget={widget} accentColor={card.color} />
                    ))}
            </div>

            {/* Connection handles (invisible, for potential future edges) */}
            <Handle type="source" position={Position.Right} style={{ opacity: 0, pointerEvents: "none" }} />
            <Handle type="target" position={Position.Left} style={{ opacity: 0, pointerEvents: "none" }} />
        </motion.div>
    );
}

export default memo(OrbitCardNode);
