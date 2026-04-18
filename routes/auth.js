const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const router = express.Router();

function sanitizeUser(user) {
    return {
        id: user._id.toString(),
        name: user.name,
        email: user.email
    };
}

router.post("/register", async (req, res) => {
    try {
        const name = String(req.body.name || "").trim();
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");

        if (!name || !email || !password) {
            return res.status(400).json({ message: "Name, email, and password are required." });
        }

        if (password.length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 characters." });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: "That email is already registered." });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const user = await User.create({ name, email, passwordHash });

        req.session.userId = user._id.toString();

        return res.status(201).json({ user: sanitizeUser(user) });
    } catch (error) {
        return res.status(500).json({ message: "Registration failed." });
    }
});

router.post("/login", async (req, res) => {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required." });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: "Invalid email or password." });
        }

        const matches = await bcrypt.compare(password, user.passwordHash);
        if (!matches) {
            return res.status(401).json({ message: "Invalid email or password." });
        }

        req.session.userId = user._id.toString();
        return res.json({ user: sanitizeUser(user) });
    } catch (error) {
        return res.status(500).json({ message: "Login failed." });
    }
});

router.post("/logout", (req, res) => {
    req.session.destroy(() => {
        res.clearCookie("myqrs.sid");
        res.json({ success: true });
    });
});

router.get("/me", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ message: "Unauthorized." });
        }

        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(401).json({ message: "Unauthorized." });
        }

        return res.json({ user: sanitizeUser(user) });
    } catch (error) {
        return res.status(500).json({ message: "Failed to load profile." });
    }
});

module.exports = router;
