const express = require("express");

const {
    createBooking,
    getMyBookings,
    cancelBooking,
    completeBooking
} = require("../controllers/bookingController");

const { protect } = require("../middleware/auth");

const router = express.Router();

router.post("/", protect, createBooking);

router.get("/my", protect, getMyBookings);

router.put("/:id/cancel", protect, cancelBooking);

router.put("/:id/complete", protect, completeBooking);

module.exports = router;