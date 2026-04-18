# DigitalOcean Deployment Guide

This project is now a Node.js + Express + MongoDB web app. The clean production path is:

1. MongoDB Atlas or DigitalOcean Managed MongoDB
2. Ubuntu Droplet for the Node.js app
3. PM2 for process management
4. Nginx as the reverse proxy
5. Let's Encrypt for HTTPS
6. Namecheap DNS pointed to the droplet

## 1. Prepare the repository

On your local machine:

```bash
git clone https://github.com/op-h/myQRs.git
cd myQRs
```

## 2. Create MongoDB

Best option:
- Create a MongoDB Atlas cluster
- Create a database user
- Whitelist your droplet IP
- Copy the connection string

Example:

```env
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@cluster.mongodb.net/myqrs?retryWrites=true&w=majority
```

## 3. Create a DigitalOcean droplet

Recommended:
- Ubuntu 24.04 LTS
- Basic droplet
- 1 to 2 GB RAM minimum
- Region close to your users
- Add your SSH key

After the droplet is ready:

```bash
ssh root@YOUR_SERVER_IP
```

## 4. Install Node.js, Nginx, and PM2

```bash
apt update && apt upgrade -y
apt install -y nginx curl git ufw
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2
```

Check versions:

```bash
node -v
npm -v
pm2 -v
```

## 5. Clone the project on the server

```bash
cd /var/www
git clone https://github.com/op-h/myQRs.git
cd myQRs
npm install
```

## 6. Create the production environment file

```bash
cp .env.example .env
nano .env
```

Use values like:

```env
PORT=3000
NODE_ENV=production
APP_BASE_URL=https://myqrs.me
MONGODB_URI=YOUR_MONGODB_URI
SESSION_SECRET=MAKE_THIS_A_LONG_RANDOM_SECRET
```

## 7. Start the app with PM2

```bash
pm2 start server.js --name myqrs
pm2 save
pm2 startup
```

Check:

```bash
pm2 status
pm2 logs myqrs
```

## 8. Configure Nginx

Create the site config:

```bash
nano /etc/nginx/sites-available/myqrs
```

Paste:

```nginx
server {
    listen 80;
    server_name myqrs.me www.myqrs.me;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable it:

```bash
ln -s /etc/nginx/sites-available/myqrs /etc/nginx/sites-enabled/myqrs
nginx -t
systemctl reload nginx
```

## 9. Configure the firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

## 10. Point Namecheap to DigitalOcean

In Namecheap Advanced DNS:

- `A` record
  - Host: `@`
  - Value: `YOUR_SERVER_IP`

- `A` record
  - Host: `www`
  - Value: `YOUR_SERVER_IP`

Or:

- `A` record for `@`
- `CNAME` record for `www` -> `myqrs.me`

Wait for DNS propagation.

## 11. Enable HTTPS with Let's Encrypt

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d myqrs.me -d www.myqrs.me
```

Choose the redirect-to-HTTPS option when prompted.

Test renewal:

```bash
certbot renew --dry-run
```

## 12. Update the app

Whenever you push new code:

```bash
cd /var/www/myQRs
git pull
npm install
pm2 restart myqrs
```

## Recommended production extras

- Use MongoDB Atlas instead of hosting Mongo on the same droplet
- Add daily backups or snapshots on DigitalOcean
- Add rate limiting and email verification later
- Put the app behind DigitalOcean monitoring and alerts
- Use a stronger `SESSION_SECRET`

## Final checklist

- `https://myqrs.me` opens correctly
- Registration works
- Login works
- MongoDB saves QR items
- Protected secure links open at `/shared/:shareId`
- PM2 restarts the app after reboot
- Nginx proxies correctly
- HTTPS is active
