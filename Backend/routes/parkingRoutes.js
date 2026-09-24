const express = require("express");

const {
    createLocation,
    getLocations,
    createSlots,
    getSlots
} = require("../controllers/parkingController");

const { protect } = require("../middleware/auth");

const router = express.Router();

router.post("/locations", protect, createLocation);

router.get("/locations", getLocations);

router.post("/slots", protect, createSlots);

router.get("/locations/:locationId/slots", getSlots);

module.exports = router;