const ParkingLocation = require("../models/ParkingLocation");
const ParkingSlot = require("../models/ParkingSlot");

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

        res.json(locations);
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

        res.json(slots);
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