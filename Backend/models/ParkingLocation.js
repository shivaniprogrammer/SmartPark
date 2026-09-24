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