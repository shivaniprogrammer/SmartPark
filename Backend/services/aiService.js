/**
 * aiService.js
 * Reusable helper to call the SmartPark Python AI FastAPI microservice.
 * All AI calls are non-blocking — if the AI service is down, the backend
 * continues normally with a safe fallback response.
 */

const http = require("http");

const AI_BASE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

/**
 * Internal JSON POST helper using built-in http (no extra dependencies needed).
 */
function aiPost(path, payload) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(payload);
        const url = new URL(AI_BASE_URL + path);

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

        const req = http.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                try {
                    resolve(JSON.parse(data));
                } catch {
                    reject(new Error("Invalid JSON from AI service"));
                }
            });
        });

        req.on("error", reject);
        req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error("AI service timeout"));
        });

        req.write(body);
        req.end();
    });
}

/**
 * Predict demand level and occupancy for a parking location.
 * Used when fetching parking locations list.
 *
 * @param {string} locationName
 * @param {number} totalSlots
 * @param {number} availableSlots
 * @returns {Object} { demand, predicted_occupancy, confidence, ... }
 */
async function getDemandPrediction(locationName, totalSlots, availableSlots) {
    const now = new Date();
    try {
        return await aiPost("/predict/demand", {
            location: locationName,
            total_slots: totalSlots,
            available_slots: availableSlots,
            hour: now.getHours(),
            day_of_week: now.getDay()
        });
    } catch {
        // Safe fallback — backend still works if AI is offline
        return {
            demand: "UNKNOWN",
            predicted_occupancy: null,
            confidence: null
        };
    }
}

/**
 * Predict future availability for a parking location.
 * Used when fetching slots for a specific location.
 *
 * @param {string} locationName
 * @param {number} totalSlots
 * @param {number} availableSlots
 * @returns {Object} { predicted_available_slots, availability, forecast_timeline, ... }
 */
async function getAvailabilityPrediction(locationName, totalSlots, availableSlots) {
    const now = new Date();
    try {
        return await aiPost("/predict/availability", {
            location: locationName,
            total_slots: totalSlots,
            current_available_slots: availableSlots,
            hour: now.getHours(),
            day_of_week: now.getDay()
        });
    } catch {
        return {
            predicted_available_slots: null,
            availability: "UNKNOWN",
            forecast_timeline: null
        };
    }
}

/**
 * Rank a list of parking locations by AI recommendation score.
 * Used when listing all locations so the best options bubble up.
 *
 * @param {Array} locations - Array of { location, total_slots, current_available_slots }
 * @returns {Object} { ranked_recommendations, top_recommendation }
 */
async function getRecommendations(locations) {
    const now = new Date();
    try {
        const payload = locations.map((loc) => ({
            location: loc.name,
            total_slots: loc.totalSlots,
            current_available_slots: loc.availableSlots,
            hour: now.getHours(),
            day_of_week: now.getDay()
        }));
        return await aiPost("/recommend", { locations: payload });
    } catch {
        return { ranked_recommendations: [], top_recommendation: null };
    }
}

module.exports = {
    getDemandPrediction,
    getAvailabilityPrediction,
    getRecommendations
};
