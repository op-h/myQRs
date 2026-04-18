const crypto = require("crypto");
const express = require("express");
const QrItem = require("../models/QrItem");

const router = express.Router();

function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized." });
    }
    return next();
}

function resolveBaseUrl(req) {
    const forwardedProto = req.headers["x-forwarded-proto"];
    const protocol = forwardedProto ? String(forwardedProto).split(",")[0].trim() : req.protocol;
    const host = req.get("host");
    if (host) {
        return `${protocol}://${host}`;
    }

    return req.app.locals.appBaseUrl;
}

function toPublicQr(item, req) {
    const secureUrl = item.secure?.shareId ? `${resolveBaseUrl(req)}/shared/${item.secure.shareId}` : "";
    return {
        id: item._id.toString(),
        title: item.title,
        type: item.type,
        label: item.label,
        payload: item.type === "secure" ? secureUrl : item.payload,
        options: item.options || {},
        isFavorite: item.isFavorite,
        shareUrl: secureUrl,
        secureHint: item.secure?.hint || "",
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
    };
}

router.use(requireAuth);

router.get("/", async (req, res) => {
    try {
        const items = await QrItem.find({ user: req.session.userId }).sort({ createdAt: -1 });
        const stats = {
            total: items.length,
            protected: items.filter((item) => item.type === "secure").length,
            favorites: items.filter((item) => item.isFavorite).length
        };

        return res.json({
            items: items.map((item) => toPublicQr(item, req)),
            stats
        });
    } catch (error) {
        return res.status(500).json({ message: "Failed to load QR library." });
    }
});

router.post("/", async (req, res) => {
    try {
        const title = String(req.body.title || "").trim();
        const type = String(req.body.type || "").trim();
        const label = String(req.body.label || "").trim();
        const payload = String(req.body.payload || "");
        const options = req.body.options || {};

        if (!title || !type) {
            return res.status(400).json({ message: "Title and type are required." });
        }

        const doc = {
            user: req.session.userId,
            title,
            type,
            label,
            payload,
            options,
            isFavorite: Boolean(options.favorite)
        };

        if (type === "secure") {
            const secure = req.body.secure || {};
            if (!secure.salt || !secure.iv || !secure.data) {
                return res.status(400).json({ message: "Protected QR payload is incomplete." });
            }

            doc.secure = {
                hint: String(secure.hint || "").trim(),
                salt: String(secure.salt),
                iv: String(secure.iv),
                data: String(secure.data),
                zip: Boolean(secure.zip),
                shareId: crypto.randomBytes(8).toString("hex")
            };
            doc.payload = "";
        }

        const item = await QrItem.create(doc);
        return res.status(201).json({ item: toPublicQr(item, req) });
    } catch (error) {
        return res.status(500).json({ message: "Failed to save QR item." });
    }
});

router.patch("/:id/favorite", async (req, res) => {
    try {
        const item = await QrItem.findOne({ _id: req.params.id, user: req.session.userId });
        if (!item) {
            return res.status(404).json({ message: "QR item not found." });
        }

        item.isFavorite = !item.isFavorite;
        await item.save();

        return res.json({ item: toPublicQr(item, req) });
    } catch (error) {
        return res.status(500).json({ message: "Failed to update favorite state." });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const result = await QrItem.deleteOne({ _id: req.params.id, user: req.session.userId });
        if (!result.deletedCount) {
            return res.status(404).json({ message: "QR item not found." });
        }
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ message: "Failed to delete QR item." });
    }
});

module.exports = router;
