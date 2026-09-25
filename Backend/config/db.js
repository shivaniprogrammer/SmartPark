const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 2000 });
        console.log("MongoDB connected successfully");
    } catch (error) {
        console.warn("⚠️ MongoDB offline or unreachable. Backend running in in-memory fallback mode.");
    }
};

module.exports = connectDB;