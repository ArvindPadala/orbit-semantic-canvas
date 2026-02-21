"use client";

import { memo, useMemo } from "react";
import { useNodes } from "@xyflow/react";
import { motion } from "framer-motion";

const styles = {
    magnet: {
        width: 200,
        borderRadius: "var(--radius-lg)",
        background: "linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(5, 150, 105, 0.12))",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(16, 185, 129, 0.25)",
        overflow: "hidden",
        cursor: "grab",
        boxShadow: "0 8px 32px rgba(16, 185, 129, 0.15)",
    },
    header: {
        padding: "12px 14px 8px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        borderBottom: "1px solid rgba(16, 185, 129, 0.15)",
    },
    icon: {
        fontSize: 20,
    },
    title: {
        fontSize: 12,
        fontWeight: 600,
        color: "var(--accent-green)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
    },
    body: {
        padding: "10px 14px 14px",
    },
    total: {
        fontSize: 28,
        fontWeight: 700,
        color: "var(--text-primary)",
        textAlign: "center",
        margin: "10px 0",
        textShadow: "0 2px 10px rgba(16, 185, 129, 0.3)",
    },
    hint: {
        fontSize: 10,
        color: "var(--text-muted)",
        textAlign: "center",
    },
};

function BudgetMagnetNode({ data, id }) {
    const nodes = useNodes();

    // Calculate total budget from all non-faded cards
    const total = useMemo(() => {
        let sum = 0;
        nodes.forEach(node => {
            if (node.type === "orbitCard" && !node.data.fadedOut) {
                const widgets = node.data.cardData?.widgets || [];
                widgets.forEach(w => {
                    if (w.type === "price" || w.type === "slider") {
                        // Extract number from string like "$150/night" or "$400 roundtrip"
                        // Or from a slider if it represents price (often we have price slider)
                        if (w.type === "price") {
                            const match = String(w.value).match(/[\d,]+(\.\d+)?/);
                            if (match) {
                                sum += parseFloat(match[0].replace(/,/g, ''));
                            }
                        } else if (w.type === "slider" && w.label && w.label.toLowerCase().includes("price")) {
                            sum += parseFloat(w.value) || 0;
                        }
                    }
                });
            }
        });
        return sum;
    }, [nodes]);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.6, rotate: 5 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{
                type: "spring",
                stiffness: 400,
                damping: 20,
            }}
            style={styles.magnet}
            className="budget-magnet-node" // Give it a class to allow easy dragging in xyflow
        >
            <div style={styles.header}>
                <span style={styles.icon}>💰</span>
                <span style={styles.title}>Est. Budget</span>
            </div>

            <div style={styles.body}>
                <div style={styles.total}>
                    ${total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </div>
                <div style={styles.hint}>
                    Sums all visible prices
                </div>
            </div>
        </motion.div>
    );
}

export default memo(BudgetMagnetNode);
