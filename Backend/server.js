const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const parkingRoutes = require("./routes/parkingRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const aiRoutes = require("./routes/aiRoutes");
const walletRoutes = require("./routes/walletRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

const paymentRoutes = require("./routes/paymentRoutes");
const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/parking", parkingRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/notifications", notificationRoutes);

app.use("/api/payment", paymentRoutes);

connectDB();

app.get("/", (req, res) => {
    res.json({
        message: "SmartPark Backend is running!",
        version: "1.2.0",
        services: [
            "/api/auth",
            "/api/parking",
            "/api/bookings",
            "/api/ai",
            "/api/wallet",
            "/api/services"
        ]
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`SmartPark server running on port ${PORT}`);
});

