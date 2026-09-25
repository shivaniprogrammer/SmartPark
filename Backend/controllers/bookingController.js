const Booking = require("../models/Booking");
const ParkingSlot = require("../models/ParkingSlot");
const ParkingLocation = require("../models/ParkingLocation");
const Wallet = require("../models/Wallet");
const { getDemandPrediction } = require("../services/aiService");

const sharedLocationAvailability = new Map([
    ["Forum Mall, Koramangala", { total: 100, available: 68 }],
    ["Orion Mall, Rajajinagar", { total: 120, available: 42 }],
    ["UB City, Cubbon Park", { total: 80, available: 15 }],
    ["Phoenix Mall, Whitefield", { total: 150, available: 95 }]
]);

const createBooking = async (req, res) => {
    try {
        const {
            slotId,
            locationId,
            locationName,
            slotNumber,
            startTime,
            durationHours,
            durationMinutes,
            totalAmount,
            paymentMethod,
            servicesAdded
        } = req.body;

        const hours = durationHours || (durationMinutes ? durationMinutes / 60 : 1);
        const start = startTime ? new Date(startTime) : new Date();
        const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
        const targetLocation = locationName || "Forum Mall, Koramangala";

        let slot = null;
        let locationDoc = null;
        const mongoose = require("mongoose");
        const isDbConnected = mongoose.connection.readyState === 1;

        if (isDbConnected && slotId) {
            try {
                slot = await ParkingSlot.findOneAndUpdate(
                    { _id: slotId, status: "available" },
                    { status: "booked" },
                    { new: true }
                );

                if (slot) {
                    locationDoc = await ParkingLocation.findByIdAndUpdate(
                        slot.location,
                        { $inc: { availableSlots: -1 } },
                        { new: true }
                    );
                }
            } catch (dbErr) {
                // fall back to shared memory tracker
            }
        }

        // Shared in-memory location tracking update
        let locStats = sharedLocationAvailability.get(targetLocation) || { total: 100, available: 50 };
        locStats.available = Math.max(0, locStats.available - 1);
        sharedLocationAvailability.set(targetLocation, locStats);

        const computedAmount = totalAmount !== undefined ? totalAmount : (hours * 60);
        const bookingId = "#SP2024" + Math.floor(1000 + Math.random() * 9000);

        const newBooking = {
            id: bookingId,
            bookingId,
            user: req.user ? req.user.id : "usr_demo",
            locationName: targetLocation,
            slotNumber: slotNumber || (slot ? slot.slotNumber : "B-204"),
            durationHours: hours,
            totalAmount: computedAmount,
            paymentMethod: paymentMethod || "wallet",
            status: "active",
            createdAt: new Date(),
            remainingAvailableSlots: locStats.available
        };

        // AI Demand alert integration
        let aiDemand = null;
        try {
            aiDemand = await getDemandPrediction(targetLocation, locStats.total, locStats.available);
        } catch (aiErr) { }

        return res.status(201).json({
            message: "Parking slot booked successfully",
            booking: newBooking,
            updatedLocation: {
                name: targetLocation,
                totalSlots: locStats.total,
                availableSlots: locStats.available
            },
            ai_demand_alert: aiDemand
                ? {
                      demand: aiDemand.demand,
                      predicted_occupancy: aiDemand.predicted_occupancy,
                      confidence: aiDemand.confidence,
                      warning: aiDemand.demand === "HIGH"
                          ? "🔴 High demand at this location. Slot reserved!"
                          : "🟢 Booking confirmed! Available slots updated."
                  }
                : null
        });
    } catch (error) {
        res.status(500).json({
            message: "Booking failed",
            error: error.message
        });
    }
};

const getMyBookings = async (req, res) => {
    try {
        const bookings = await Booking.find({
            user: req.user.id
        })
            .populate({
                path: "slot",
                populate: { path: "location" }
            })
            .sort({ createdAt: -1 });

        const now = new Date();

        for (const booking of bookings) {
            if (
                booking.status === "confirmed" &&
                now >= booking.startTime &&
                now < booking.endTime
            ) {
                booking.status = "active";
                await booking.save();
            }

            if (
                (booking.status === "confirmed" ||
                    booking.status === "active") &&
                now > booking.endTime
            ) {
                booking.status = "overstayed";
                await booking.save();

                if (booking.slot) {
                    await ParkingSlot.findByIdAndUpdate(
                        booking.slot._id,
                        {
                            status: "occupied"
                        }
                    );
                }
            }
        }

        res.json(bookings);
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch bookings",
            error: error.message
        });
    }
};

const cancelBooking = async (req, res) => {
    try {
        const booking = await Booking.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!booking) {
            return res.status(404).json({
                message: "Booking not found"
            });
        }

        if (
            booking.status === "cancelled" ||
            booking.status === "completed"
        ) {
            return res.status(400).json({
                message: "Booking cannot be cancelled"
            });
        }

        if (booking.status === "overstayed") {
            return res.status(400).json({
                message: "Overstayed booking cannot be cancelled"
            });
        }

        booking.status = "cancelled";
        await booking.save();

        const slot = await ParkingSlot.findByIdAndUpdate(
            booking.slot,
            {
                status: "available"
            },
            {
                new: true
            }
        );

        if (slot) {
            await ParkingLocation.findByIdAndUpdate(
                slot.location,
                {
                    $inc: { availableSlots: 1 }
                }
            );
        }

        // Refund wallet balance if paid via wallet
        if (booking.paymentMethod === "wallet") {
            const wallet = await Wallet.findOne({ user: req.user.id });
            if (wallet) {
                wallet.balance += booking.totalAmount;
                wallet.transactions.unshift({
                    type: "credit",
                    amount: booking.totalAmount,
                    description: `Refund for cancelled booking (${booking._id})`
                });
                await wallet.save();
            }
        }

        res.json({
            message: "Booking cancelled successfully",
            booking
        });
    } catch (error) {
        res.status(500).json({
            message: "Cancellation failed",
            error: error.message
        });
    }
};

const completeBooking = async (req, res) => {
    try {
        const booking = await Booking.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!booking) {
            return res.status(404).json({
                message: "Booking not found"
            });
        }

        if (
            booking.status === "completed" ||
            booking.status === "cancelled"
        ) {
            return res.status(400).json({
                message: "Booking cannot be completed"
            });
        }

        booking.status = "completed";
        await booking.save();

        const slot = await ParkingSlot.findByIdAndUpdate(
            booking.slot,
            {
                status: "available"
            },
            {
                new: true
            }
        );

        if (slot) {
            await ParkingLocation.findByIdAndUpdate(
                slot.location,
                {
                    $inc: { availableSlots: 1 }
                }
            );
        }

        res.json({
            message: "Booking completed successfully",
            booking
        });
    } catch (error) {
        res.status(500).json({
            message: "Completion failed",
            error: error.message
        });
    }
};

module.exports = {
    createBooking,
    getMyBookings,
    cancelBooking,
    completeBooking
};