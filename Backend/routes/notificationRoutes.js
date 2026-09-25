const express = require("express");
const nodemailer = require("nodemailer");

const router = express.Router();

// Gmail transporter
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Test email connection
transporter.verify((error, success) => {
    if (error) {
        console.error("EMAIL CONFIGURATION ERROR:", error.message);
    } else {
        console.log("Email server is ready");
    }
});

// POST /api/notifications/send
router.post("/send", async (req, res) => {

    try {
        const {
            email,
            parkingName,
            bookingId,
            date,
            duration,
            amount
        } = req.body;

        // Check required fields
        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "SmartPark Booking Confirmed",
            html: `
                <h2>🚗 SmartPark Booking Confirmed</h2>

                <p>Your parking booking has been confirmed.</p>

                <p><b>Parking:</b> ${parkingName}</p>
                <p><b>Booking ID:</b> ${bookingId}</p>
                <p><b>Date:</b> ${date}</p>
                <p><b>Duration:</b> ${duration}</p>
                <p><b>Amount:</b> ₹${amount}</p>

                <br>

                <p>Thank you for using SmartPark!</p>
            `
        };

        await transporter.sendMail(mailOptions);

        console.log("Notification sent to:", email);

        res.json({
            success: true,
            message: "Notification sent successfully"
        });

    } catch (error) {

        // Show the REAL error in terminal
        console.error("EMAIL ERROR:", error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;