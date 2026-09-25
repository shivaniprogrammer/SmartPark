/**
 * aiRoutes.js
 * Direct AI proxy routes so the React frontend can optionally call
 * AI endpoints through the Express backend (never directly to Python).
 *
 * Routes:
 *   POST /api/ai/demand        → demand prediction
 *   POST /api/ai/availability  → availability forecast
 *   POST /api/ai/recommend     → smart ranked recommendations
 *   GET  /api/ai/health        → AI service health check
 */

const express = require("express");
const http = require("http");
const { protect } = require("../middleware/auth");

const router = express.Router();

const AI_BASE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

/** Generic proxy forwarder */
function proxyToAI(aiPath) {
    return (req, res) => {
        const body = JSON.stringify(req.body);
        const url = new URL(AI_BASE_URL + aiPath);

        const options = {
            hostname: url.hostname,
            port: url.port || 8000,
            path: url.pathname,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body)
            }
        };

        const aiReq = http.request(options, (aiRes) => {
            let data = "";
            aiRes.on("data", (chunk) => (data += chunk));
            aiRes.on("end", () => {
                try {
                    res.status(aiRes.statusCode).json(JSON.parse(data));
                } catch {
                    res.status(502).json({ message: "Invalid response from AI service" });
                }
            });
        });

        aiReq.on("error", () => {
            res.status(503).json({
                message: "AI service is currently unavailable. Please ensure the Python FastAPI server is running on port 8000."
            });
        });

        aiReq.setTimeout(8000, () => {
            aiReq.destroy();
            res.status(504).json({ message: "AI service request timed out" });
        });

        aiReq.write(body);
        aiReq.end();
    };
}

/** Health check — GET request to AI */
router.get("/health", (req, res) => {
    const url = new URL(AI_BASE_URL + "/health");
    const options = {
        hostname: url.hostname,
        port: url.port || 8000,
        path: url.pathname,
        method: "GET"
    };

    const aiReq = http.request(options, (aiRes) => {
        let data = "";
        aiRes.on("data", (chunk) => (data += chunk));
        aiRes.on("end", () => {
            try {
                res.status(aiRes.statusCode).json(JSON.parse(data));
            } catch {
                res.status(502).json({ message: "Invalid response from AI service" });
            }
        });
    });

    aiReq.on("error", () => {
        res.status(503).json({
            status: "unavailable",
            message: "AI service is offline. Start it with: python -m uvicorn ai.api.app:app --port 8000"
        });
    });

    aiReq.end();
});

// Protected routes — user must be logged in to call AI endpoints
router.post("/demand", protect, proxyToAI("/predict/demand"));
router.post("/availability", protect, proxyToAI("/predict/availability"));
router.post("/recommend", protect, proxyToAI("/recommend"));

module.exports = router;
