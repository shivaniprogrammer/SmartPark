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

        durationHours: {
            type: Number,
            default: 1
        },

        totalAmount: {
            type: Number,
            required: true,
            min: 0
        },

        paymentMethod: {
            type: String,
            enum: ["wallet", "upi", "card", "netbanking"],
            default: "wallet"
        },

        servicesAdded: [
            {
                name: String,
                price: Number
            }
        ],

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