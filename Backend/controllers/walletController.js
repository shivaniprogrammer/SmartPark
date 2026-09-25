const Wallet = require("../models/Wallet");

const getWallet = async (req, res) => {
    try {
        let wallet = await Wallet.findOne({ user: req.user.id });

        if (!wallet) {
            wallet = await Wallet.create({
                user: req.user.id,
                balance: 850,
                loyaltyPoints: 2450,
                transactions: [
                    {
                        type: "credit",
                        amount: 500,
                        description: "Welcome Wallet Bonus"
                    }
                ]
            });
        }

        res.json(wallet);
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch wallet info",
            error: error.message
        });
    }
};

const addFunds = async (req, res) => {
    try {
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                message: "Amount must be greater than 0"
            });
        }

        let wallet = await Wallet.findOne({ user: req.user.id });

        if (!wallet) {
            wallet = new Wallet({ user: req.user.id, balance: 0, loyaltyPoints: 0 });
        }

        wallet.balance += amount;
        wallet.loyaltyPoints += Math.round(amount * 0.1); // 10% points reward
        wallet.transactions.unshift({
            type: "credit",
            amount: amount,
            description: `Wallet recharge of ₹${amount}`
        });

        await wallet.save();

        res.json({
            message: "Funds added successfully",
            wallet
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to add funds",
            error: error.message
        });
    }
};

module.exports = {
    getWallet,
    addFunds
};
