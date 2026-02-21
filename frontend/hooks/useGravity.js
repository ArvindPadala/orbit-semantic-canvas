"use client";

/**
 * useGravity Hook — Semantic Gravity Simulation
 *
 * Fetches similarity scores from Redis and uses spring physics
 * to smoothly animate card positions toward semantic clusters.
 */

import { useCallback, useRef } from "react";
import { getGravity } from "@/lib/api";

// Tuned for dramatic, visible clustering WITHOUT overlap
const ATTRACTION_STRENGTH = 60;
const REPULSION_STRENGTH = 50000; // Very strong close-range push
const SOFT_REPULSION = 800; // Gentle push when moderately close
const DAMPING = 0.82;
const MIN_DISTANCE = 500; // Card width(280) + card height(~400) safety zone
const CLUSTER_TARGET = 400; // Target distance for similar cards
const MAX_SPEED = 10;
const SIMILARITY_THRESHOLD = 0.2;

export function useGravity() {
    const velocities = useRef({});
    const animationFrame = useRef(null);
    const isRunning = useRef(false);
    const lastPairs = useRef([]);

    const calculateForces = useCallback((nodes, similarities, magnetResults) => {
        const forces = {};

        // Initialize forces for all nodes
        nodes.forEach((node) => {
            if (node.type === "magnet") return;
            forces[node.id] = { fx: 0, fy: 0 };
            if (!velocities.current[node.id]) {
                velocities.current[node.id] = { vx: 0, vy: 0 };
            }
        });

        const cardNodes = nodes.filter((n) => n.type !== "magnet");

        // Attraction: similar cards pull toward each other
        for (const pair of similarities) {
            const nodeA = cardNodes.find((n) => n.id === pair.card_a);
            const nodeB = cardNodes.find((n) => n.id === pair.card_b);

            if (!nodeA || !nodeB) continue;

            const dx = nodeB.position.x - nodeA.position.x;
            const dy = nodeB.position.y - nodeA.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;

            if (pair.similarity > SIMILARITY_THRESHOLD) {
                // Target distance based on similarity (higher sim = closer target)
                const targetDist = CLUSTER_TARGET + (1 - pair.similarity) * 300;
                const displacement = dist - targetDist;

                // Spring force: pull toward target distance
                const force = ATTRACTION_STRENGTH * pair.similarity * displacement / dist;
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;

                if (forces[nodeA.id]) {
                    forces[nodeA.id].fx += fx;
                    forces[nodeA.id].fy += fy;
                }
                if (forces[nodeB.id]) {
                    forces[nodeB.id].fx -= fx;
                    forces[nodeB.id].fy -= fy;
                }
            }
        }

        // Repulsion: prevent cards from overlapping
        for (let i = 0; i < cardNodes.length; i++) {
            for (let j = i + 1; j < cardNodes.length; j++) {
                const nodeA = cardNodes[i];
                const nodeB = cardNodes[j];

                const dx = nodeB.position.x - nodeA.position.x;
                const dy = nodeB.position.y - nodeA.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;

                if (dist < MIN_DISTANCE) {
                    // Strong push when overlapping
                    const overlap = MIN_DISTANCE - dist;
                    const force = REPULSION_STRENGTH * overlap / (dist * dist + 100);
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;

                    if (forces[nodeA.id]) {
                        forces[nodeA.id].fx -= fx;
                        forces[nodeA.id].fy -= fy;
                    }
                    if (forces[nodeB.id]) {
                        forces[nodeB.id].fx += fx;
                        forces[nodeB.id].fy += fy;
                    }
                } else if (dist < MIN_DISTANCE * 1.4) {
                    // Soft repulsion zone — gentle push when moderately close
                    const softForce = SOFT_REPULSION / dist;
                    const fx = (dx / dist) * softForce;
                    const fy = (dy / dist) * softForce;

                    if (forces[nodeA.id]) {
                        forces[nodeA.id].fx -= fx;
                        forces[nodeA.id].fy -= fy;
                    }
                    if (forces[nodeB.id]) {
                        forces[nodeB.id].fx += fx;
                        forces[nodeB.id].fy += fy;
                    }
                }
            }
        }

        // Magnet force: pull matching cards INTO ORBIT around magnet (not on top of it)
        if (magnetResults) {
            const magnetNodes = nodes.filter((n) => n.type === "magnet");
            const MAGNET_ORBIT = 600; // Cards orbit well clear of the magnet widget

            for (const magnet of magnetNodes) {
                // Count relevant cards to spread them in a circle
                const relevantCards = magnetResults.filter((r) => r.relevance > 0.4);
                let relevantIdx = 0;

                for (const result of magnetResults) {
                    const card = cardNodes.find((n) => n.id === result.card_id);
                    if (!card || !forces[card.id]) continue;

                    const dx = magnet.position.x - card.position.x;
                    const dy = magnet.position.y - card.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

                    if (result.relevance > 0.4) {
                        // Calculate orbit position (spread cards in a circle)
                        const angle = (relevantIdx / Math.max(relevantCards.length, 1)) * Math.PI * 2;
                        const targetX = magnet.position.x + Math.cos(angle) * MAGNET_ORBIT;
                        const targetY = magnet.position.y + Math.sin(angle) * MAGNET_ORBIT;
                        relevantIdx++;

                        // Pull toward orbit position (not magnet center)
                        const tdx = targetX - card.position.x;
                        const tdy = targetY - card.position.y;
                        const tDist = Math.sqrt(tdx * tdx + tdy * tdy) || 1;

                        const pullForce = result.relevance * ATTRACTION_STRENGTH * 1.5;
                        forces[card.id].fx += (tdx / tDist) * pullForce;
                        forces[card.id].fy += (tdy / tDist) * pullForce;

                        // Strong push away from magnet center if too close
                        if (dist < MAGNET_ORBIT * 0.8) {
                            const pushForce = REPULSION_STRENGTH * 0.003 * (1 - dist / MAGNET_ORBIT);
                            forces[card.id].fx -= (dx / dist) * pushForce;
                            forces[card.id].fy -= (dy / dist) * pushForce;
                        }
                    } else {
                        // Push away irrelevant cards
                        const pushForce = (1 - result.relevance) * ATTRACTION_STRENGTH * 0.8;
                        forces[card.id].fx -= (dx / dist) * pushForce;
                        forces[card.id].fy -= (dy / dist) * pushForce;
                    }
                }
            }
        }

        return forces;
    }, []);

    const stopGravity = useCallback(() => {
        isRunning.current = false;
        if (animationFrame.current) {
            cancelAnimationFrame(animationFrame.current);
        }
    }, []);

    const runGravityLoop = useCallback(
        async (nodes, setNodes, magnetResults = null, onEdgesUpdate = null) => {
            const cardIds = nodes.filter((n) => n.type !== "magnet").map((n) => n.id);
            if (cardIds.length < 2) return;

            isRunning.current = true;

            try {
                const { pairs } = await getGravity(cardIds);
                lastPairs.current = pairs;

                // Update edges (connection lines) based on similarity
                if (onEdgesUpdate) {
                    const edges = pairs
                        .filter((p) => p.similarity > 0.05) // Show virtually all connections
                        .sort((a, b) => a.similarity - b.similarity) // Draw strongest on top
                        .map((p) => {
                            // Color coding based on similarity
                            let strokeColor, glowColor, dashStyle;
                            const sim = p.similarity;

                            if (sim > 0.6) {
                                // Strong connection — bright purple, solid
                                strokeColor = `rgba(139, 92, 246, ${0.4 + sim * 0.4})`;
                                glowColor = "rgba(139, 92, 246, 0.3)";
                                dashStyle = "none";
                            } else if (sim > 0.35) {
                                // Medium connection — cyan, light dash
                                strokeColor = `rgba(6, 182, 212, ${0.3 + sim * 0.3})`;
                                glowColor = "rgba(6, 182, 212, 0.2)";
                                dashStyle = "8 4";
                            } else {
                                // Weak connection — dim white, dashed
                                strokeColor = `rgba(255, 255, 255, ${0.05 + sim * 0.15})`;
                                glowColor = "none";
                                dashStyle = "4 6";
                            }

                            return {
                                id: `edge-${p.card_a}-${p.card_b}`,
                                source: p.card_a,
                                target: p.card_b,
                                type: "default",
                                animated: sim > 0.55,
                                style: {
                                    stroke: strokeColor,
                                    strokeWidth: Math.max(1, sim * 4),
                                    strokeDasharray: dashStyle,
                                    filter: sim > 0.5 ? `drop-shadow(0 0 4px ${glowColor})` : "none",
                                },
                                label: sim > 0.2 ? `${Math.round(sim * 100)}%` : "",
                                labelStyle: {
                                    fontSize: 10,
                                    fill: sim > 0.5 ? "rgba(139, 92, 246, 0.9)" : "rgba(6, 182, 212, 0.7)",
                                    fontWeight: 600,
                                    fontFamily: "Inter, sans-serif",
                                },
                                labelBgStyle: {
                                    fill: "rgba(10, 10, 15, 0.85)",
                                    fillOpacity: 0.85,
                                },
                                labelBgPadding: [6, 4],
                                labelBgBorderRadius: 6,
                            };
                        });

                    onEdgesUpdate(edges);
                }

                let frameCount = 0;
                const maxFrames = 250; // ~4 seconds for visible motion

                const animate = () => {
                    if (!isRunning.current || frameCount >= maxFrames) {
                        isRunning.current = false;
                        return;
                    }

                    frameCount++;

                    setNodes((currentNodes) => {
                        const forces = calculateForces(currentNodes, pairs, magnetResults);
                        let totalVelocity = 0;

                        const updated = currentNodes.map((node) => {
                            if (node.type === "magnet" || !forces[node.id]) return node;

                            const vel = velocities.current[node.id] || { vx: 0, vy: 0 };
                            vel.vx = (vel.vx + forces[node.id].fx * 0.008) * DAMPING;
                            vel.vy = (vel.vy + forces[node.id].fy * 0.008) * DAMPING;

                            const speed = Math.sqrt(vel.vx * vel.vx + vel.vy * vel.vy);
                            if (speed > MAX_SPEED) {
                                vel.vx = (vel.vx / speed) * MAX_SPEED;
                                vel.vy = (vel.vy / speed) * MAX_SPEED;
                            }

                            totalVelocity += speed;
                            velocities.current[node.id] = vel;

                            return {
                                ...node,
                                position: {
                                    x: node.position.x + vel.vx,
                                    y: node.position.y + vel.vy,
                                },
                            };
                        });

                        // Stop if things have settled
                        if (totalVelocity < 0.03) {
                            isRunning.current = false;
                        }

                        return updated;
                    });

                    animationFrame.current = requestAnimationFrame(animate);
                };

                animationFrame.current = requestAnimationFrame(animate);
            } catch (err) {
                console.warn("Gravity loop failed:", err);
                isRunning.current = false;
            }
        },
        [calculateForces]
    );

    return { runGravityLoop, stopGravity, isRunning, lastPairs };
}
