const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const parkingRoutes = require("./routes/parkingRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const aiRoutes = require("./routes/aiRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/parking", parkingRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/ai", aiRoutes);

connectDB();

app.get("/", (req, res) => {
    res.json({
        message: "SmartPark Backend is running!"
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`SmartPark server running on port ${PORT}`);
});