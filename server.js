require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");

const authRoutes = require("./routes/auth");
const qrRoutes = require("./routes/qrs");
const sharedRoutes = require("./routes/shared");

const app = express();
const port = Number(process.env.PORT || 3000);
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/myqrs";
const sessionSecret = process.env.SESSION_SECRET || "change-me";

app.set("trust proxy", 1);
app.locals.appBaseUrl = process.env.APP_BASE_URL ? process.env.APP_BASE_URL.replace(/\/$/, "") : "";

mongoose
    .connect(mongoUri)
    .then(() => {
        console.log("MongoDB connected");
    })
    .catch((error) => {
        console.error("MongoDB connection failed:", error.message);
        process.exit(1);
    });

app.use(
    helmet({
        contentSecurityPolicy: false
    })
);
app.use(compression());
app.use(morgan("dev"));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(
    session({
        name: "myqrs.sid",
        secret: sessionSecret,
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({ mongoUrl: mongoUri }),
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 1000 * 60 * 60 * 24 * 14
        }
    })
);

app.use("/api/auth", authRoutes);
app.use("/api/qrs", qrRoutes);
app.use("/api/shared", sharedRoutes);

app.get("/styles.css", (req, res) => res.sendFile(path.join(__dirname, "styles.css")));
app.get("/app.js", (req, res) => res.sendFile(path.join(__dirname, "app.js")));
app.get("/qrcode.min.js", (req, res) => res.sendFile(path.join(__dirname, "qrcode.min.js")));
app.get("/jsQR.js", (req, res) => res.sendFile(path.join(__dirname, "jsQR.js")));

function sendFrontend(req, res) {
    return res.sendFile(path.join(__dirname, "index.html"));
}

app.get("/", sendFrontend);
app.get("/shared/:shareId", sendFrontend);

app.use((req, res) => {
    res.status(404).json({ message: "Not found." });
});

app.listen(port, () => {
    console.log(`myQRs listening on http://localhost:${port}`);
});
