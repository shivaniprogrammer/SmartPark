const Booking = require("../models/Booking");
const ParkingSlot = require("../models/ParkingSlot");
const ParkingLocation = require("../models/ParkingLocation");
const Wallet = require("../models/Wallet");
const { getDemandPrediction } = require("../services/aiService");

const createBooking = async (req, res) => {
    try {
        const {
            slotId,
            startTime,
            durationHours,
            durationMinutes,
            totalAmount,
            paymentMethod,
            servicesAdded
        } = req.body;

        if (!slotId) {
            return res.status(400).json({
                message: "slotId is required"
            });
        }

        const hours = durationHours || (durationMinutes ? durationMinutes / 60 : 1);
        if (hours <= 0) {
            return res.status(400).json({
                message: "Duration must be greater than 0"
            });
        }

        const start = startTime ? new Date(startTime) : new Date();
        if (isNaN(start.getTime())) {
            return res.status(400).json({
                message: "Invalid start time"
            });
        }

        const end = new Date(start.getTime() + hours * 60 * 60 * 1000);

        // Find available slot
        const slot = await ParkingSlot.findOneAndUpdate(
            {
                _id: slotId,
                status: "available"
            },
            {
                status: "booked"
            },
            {
                new: true
            }
        );

        if (!slot) {
            return res.status(400).json({
                message: "Slot is not available"
            });
        }

        // Fetch location details for pricing if totalAmount not explicitly passed
        const locationDoc = await ParkingLocation.findById(slot.location);
        const rate = locationDoc ? locationDoc.pricePerHour : 50;
        const computedAmount = totalAmount !== undefined ? totalAmount : (hours * rate);

        // Wallet Balance Check & Deduction if paying via Wallet
        const payMethod = paymentMethod || "wallet";
        if (payMethod === "wallet") {
            let wallet = await Wallet.findOne({ user: req.user.id });
            if (!wallet) {
                wallet = await Wallet.create({ user: req.user.id, balance: 850 });
            }
            if (wallet.balance < computedAmount) {
                // Revert slot status back to available
                await ParkingSlot.findByIdAndUpdate(slotId, { status: "available" });
                return res.status(400).json({
                    message: `Insufficient wallet balance (₹${wallet.balance}). Required: ₹${computedAmount}`
                });
            }
            wallet.balance -= computedAmount;
            wallet.transactions.unshift({
                type: "debit",
                amount: computedAmount,
                description: `Booking for ${locationDoc ? locationDoc.name : 'Parking Slot'} (${slot.slotNumber})`
            });
            await wallet.save();
        }

        const booking = await Booking.create({
            user: req.user.id,
            slot: slotId,
            startTime: start,
            endTime: end,
            durationHours: hours,
            totalAmount: computedAmount,
            paymentMethod: payMethod,
            servicesAdded: servicesAdded || [],
            status: "confirmed"
        });

        await ParkingLocation.findByIdAndUpdate(
            slot.location,
            {
                $inc: { availableSlots: -1 }
            }
        );

        // AI Demand Prediction Alert
        let aiDemand = null;
        if (locationDoc) {
            aiDemand = await getDemandPrediction(
                locationDoc.name,
                locationDoc.totalSlots,
                locationDoc.availableSlots - 1
            );
        }

        res.status(201).json({
            message: "Parking slot booked successfully",
            booking,
            ai_demand_alert: aiDemand
                ? {
                      demand: aiDemand.demand,
                      predicted_occupancy: aiDemand.predicted_occupancy,
                      confidence: aiDemand.confidence,
                      warning:
                          aiDemand.demand === "HIGH"
                              ? "🔴 High demand at this location right now. Your booking is confirmed!"
                              : aiDemand.demand === "MEDIUM"
                              ? "🟡 Moderate demand — you booked at the right time."
                              : "🟢 Low demand — plenty of availability."
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