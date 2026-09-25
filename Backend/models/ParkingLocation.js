const mongoose = require("mongoose");

const parkingLocationSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        address: {
            type: String,
            required: true,
            trim: true
        },

        totalSlots: {
            type: Number,
            required: true,
            min: 1
        },

        availableSlots: {
            type: Number,
            required: true,
            min: 0
        },

        pricePerHour: {
            type: Number,
            default: 50,
            min: 0
        },

        rating: {
            type: Number,
            default: 4.5,
            min: 1,
            max: 5
        },

        category: {
            type: String,
            enum: ["mall", "commercial", "metro", "office", "mixed"],
            default: "commercial"
        },

        latitude: {
            type: Number,
            default: 13.0418
        },

        longitude: {
            type: Number,
            default: 80.2341
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "ParkingLocation",
    parkingLocationSchema
);