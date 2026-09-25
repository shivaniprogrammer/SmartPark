const Booking = require("../models/Booking");
const ParkingSlot = require("../models/ParkingSlot");
const ParkingLocation = require("../models/ParkingLocation");

const createBooking = async (req, res) => {
    try {
        const { slotId, startTime, durationMinutes } = req.body;

        if (!slotId || !startTime || !durationMinutes) {
            return res.status(400).json({
                message: "slotId, startTime and durationMinutes are required"
            });
        }

        if (durationMinutes <= 0) {
            return res.status(400).json({
                message: "Duration must be greater than 0"
            });
        }

        const start = new Date(startTime);

        if (isNaN(start.getTime())) {
            return res.status(400).json({
                message: "Invalid start time"
            });
        }

        const end = new Date(
            start.getTime() + durationMinutes * 60 * 1000
        );

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

        const booking = await Booking.create({
            user: req.user.id,
            slot: slotId,
            startTime: start,
            endTime: end,
            status: "confirmed"
        });

        await ParkingLocation.findByIdAndUpdate(
            slot.location,
            {
                $inc: { availableSlots: -1 }
            }
        );

        res.status(201).json({
            message: "Parking slot booked successfully",
            booking
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
            .populate("slot")
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

                await ParkingSlot.findByIdAndUpdate(
                    booking.slot._id,
                    {
                        status: "occupied"
                    }
                );
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