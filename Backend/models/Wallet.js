const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true
        },

        balance: {
            type: Number,
            default: 850,
            min: 0
        },

        loyaltyPoints: {
            type: Number,
            default: 2450,
            min: 0
        },

        transactions: [
            {
                type: {
                    type: String,
                    enum: ["credit", "debit"],
                    required: true
                },
                amount: {
                    type: Number,
                    required: true
                },
                description: String,
                timestamp: {
                    type: Date,
                    default: Date.now
                }
            }
        ]
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Wallet", walletSchema);
