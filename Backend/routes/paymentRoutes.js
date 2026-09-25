const express = require("express");
const Stripe = require("stripe");

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create Stripe Checkout Session
router.post("/create-checkout", async (req, res) => {
    try {
        const {
            amount,
            bookingId,
            parkingName,
            email
        } = req.body;

        if (!amount) {
            return res.status(400).json({
                success: false,
                message: "Amount is required"
            });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],

            line_items: [
                {
                    price_data: {
                        currency: "inr",

                        product_data: {
                            name: parkingName || "SmartPark Parking"
                        },

                        unit_amount: Math.round(amount * 100)
                    },

                    quantity: 1
                }
            ],

            mode: "payment",

            customer_email: email,

            metadata: {
                bookingId: bookingId || ""
            },

 success_url:
    "http://localhost:5000/payment-success",

cancel_url:
    "http://localhost:5000/payment-cancelled"
        });

        res.json({
            success: true,
            checkoutUrl: session.url,
            sessionId: session.id
        });

    } catch (error) {

        console.error("STRIPE ERROR:", error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


// Payment success page
router.get("/success", (req, res) => {
    res.send(`
        <h1>✅ Payment Successful!</h1>
        <p>Thank you for using SmartPark.</p>
        <p>Your payment was completed successfully.</p>
    `);
});


// Payment cancelled page
router.get("/cancelled", (req, res) => {
    res.send(`
        <h1>❌ Payment Cancelled</h1>
        <p>Your SmartPark payment was cancelled.</p>
    `);
});


module.exports = router;