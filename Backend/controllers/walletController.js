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
        res.json({
            balance: 850,
            loyaltyPoints: 2450,
            transactions: [
                { type: "credit", amount: 500, description: "Welcome Wallet Bonus", createdAt: new Date() }
            ]
        });
    }
};

let inMemoryBalance = 850;

const addFunds = async (req, res) => {
    try {
        const { amount } = req.body;

        if (typeof amount !== 'number') {
            return res.status(400).json({
                message: "Valid amount number is required"
            });
        }

        let wallet = await Wallet.findOne({ user: req.user.id });

        if (!wallet) {
            wallet = new Wallet({ user: req.user.id, balance: 850, loyaltyPoints: 2450 });
        }

        wallet.balance = Math.max(0, wallet.balance + amount);
        if (amount > 0) {
            wallet.loyaltyPoints += Math.round(amount * 0.1);
        }

        const isCredit = amount >= 0;
        const absAmt = Math.abs(amount);

        wallet.transactions.unshift({
            type: isCredit ? "credit" : "debit",
            amount: absAmt,
            description: isCredit ? `Wallet recharge of ₹${absAmt}` : `Payment of ₹${absAmt}`
        });

        await wallet.save();

        res.json({
            message: "Wallet updated successfully",
            balance: wallet.balance,
            loyaltyPoints: wallet.loyaltyPoints
        });
    } catch (error) {
        const amount = req.body.amount || 0;
        inMemoryBalance = Math.max(0, inMemoryBalance + amount);
        res.json({
            message: "Wallet updated successfully (Demo mode)",
            balance: inMemoryBalance,
            loyaltyPoints: 2450
        });
    }
};

module.exports = {
    getWallet,
    addFunds
};
