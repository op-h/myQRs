const express = require("express");
const QrItem = require("../models/QrItem");

const router = express.Router();

router.get("/:shareId", async (req, res) => {
    try {
        const item = await QrItem.findOne({ "secure.shareId": req.params.shareId, type: "secure" });
        if (!item || !item.secure) {
            return res.status(404).json({ message: "Protected QR not found." });
        }

        return res.json({
            title: item.title,
            hint: item.secure.hint || "",
            salt: item.secure.salt,
            iv: item.secure.iv,
            data: item.secure.data,
            zip: item.secure.zip
        });
    } catch (error) {
        return res.status(500).json({ message: "Failed to load protected QR." });
    }
});

module.exports = router;
