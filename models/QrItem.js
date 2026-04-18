const mongoose = require("mongoose");

const securePayloadSchema = new mongoose.Schema(
    {
        hint: {
            type: String,
            default: "",
            maxlength: 160
        },
        salt: {
            type: String,
            required: true
        },
        iv: {
            type: String,
            required: true
        },
        data: {
            type: String,
            required: true
        },
        zip: {
            type: Boolean,
            default: false
        },
        shareId: {
            type: String,
            unique: true,
            sparse: true
        }
    },
    { _id: false }
);

const qrItemSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120
        },
        type: {
            type: String,
            enum: ["url", "text", "wifi", "contact", "email", "secure"],
            required: true
        },
        label: {
            type: String,
            default: "",
            trim: true,
            maxlength: 120
        },
        payload: {
            type: String,
            default: ""
        },
        options: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        isFavorite: {
            type: Boolean,
            default: false
        },
        secure: {
            type: securePayloadSchema,
            default: undefined
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("QrItem", qrItemSchema);
