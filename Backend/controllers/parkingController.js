const ParkingLocation = require("../models/ParkingLocation");
const ParkingSlot = require("../models/ParkingSlot");
const {
    getDemandPrediction,
    getAvailabilityPrediction,
    getRecommendations
} = require("../services/aiService");

const createLocation = async (req, res) => {
    try {
        const { name, address, totalSlots } = req.body;

        const location = await ParkingLocation.create({
            name,
            address,
            totalSlots,
            availableSlots: totalSlots
        });

        res.status(201).json({
            message: "Parking location created successfully",
            location
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to create parking location",
            error: error.message
        });
    }
};

const getLocations = async (req, res) => {
    try {
        const locations = await ParkingLocation.find();

        // Call AI recommendation engine to rank all locations
        const aiRanking = await getRecommendations(locations);

        // Build a score lookup map by location name
        const scoreMap = {};
        if (aiRanking.ranked_recommendations) {
            for (const rec of aiRanking.ranked_recommendations) {
                scoreMap[rec.location] = rec;
            }
        }

        // Attach AI intelligence data to each location
        const enriched = locations.map((loc) => {
            const aiData = scoreMap[loc.name] || {};
            return {
                ...loc.toObject(),
                ai_intelligence: {
                    demand: aiData.demand_level || "UNKNOWN",
                    recommendation_score: aiData.recommendation_score || null,
                    predicted_available_slots: aiData.predicted_available_slots || null,
                    tags: aiData.tags || [],
                    forecast_timeline: aiData.forecast_timeline || null,
                    score_breakdown: aiData.score_breakdown || null
                }
            };
        });

        // Sort by AI recommendation score descending (best first)
        enriched.sort((a, b) => {
            const scoreA = a.ai_intelligence.recommendation_score || 0;
            const scoreB = b.ai_intelligence.recommendation_score || 0;
            return scoreB - scoreA;
        });

        res.json(enriched);
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch parking locations",
            error: error.message
        });
    }
};

const createSlots = async (req, res) => {
    try {
        const { locationId, numberOfSlots } = req.body;

        const location = await ParkingLocation.findById(locationId);

        if (!location) {
            return res.status(404).json({
                message: "Parking location not found"
            });
        }

        const existingSlots = await ParkingSlot.countDocuments({
            location: locationId
        });

        const slots = [];

        for (
            let i = existingSlots + 1;
            i <= existingSlots + numberOfSlots;
            i++
        ) {
            slots.push({
                location: locationId,
                slotNumber: `S${i}`,
                status: "available"
            });
        }

        const createdSlots = await ParkingSlot.insertMany(slots);

        res.status(201).json({
            message: "Parking slots created successfully",
            slots: createdSlots
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to create parking slots",
            error: error.message
        });
    }
};

const getSlots = async (req, res) => {
    try {
        const { locationId } = req.params;

        const slots = await ParkingSlot.find({
            location: locationId
        }).sort({ slotNumber: 1 });

        // Fetch location info to pass to AI
        const location = await ParkingLocation.findById(locationId);

        let aiAvailability = null;
        if (location) {
            const availableCount = slots.filter(
                (s) => s.status === "available"
            ).length;

            aiAvailability = await getAvailabilityPrediction(
                location.name,
                location.totalSlots,
                availableCount
            );
        }

        res.json({
            slots,
            ai_availability: aiAvailability
                ? {
                      availability_level: aiAvailability.availability,
                      predicted_available_slots:
                          aiAvailability.predicted_available_slots,
                      predicted_occupied_slots:
                          aiAvailability.predicted_occupied_slots,
                      forecast_timeline: aiAvailability.forecast_timeline,
                      message:
                          aiAvailability.availability === "LOW"
                              ? "⚠️ Slots filling up fast — book now!"
                              : aiAvailability.availability === "MEDIUM"
                              ? "🟡 Moderate availability expected soon"
                              : "🟢 Good availability expected"
                  }
                : null
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch parking slots",
            error: error.message
        });
    }
};

module.exports = {
    createLocation,
    getLocations,
    createSlots,
    getSlots
};