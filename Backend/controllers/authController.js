const mongoose = require("mongoose");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// In-memory fallback user database for when MongoDB is offline
const memoryUsers = new Map();
// Seed default user
memoryUsers.set("rahul.sharma@example.com", {
    id: "usr_demo123",
    name: "Rahul Sharma",
    email: "rahul.sharma@example.com",
    phone: "+91 98765 43210",
    passwordHash: bcrypt.hashSync("password123", 10),
    role: "user"
});

const isDbConnected = () => mongoose.connection.readyState === 1;

const register = async (req, res) => {
    try {
        const { name, firstName, lastName, email, phone, password } = req.body;
        const userName = name || (firstName ? `${firstName} ${lastName || ''}`.trim() : "User");

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        if (isDbConnected()) {
            try {
                const existingUser = await User.findOne({ email: normalizedEmail });
                if (existingUser) {
                    return res.status(400).json({
                        message: "User already exists with this email"
                    });
                }

                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(password, salt);

                const user = await User.create({
                    name: userName,
                    email: normalizedEmail,
                    phone: phone || "",
                    password: hashedPassword
                });

                const token = jwt.sign(
                    { id: user._id, role: user.role },
                    process.env.JWT_SECRET || "smartpark_secret",
                    { expiresIn: "7d" }
                );

                return res.status(201).json({
                    message: "User registered successfully",
                    token,
                    user: {
                        id: user._id,
                        name: user.name,
                        email: user.email,
                        phone: user.phone,
                        role: user.role
                    }
                });
            } catch (dbError) {
                // fall through to memoryUsers
            }
        }

        // DB Offline or Fallback Mode
        if (memoryUsers.has(normalizedEmail)) {
            return res.status(400).json({
                message: "User already exists with this email"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            id: "usr_" + Date.now(),
            name: userName,
            email: normalizedEmail,
            phone: phone || "",
            passwordHash: hashedPassword,
            role: "user"
        };
        memoryUsers.set(normalizedEmail, newUser);

        const token = jwt.sign(
            { id: newUser.id, role: newUser.role },
            process.env.JWT_SECRET || "smartpark_secret",
            { expiresIn: "7d" }
        );

        return res.status(201).json({
            message: "User registered successfully",
            token,
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                phone: newUser.phone,
                role: newUser.role
            }
        });
    } catch (error) {
        res.status(500).json({
            message: "Registration failed",
            error: error.message
        });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        if (isDbConnected()) {
            try {
                const user = await User.findOne({ email: normalizedEmail });
                if (user) {
                    const isMatch = await bcrypt.compare(password, user.password);
                    if (!isMatch) {
                        return res.status(400).json({ message: "Invalid email or password" });
                    }

                    const token = jwt.sign(
                        { id: user._id, role: user.role },
                        process.env.JWT_SECRET || "smartpark_secret",
                        { expiresIn: "7d" }
                    );

                    return res.json({
                        message: "Login successful",
                        token,
                        user: {
                            id: user._id,
                            name: user.name,
                            email: user.email,
                            phone: user.phone,
                            role: user.role
                        }
                    });
                }
            } catch (dbErr) {
                // fall through to memoryUsers
            }
        }

        // In-memory user lookup fallback
        const memUser = memoryUsers.get(normalizedEmail);
        if (memUser) {
            const isMatch = await bcrypt.compare(password, memUser.passwordHash);
            if (!isMatch) {
                return res.status(400).json({ message: "Invalid email or password" });
            }

            const token = jwt.sign(
                { id: memUser.id, role: memUser.role },
                process.env.JWT_SECRET || "smartpark_secret",
                { expiresIn: "7d" }
            );

            return res.json({
                message: "Login successful",
                token,
                user: {
                    id: memUser.id,
                    name: memUser.name,
                    email: memUser.email,
                    phone: memUser.phone,
                    role: memUser.role
                }
            });
        }

        return res.status(400).json({
            message: "Invalid email or password"
        });

    } catch (error) {
        res.status(500).json({
            message: "Login failed",
            error: error.message
        });
    }
};

const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");
        res.json(user);
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch user profile",
            error: error.message
        });
    }
};

module.exports = {
    register,
    login,
    getMe
};