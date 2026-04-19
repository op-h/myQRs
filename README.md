# myqrs.me

<p align="center">
  Full-stack QR workspace with authentication, protected QR routes, MongoDB-backed history, and a premium THM-inspired interface.
</p>

<p align="center">
  <a href="https://myqrs.me"><img alt="Live Site" src="https://img.shields.io/badge/live-myqrs.me-ff4655?style=for-the-badge"></a>
  <img alt="Node 20+" src="https://img.shields.io/badge/node-20%2B-101218?style=for-the-badge">
  <img alt="Express" src="https://img.shields.io/badge/express-4.x-101218?style=for-the-badge">
  <img alt="MongoDB" src="https://img.shields.io/badge/mongodb-8.x-101218?style=for-the-badge">
  <img alt="License" src="https://img.shields.io/badge/status-private%20project-101218?style=for-the-badge">
</p>

---

## Overview

`myqrs.me` is a QR web application built as a complete product instead of a basic generator.

It supports:

- account registration and login
- saved QR history per user
- protected QR links with pass-code unlock flow
- responsive desktop and mobile UI
- export, copy, share, favorite, and reuse workflows

The app is designed around a security-oriented dashboard style inspired by the TryHackMe visual direction, adapted for a custom QR platform.

---

## Core Features

### QR Generation

- Website QR
- Text QR
- WiFi QR
- Contact QR
- Email QR
- Protected QR

### Protected QR Flow

- secret message is encrypted in the browser
- secure payload is stored server-side
- QR points to a short `/shared/:shareId` route
- user scans the QR and lands on an unlock screen
- message is revealed only after entering the correct pass code

### Account Features

- registration and login
- persistent QR library
- favorite/unfavorite actions
- secure-link copy
- delete and preview actions

### Export / Share

- PNG download
- clipboard image copy where supported
- browser share support with fallbacks depending on platform capability

---

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | HTML, CSS, JavaScript, Bootstrap |
| Backend | Node.js, Express |
| Database | MongoDB, Mongoose |
| Sessions | `express-session`, `connect-mongo` |
| Security | Helmet, AES-GCM (Web Crypto), PBKDF2 |
| Server Utilities | Compression, Morgan |
| Deployment | DigitalOcean, Nginx, PM2, Let's Encrypt |

---

## Project Structure

```text
myqrs.me/
├─ models/
│  ├─ QrItem.js
│  └─ User.js
├─ routes/
│  ├─ auth.js
│  ├─ qrs.js
│  └─ shared.js
├─ app.js
├─ index.html
├─ styles.css
├─ server.js
├─ qrcode.min.js
├─ jsQR.js
├─ .env.example
├─ package.json
└─ DEPLOY_DIGITALOCEAN.md
```

---

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Create environment file

Copy `.env.example` to `.env` and set real values.

Example:

```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/myqrs
SESSION_SECRET=replace-with-a-long-random-secret
APP_BASE_URL=http://localhost:3000
NODE_ENV=development
```

### 3. Start the server

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | No | Express server port |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `SESSION_SECRET` | Yes | Session signing secret |
| `APP_BASE_URL` | Yes | Base URL used to generate secure QR links |
| `NODE_ENV` | No | Enables production cookie behavior |

---

## Production Notes

For production deployment, this repository is intended to run behind:

- Nginx as reverse proxy
- PM2 as process manager
- DigitalOcean Managed MongoDB
- HTTPS via Let's Encrypt

Detailed deployment instructions are documented in:

- [DEPLOY_DIGITALOCEAN.md](./DEPLOY_DIGITALOCEAN.md)

---

## Security Notes

- protected messages are encrypted client-side before storage
- unlock flow uses a dedicated route instead of embedding plaintext in the QR
- sessions are stored in MongoDB
- Express is protected with `helmet`
- production cookies are marked secure when `NODE_ENV=production`

This improves privacy, but it is still a web application and should be deployed with proper HTTPS, strong secrets, and a production-grade MongoDB configuration.

---

## Design Direction

The UI is intentionally built around:

- dark tactical dashboard styling
- THM-inspired red/charcoal palette
- high-contrast typography
- responsive panel-based layout
- minimal but controlled glitch/chrome effects

The design goal is clarity first, with a stronger premium feel than a default CRUD dashboard.

---

## Future Expansion

Possible next upgrades:

- email verification
- password reset flow
- admin analytics
- scan tracking
- QR folders / tagging
- user profile settings
- multi-language support
- richer share and export options

---

## Author

Designed and developed for the `myqrs.me` project by the OPH team.

