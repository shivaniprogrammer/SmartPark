const mongoose = require("mongoose");

const serviceBookingSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        serviceType: {
            type: String,
            enum: ["car_wash", "mechanic", "cab", "tyre_service", "inspection"],
            required: true
        },

        serviceName: {
            type: String,
            required: true
        },

        amount: {
            type: Number,
            required: true
        },

        locationName: {
            type: String,
            default: "Koramangala, Bangalore"
        },

        scheduledTime: {
            type: Date,
            default: Date.now
        },

        status: {
            type: String,
            enum: ["requested", "in_progress", "completed", "cancelled"],
            default: "requested"
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("ServiceBooking", serviceBookingSchema);
