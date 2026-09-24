const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        slot: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ParkingSlot",
            required: true
        },

        startTime: {
            type: Date,
            required: true
        },

        endTime: {
            type: Date,
            required: true
        },

        status: {
            type: String,
            enum: ["confirmed", "active", "completed", "cancelled", "overstayed"],
            default: "confirmed"
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Booking", bookingSchema);