const express = require("express");
const { createServiceBooking, getMyServices } = require("../controllers/serviceController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.post("/", protect, createServiceBooking);
router.get("/my", protect, getMyServices);

module.exports = router;
