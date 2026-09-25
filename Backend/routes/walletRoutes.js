const express = require("express");
const { getWallet, addFunds } = require("../controllers/walletController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.get("/", protect, getWallet);
router.post("/add-funds", protect, addFunds);

module.exports = router;
