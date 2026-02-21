"use client";

/**
 * Canvas — Main Canvas Component
 *
 * The heart of Orbit. Uses @xyflow/react for the 2D draggable canvas.
 * Orchestrates:
 * - Node rendering (cards + magnets)
 * - Drop zone for paste/input
 * - Gravity simulation (reads similarity scores, animates positions)
 * - Magnet filtering
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
    ReactFlow,
    ReactFlowProvider,
    Background,
    Controls,
    useNodesState,
    useEdgesState,
    BackgroundVariant,
} from "@xyflow/react";
import { AnimatePresence, motion } from "framer-motion";

import OrbitCardNode from "./OrbitCard";
import MagnetNode from "./Magnet";
import InputBar from "./InputBar";
import Toolbar from "./Toolbar";
import { useGravity } from "@/hooks/useGravity";
import { generateCard, applyMagnet, healthCheck } from "@/lib/api";

// Register custom node types
const nodeTypes = {
    orbitCard: OrbitCardNode,
    magnet: MagnetNode,
};

// Grid-based position to avoid overlaps
let cardIndex = 0;
function nextPosition() {
    const cols = 3;
    const spacingX = 340;
    const spacingY = 420;
    const startX = 200;
    const startY = 100;
    const col = cardIndex % cols;
    const row = Math.floor(cardIndex / cols);
    cardIndex++;
    return {
        x: startX + col * spacingX + (Math.random() - 0.5) * 40,
        y: startY + row * spacingY + (Math.random() - 0.5) * 40,
    };
}

function CanvasInner() {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState(null);
    const [magnetCount, setMagnetCount] = useState(0);
    const { runGravityLoop, stopGravity } = useGravity();
    const cardsRef = useRef({});
    const allEdgesRef = useRef([]); // Store all edges for filtering
    const [selectedCardId, setSelectedCardId] = useState(null);

    // Callback for gravity to update edges (connection lines)
    const handleEdgesUpdate = useCallback((newEdges) => {
        allEdgesRef.current = newEdges;
        // If a card is selected, only show its connections
        if (selectedCardId) {
            const filtered = newEdges
                .map((e) => {
                    const isConnected = e.source === selectedCardId || e.target === selectedCardId;
                    return {
                        ...e,
                        style: {
                            ...e.style,
                            opacity: isConnected ? 1 : 0.05,
                            strokeWidth: isConnected ? Math.max(e.style.strokeWidth, 2.5) : 0.5,
                        },
                        label: isConnected ? e.label : "",
                    };
                });
            setEdges(filtered);
        } else {
            setEdges(newEdges);
        }
    }, [setEdges, selectedCardId]);

    // Handle card click — highlight only its connections
    const onNodeClick = useCallback((event, node) => {
        if (node.type === "magnet") return;

        const newSelected = selectedCardId === node.id ? null : node.id;
        setSelectedCardId(newSelected);

        if (newSelected && allEdgesRef.current.length > 0) {
            // Filter edges to highlight selected card's connections
            const filtered = allEdgesRef.current.map((e) => {
                const isConnected = e.source === newSelected || e.target === newSelected;
                return {
                    ...e,
                    style: {
                        ...e.style,
                        opacity: isConnected ? 1 : 0.04,
                        strokeWidth: isConnected ? Math.max(e.style.strokeWidth * 1.5, 3) : 0.5,
                        filter: isConnected ? "drop-shadow(0 0 6px rgba(139, 92, 246, 0.5))" : "none",
                    },
                    animated: isConnected,
                    label: isConnected ? e.label : "",
                };
            });
            setEdges(filtered);

            // Dim non-connected cards
            setNodes((prev) =>
                prev.map((n) => {
                    if (n.type !== "orbitCard") return n;
                    const isConnected = allEdgesRef.current.some(
                        (e) =>
                            (e.source === newSelected || e.target === newSelected) &&
                            (e.source === n.id || e.target === n.id)
                    );
                    const isSelf = n.id === newSelected;
                    return {
                        ...n,
                        data: { ...n.data, fadedOut: !isSelf && !isConnected },
                    };
                })
            );
        } else {
            // Deselect — show all edges and restore all cards
            setEdges(allEdgesRef.current);
            setNodes((prev) =>
                prev.map((n) =>
                    n.type === "orbitCard"
                        ? { ...n, data: { ...n.data, fadedOut: false } }
                        : n
                )
            );
        }
    }, [selectedCardId, setEdges, setNodes]);

    // Click on background to deselect
    const onPaneClick = useCallback(() => {
        if (selectedCardId) {
            setSelectedCardId(null);
            setEdges(allEdgesRef.current);
            setNodes((prev) =>
                prev.map((n) =>
                    n.type === "orbitCard"
                        ? { ...n, data: { ...n.data, fadedOut: false } }
                        : n
                )
            );
        }
    }, [selectedCardId, setEdges, setNodes]);

    // Check backend health on mount
    useEffect(() => {
        healthCheck().then(setStatus);
    }, []);

    // Get card count (excluding magnets)
    const cardCount = nodes.filter((n) => n.type === "orbitCard").length;

    // Delete a card
    const handleDeleteCard = useCallback((cardId) => {
        setNodes((prev) => prev.filter((n) => n.id !== cardId));
        setEdges((prev) => prev.filter((e) => e.source !== cardId && e.target !== cardId));
        delete cardsRef.current[cardId];
        allEdgesRef.current = allEdgesRef.current.filter(
            (e) => e.source !== cardId && e.target !== cardId
        );
    }, [setNodes, setEdges]);

    // Handle new content submission from InputBar
    const handleSubmit = useCallback(
        async (content, type) => {
            setIsLoading(true);

            // Add loading placeholder node
            const tempId = `loading-${Date.now()}`;
            const position = nextPosition();

            setNodes((prev) => [
                ...prev,
                {
                    id: tempId,
                    type: "orbitCard",
                    position,
                    data: { loading: true },
                    draggable: true,
                },
            ]);

            try {
                const card = await generateCard(content, type);

                // Store card data
                cardsRef.current[card.id] = card;

                // Replace loading node with real card
                setNodes((prev) =>
                    prev.map((node) =>
                        node.id === tempId
                            ? {
                                id: card.id,
                                type: "orbitCard",
                                position,
                                data: { card, fadedOut: false, onDelete: handleDeleteCard },
                                draggable: true,
                            }
                            : node
                    )
                );

                setTimeout(() => {
                    setNodes((currentNodes) => {
                        const cardNodes = currentNodes.filter((n) => n.type === "orbitCard" && !n.data.loading);
                        if (cardNodes.length >= 2) {
                            runGravityLoop(currentNodes, setNodes, null, handleEdgesUpdate);
                        }
                        return currentNodes;
                    });
                }, 500);
            } catch (err) {
                console.error("Card generation failed:", err);
                // Remove loading node on error
                setNodes((prev) => prev.filter((n) => n.id !== tempId));
            } finally {
                setIsLoading(false);
            }
        },
        [setNodes, runGravityLoop]
    );

    // Add a magnet to the canvas
    const handleAddMagnet = useCallback(() => {
        const magnetId = `magnet-${magnetCount}`;
        setMagnetCount((c) => c + 1);

        setNodes((prev) => [
            ...prev,
            {
                id: magnetId,
                type: "magnet",
                position: { x: 200 + Math.random() * 300, y: 200 + Math.random() * 300 },
                data: {
                    onActivate: async (id, constraint) => {
                        // Get all card IDs
                        const cardIds = Object.keys(cardsRef.current);
                        if (cardIds.length === 0) return;

                        try {
                            const { results } = await applyMagnet(constraint, cardIds);

                            // Fade out low-relevance cards, boost high-relevance
                            setNodes((currentNodes) => {
                                const updatedNodes = currentNodes.map((node) => {
                                    if (node.type !== "orbitCard") return node;

                                    const result = results.find((r) => r.card_id === node.id);
                                    const relevance = result ? result.relevance : 0;

                                    return {
                                        ...node,
                                        data: {
                                            ...node.data,
                                            fadedOut: relevance < 0.4,
                                        },
                                    };
                                });

                                // Run gravity with magnet results
                                runGravityLoop(updatedNodes, setNodes, results, handleEdgesUpdate);
                                return updatedNodes;
                            });
                        } catch (err) {
                            console.error("Magnet activation failed:", err);
                        }
                    },
                },
                draggable: true,
            },
        ]);
    }, [magnetCount, setNodes, runGravityLoop]);

    // Re-orbit: recalculate gravity for all cards
    const handleReorbit = useCallback(() => {
        // Reset fade-out states
        setNodes((currentNodes) => {
            const reset = currentNodes.map((node) =>
                node.type === "orbitCard"
                    ? { ...node, data: { ...node.data, fadedOut: false } }
                    : node
            );
            runGravityLoop(reset, setNodes, null, handleEdgesUpdate);
            return reset;
        });
    }, [setNodes, runGravityLoop, handleEdgesUpdate]);

    // Clear everything
    const handleClear = useCallback(() => {
        stopGravity();
        setNodes([]);
        setEdges([]);
        cardsRef.current = {};
        cardIndex = 0;
    }, [setNodes, setEdges, stopGravity]);

    return (
        <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
            {/* Title overlay */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                style={{
                    position: "fixed",
                    top: 20,
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 1000,
                    textAlign: "center",
                }}
            >
                <h1
                    style={{
                        fontSize: 20,
                        fontWeight: 700,
                        background: "linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        letterSpacing: "-0.02em",
                    }}
                >
                    ✦ Orbit
                </h1>
                <p
                    style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        marginTop: 2,
                    }}
                >
                    Drop content · Cards appear · Meaning organizes
                </p>
            </motion.div>

            {/* Empty state with onboarding */}
            <AnimatePresence>
                {cardCount === 0 && !isLoading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: "fixed",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            zIndex: 500,
                            textAlign: "center",
                            pointerEvents: "none",
                        }}
                    >
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                            style={{ fontSize: 48, marginBottom: 16 }}
                        >
                            ✦
                        </motion.div>
                        <h2
                            style={{
                                fontSize: 24,
                                fontWeight: 600,
                                color: "var(--text-primary)",
                                marginBottom: 12,
                            }}
                        >
                            Your canvas is empty
                        </h2>
                        <p style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 360, lineHeight: 1.6 }}>
                            Drop a URL, type a thought, or paste an idea below.
                            <br />
                            Claude will turn it into an interactive card.
                        </p>
                        <div style={{
                            display: "flex",
                            gap: 24,
                            marginTop: 28,
                            justifyContent: "center",
                        }}>
                            {[
                                { icon: "✍️", label: "Type anything", sub: "ideas, notes, links" },
                                { icon: "🌀", label: "Re-orbit", sub: "cards cluster by meaning" },
                                { icon: "🧲", label: "Add magnet", sub: "filter by constraints" },
                            ].map((step, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 + i * 0.15 }}
                                    style={{
                                        padding: "12px 16px",
                                        borderRadius: "var(--radius-md)",
                                        background: "var(--bg-glass)",
                                        borderWidth: 1,
                                        borderStyle: "solid",
                                        borderColor: "var(--border-subtle)",
                                    }}
                                >
                                    <div style={{ fontSize: 20, marginBottom: 4 }}>{step.icon}</div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{step.label}</div>
                                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{step.sub}</div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* React Flow Canvas */}
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                nodeTypes={nodeTypes}
                fitView={false}
                proOptions={{ hideAttribution: true }}
                minZoom={0.3}
                maxZoom={2}
                defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                panOnScroll
                selectionOnDrag={false}
                style={{ background: "var(--bg-primary)" }}
            >
                <Background
                    variant={BackgroundVariant.Dots}
                    gap={24}
                    size={1}
                    color="rgba(255, 255, 255, 0.05)"
                />
                <Controls
                    showInteractive={false}
                    position="bottom-right"
                    style={{ marginBottom: 80 }}
                />
            </ReactFlow>

            {/* Toolbar */}
            <Toolbar
                onAddMagnet={handleAddMagnet}
                onReorbit={handleReorbit}
                onClear={handleClear}
                cardCount={cardCount}
                status={status}
            />

            {/* Input Bar */}
            <InputBar onSubmit={handleSubmit} isLoading={isLoading} />
        </div>
    );
}

export default function Canvas() {
    return (
        <ReactFlowProvider>
            <CanvasInner />
        </ReactFlowProvider>
    );
}
