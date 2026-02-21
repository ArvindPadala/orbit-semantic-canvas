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
import BudgetMagnetNode from "./BudgetMagnet";
import InputBar from "./InputBar";
import Toolbar from "./Toolbar";
import { useGravity } from "@/hooks/useGravity";
import { generateCard, applyMagnet, healthCheck, suggestNext, exportItinerary } from "@/lib/api";

// Register custom node types
const nodeTypes = {
    orbitCard: OrbitCardNode,
    magnet: MagnetNode,
    budgetMagnet: BudgetMagnetNode,
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
    const [sortMode, setSortMode] = useState("semantic");
    const [magnetCount, setMagnetCount] = useState(0);
    const [exportContent, setExportContent] = useState(null);
    const [isExporting, setIsExporting] = useState(false);
    const [templateCity, setTemplateCity] = useState("Tokyo");

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
                            runGravityLoop(currentNodes, setNodes, null, handleEdgesUpdate, sortMode);
                        }
                        return currentNodes;
                    });
                }, 100);
            } catch (error) {
                console.error("Failed to generate card:", error);
                // Remove loading node on error
                setNodes((prev) => prev.filter((n) => n.id !== tempId));
            } finally {
                setIsLoading(false);
            }
        },
        [nextPosition, setNodes, cardsRef, handleEdgesUpdate]
    );

    // Load sample templates
    const loadTemplate = useCallback((templateType, city = "Rome") => {
        if (templateType === 'trip') {
            if (!city) return;

            handleSubmit(`Historic boutique hotel in ${city}, $150/night, near city center, great wifi`, "text");
            setTimeout(() => handleSubmit(`Highly rated local restaurant in ${city}: incredible food, needs reservation, $$$`, "text"), 500);
            setTimeout(() => handleSubmit(`Morning guided tour of main historical sites in ${city}, 3 hours`, "note"), 1000);
            setTimeout(() => handleSubmit(`Evening local drinks and tasting experience in ${city}`, "note"), 1500);
            setTimeout(() => handleSubmit(`Flights to ${city} for May 12th-16th, $450 roundtrip`, "flight"), 2000);
        } else if (templateType === 'apartment') {
            handleSubmit("Modern 1BR in SoHo, $3500/mo, in-unit laundry, exposed brick", "text");
            setTimeout(() => handleSubmit("Sunny studio in Williamsburg, $2900/mo, rooftop access, no pets", "text"), 500);
            setTimeout(() => handleSubmit("Need to stay under 30min commute to midtown", "note"), 1000);
        } else if (templateType === 'research') {
            handleSubmit("Quantum computing principles and qubit coherence", "note");
            setTimeout(() => handleSubmit("https://en.wikipedia.org/wiki/Quantum_entanglement", "url"), 500);
            setTimeout(() => handleSubmit("Need a simple explanation of superposition for the presentation", "note"), 1000);
        }
    }, [handleSubmit]);

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
                                runGravityLoop(updatedNodes, setNodes, results, handleEdgesUpdate, sortMode);
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

    // Add a budget magnet to the canvas
    const handleAddBudgetMagnet = useCallback(() => {
        const magnetId = `budget-magnet-${magnetCount}`;
        setMagnetCount((c) => c + 1);

        setNodes((prev) => [
            ...prev,
            {
                id: magnetId,
                type: "budgetMagnet",
                position: { x: window.innerWidth / 2 - 100, y: window.innerHeight / 2 - 100 },
                data: {},
                draggable: true,
            },
        ]);
    }, [magnetCount, setNodes]);

    // AI Suggest Next
    const handleSuggestNext = useCallback(async () => {
        const activeCards = Object.values(cardsRef.current);
        if (activeCards.length === 0) return;

        setIsLoading(true);
        try {
            const { suggestions } = await suggestNext(activeCards);
            for (const sug of suggestions) {
                handleSubmit(sug, "text");
                // Wait briefly between drops for cooler staggered animation
                await new Promise((r) => setTimeout(r, 600));
            }
        } catch (err) {
            console.error("Suggest next failed:", err);
        } finally {
            setIsLoading(false);
        }
    }, [handleSubmit]);

    // AI Itinerary Export
    const handleExport = useCallback(async () => {
        const activeCards = Object.values(cardsRef.current);
        if (activeCards.length === 0) return;

        setIsExporting(true);
        try {
            const { markdown } = await exportItinerary(activeCards);
            setExportContent(markdown);
        } catch (err) {
            console.error("Export failed:", err);
            setExportContent("Failed to generate itinerary.");
        } finally {
            setIsExporting(false);
        }
    }, []);

    // Re-orbit: recalculate gravity for all cards
    const handleReorbit = useCallback(() => {
        // Reset fade-out states
        setNodes((currentNodes) => {
            const reset = currentNodes.map((node) =>
                node.type === "orbitCard"
                    ? { ...node, data: { ...node.data, fadedOut: false } }
                    : node
            );
            runGravityLoop(reset, setNodes, null, handleEdgesUpdate, sortMode);
            return reset;
        });
    }, [setNodes, runGravityLoop, handleEdgesUpdate, sortMode]);

    // Toggle Sort Mode
    const handleToggleSortMode = useCallback(() => {
        setSortMode((prev) => {
            const nextMode = prev === "semantic" ? "timeline" : "semantic";

            // Re-run gravity loop immediately with new mode
            setNodes((currentNodes) => {
                const reset = currentNodes.map((node) =>
                    node.type === "orbitCard"
                        ? { ...node, data: { ...node.data, fadedOut: false } }
                        : node
                );
                runGravityLoop(reset, setNodes, null, handleEdgesUpdate, nextMode);
                return reset;
            });

            return nextMode;
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

                        {/* Sample Templates */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.8 }}
                            style={{ marginTop: 40 }}
                        >
                            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>Or start with a template:</p>
                            <div style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "center" }}>
                                <div style={{
                                    display: "flex",
                                    background: "rgba(255, 255, 255, 0.03)",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: "var(--radius-sm)",
                                    overflow: "hidden"
                                }}>
                                    <select
                                        value={templateCity}
                                        onChange={(e) => setTemplateCity(e.target.value)}
                                        style={{
                                            background: "transparent",
                                            color: "var(--text-primary)",
                                            padding: "8px 12px",
                                            border: "none",
                                            outline: "none",
                                            borderRight: "1px solid var(--border-subtle)",
                                            fontSize: 13,
                                            cursor: "pointer",
                                            WebkitAppearance: "none",
                                            MozAppearance: "none"
                                        }}
                                    >
                                        <option value="Rome" style={{ background: "#161623" }}>Rome</option>
                                        <option value="Tokyo" style={{ background: "#161623" }}>Tokyo</option>
                                        <option value="Paris" style={{ background: "#161623" }}>Paris</option>
                                        <option value="New York" style={{ background: "#161623" }}>New York</option>
                                        <option value="London" style={{ background: "#161623" }}>London</option>
                                    </select>
                                    <button
                                        onClick={() => loadTemplate('trip', templateCity)}
                                        className="template-btn"
                                        style={{ pointerEvents: "auto", border: "none", background: "transparent", margin: 0 }}
                                    >
                                        ✈️ Trip Planner
                                    </button>
                                </div>

                                <button
                                    onClick={() => loadTemplate('apartment')}
                                    className="template-btn"
                                    style={{ pointerEvents: "auto" }}
                                >
                                    🏠 Apartment Hunt
                                </button>
                                <button
                                    onClick={() => loadTemplate('research')}
                                    className="template-btn"
                                    style={{ pointerEvents: "auto" }}
                                >
                                    📚 Research Topic
                                </button>
                            </div>
                        </motion.div>
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
                onAddBudget={handleAddBudgetMagnet}
                onSuggest={handleSuggestNext}
                onExport={handleExport}
                onToggleSortMode={handleToggleSortMode}
                sortMode={sortMode}
                onReorbit={handleReorbit}
                onClear={handleClear}
                cardCount={cardCount}
                status={status}
            />

            {/* Export Modal Overlay */}
            <AnimatePresence>
                {(exportContent || isExporting) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: "fixed",
                            top: 0,
                            left: 0,
                            width: "100vw",
                            height: "100vh",
                            background: "rgba(10, 10, 15, 0.8)",
                            backdropFilter: "blur(10px)",
                            zIndex: 2000,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 40,
                        }}
                        onClick={() => !isExporting && setExportContent(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            style={{
                                background: "var(--bg-card)",
                                border: "1px solid var(--border-subtle)",
                                borderRadius: "var(--radius-lg)",
                                padding: 32,
                                width: "100%",
                                maxWidth: 800,
                                maxHeight: "85vh",
                                overflowY: "auto",
                                position: "relative",
                                boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {isExporting ? (
                                <div style={{ textAlign: "center", padding: "40px 0" }}>
                                    <div style={{ fontSize: 48, marginBottom: 16 }}>✨</div>
                                    <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)" }}>
                                        Synthesizing your itinerary...
                                    </h2>
                                    <p style={{ color: "var(--text-muted)", marginTop: 8 }}>
                                        Claude is writing your personalized guide.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <button
                                        onClick={() => setExportContent(null)}
                                        style={{
                                            position: "absolute",
                                            top: 24,
                                            right: 24,
                                            background: "rgba(255,255,255,0.1)",
                                            border: "none",
                                            width: 32,
                                            height: 32,
                                            borderRadius: "50%",
                                            color: "var(--text-secondary)",
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        ✕
                                    </button>
                                    <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, paddingRight: 40 }}>
                                        Your Trip Itinerary
                                    </h2>
                                    <pre style={{
                                        whiteSpace: "pre-wrap",
                                        fontFamily: "inherit",
                                        fontSize: 14,
                                        lineHeight: 1.6,
                                        color: "var(--text-primary)"
                                    }}>
                                        {exportContent}
                                    </pre>
                                    <div style={{ marginTop: 32, display: "flex", justifyContent: "flex-end" }}>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(exportContent);
                                                alert("Copied to clipboard!");
                                            }}
                                            style={{
                                                padding: "10px 20px",
                                                background: "var(--text-primary)",
                                                color: "var(--bg-primary)",
                                                borderRadius: "var(--radius-sm)",
                                                border: "none",
                                                fontWeight: 600,
                                                cursor: "pointer",
                                            }}
                                        >
                                            Copy to Clipboard
                                        </button>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

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
