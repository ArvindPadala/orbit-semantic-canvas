/**
 * API Client — All backend calls go through here.
 * Never call fetch directly in components.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function generateCard(content, type = "text") {
    const res = await fetch(`${API_URL}/api/generate-card`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, type }),
    });

    if (!res.ok) {
        const error = await res.text();
        throw new Error(`Card generation failed: ${error}`);
    }

    return res.json();
}

export async function getGravity(cardIds) {
    const res = await fetch(`${API_URL}/api/gravity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_ids: cardIds }),
    });

    if (!res.ok) return { pairs: [] };
    return res.json();
}

export async function applyMagnet(constraint, cardIds) {
    const res = await fetch(`${API_URL}/api/magnet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ constraint, card_ids: cardIds }),
    });

    if (!res.ok) {
        throw new Error("Magnet evaluation failed");
    }

    return res.json();
}

export async function suggestNext(cards) {
    const res = await fetch(`${API_URL}/api/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards }),
    });

    if (!res.ok) {
        throw new Error("Suggest next failed");
    }

    return res.json();
}

export async function exportItinerary(cards) {
    const res = await fetch(`${API_URL}/api/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards }),
    });

    if (!res.ok) {
        throw new Error("Export failed");
    }

    return res.json();
}

export async function healthCheck() {
    try {
        const res = await fetch(`${API_URL}/health`);
        return res.json();
    } catch {
        return { status: "unreachable", redis: "unknown", claude: "unknown" };
    }
}
