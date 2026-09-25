const mongoose = require("mongoose");

const parkingSlotSchema = new mongoose.Schema(
    {
        location: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ParkingLocation",
            required: true
        },

        slotNumber: {
            type: String,
            required: true,
            trim: true
        },

        status: {
            type: String,
            enum: ["available", "booked", "occupied"],
            default: "available"
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("ParkingSlot", parkingSlotSchema);