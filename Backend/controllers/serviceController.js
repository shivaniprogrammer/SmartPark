const ServiceBooking = require("../models/ServiceBooking");
const Wallet = require("../models/Wallet");

const createServiceBooking = async (req, res) => {
    try {
        const { serviceType, serviceName, amount, locationName } = req.body;

        if (!serviceType || !serviceName || !amount) {
            return res.status(400).json({
                message: "serviceType, serviceName, and amount are required"
            });
        }

        // Deduct from wallet if available
        let wallet = await Wallet.findOne({ user: req.user.id });
        if (!wallet) {
            wallet = await Wallet.create({ user: req.user.id, balance: 850 });
        }

        if (wallet.balance < amount) {
            return res.status(400).json({
                message: `Insufficient wallet balance (₹${wallet.balance}) for ${serviceName} (₹${amount})`
            });
        }

        wallet.balance -= amount;
        wallet.transactions.unshift({
            type: "debit",
            amount: amount,
            description: `Booked ${serviceName}`
        });
        await wallet.save();

        const serviceBooking = await ServiceBooking.create({
            user: req.user.id,
            serviceType,
            serviceName,
            amount,
            locationName: locationName || "Koramangala, Bangalore",
            status: "requested"
        });

        res.status(201).json({
            message: "Service booked successfully",
            serviceBooking,
            remainingWalletBalance: wallet.balance
        });
    } catch (error) {
        res.status(500).json({
            message: "Service booking failed",
            error: error.message
        });
    }
};

const getMyServices = async (req, res) => {
    try {
        const services = await ServiceBooking.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json(services);
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch service bookings",
            error: error.message
        });
    }
};

module.exports = {
    createServiceBooking,
    getMyServices
};
