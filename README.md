# Cache Warmer Bot

🤖 **Cache Warmer Bot** is a Telegram bot for warming up web page cache.  
It loads URLs from a sitemap file, “scrolls” them in the browser (**Puppeteer**) and thus speeds up the site for real users.  
The bot supports progress-bar, error logging and sending reports to the administrator.

---

## 🚀 Features

- ✅ Automatic page warming by Sitemap.
- ✅ Report in Telegram about the number of warmed pages and errors.
- ✅ Logging errors in `.log` files.
- ✅ Notifications to the administrator about launches and errors.
- ✅ Running on your own server via **Docker**.

---

## 🖼 Example of output

```
🚀 Cache warm-up running
🟩🟩🟩🟩⬜⬜⬜⬜⬜⬜ 40%

✅ Warm-up complete!
🔗 Total URLs: 120
✅ Successfully “warmed up” URLs: 118
❗ Errors: 2
```

---

## ✅ Requirements

1. **Server with public IP** (e.g. VPS).
2. **Domain** (mandatory! The bot works via Webhook and requires HTTPS).
3. **Properly configured DNS** (your domain must point to your server).
4. Installed:
   - [Docker](https://docs.docker.com/engine/install/)
   - [Docker Compose](https://docs.docker.com/compose/install/)
   - [Git](https://git-scm.com/downloads)
5. **Telegram bot** (created via [@BotFather](https://t.me/BotFather)).
6. **Administrative `chat_id`** in Telegram.
7. **Sitemap URL** of your website (e.g., `https://your-website.com/sitemap.xml`).
8. **SSL certificate**.
9. Open port **443** on the server.

---

## 🔧 Installation and first startup

### 1. Cloning the repository

```bash
git clone https://github.com/Kromvel-X/cache-warmer.git
cd cache-warmer
```

---

### 2. Creating `.env` file

Create a **`.env``** file in the root of the project:

```env
BOT_TOKEN=YOUR_TOKEN_BOTH
ADMIN_CHAT_ID=ID_ADMIN_CHAT_WHICH_WILL_RECEIVE_REPORTS
DOMAIN=example.com
SSL_CERT_PATH=/etc/letsencrypt/live/example.com/fullchain.pem
SSL_CERT_KEY_PATH=/etc/letsencrypt/live/example.com/privkey.pem
SITE_MAP_URL=https://your-website.com/sitemap.xml
LOG_DIR=/root/cache-warmer/logs
WEBHOOK_PORT=PORT_FOR_WEBHOOK
WEBHOOK_PATH=/yout-webhook-path
```

> ⚠️ **Important:**
> - `DOMAIN` must be bound to the server in advance!
> - SSL certificates must be obtained and available at the specified paths.
> - The webhook for the bot is automatically installed at startup.
---

### 3. Start

Start the containers:

```bash
docker compose up --build -d
```


Check the status of the bot:

```bash
curl -I https://your-domain.com/cache-warmer-status
```
There should be a **200 OK** response.

---


### 5. Checking the bot's operation

After a successful launch, the bot will automatically activate and listen to the webhook.  
In Telegram send:

```
/start
```

Then run the warm up:

```
/run_cache_warm
```

---

## 📂 Project structure

```
cache-warmer               
├─ nginx                   
│  └─ nginx.conf.template  # Nginx configuration files
├─ Dockerfile              # Dockerfile for the bot
├─ README.md               # Project documentation
├─ bot.js                  # Basic bot code
├─ cache-warm.js           # Cache warmup script
├─ docker-compose.yml      # Docker Compose file
├─ package-lock.json       # Dependency lock file
└─ package.json            # Project dependency file
```

---

## 🐳 Basic Docker commands

#### Restart bot after code update:

```bash
docker compose down --remove-orphans
docker compose up --build -d
```
---

### View bot logs in real time:

```bash
docker logs cache-warmer
```

### View Nginx logs in real time:

```bash
docker logs nginx
```

---

## Bot Logs:

All warmup errors are saved in the folder specified in `LOG_DIR`:

```bash
/root/cache-warmer/logs
```

The files are of the form:

```
warm-errors-YYYY-MM-DD-HH-MM-SS.log
```
---


## Verify Webhook
To verify the webhook, use the command:

```bash
curl https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo
```

The expected response should contain information about the current webhook, including path and status:

```json
{
  "ok": true,
  "result": {
    "url": "https://example.com/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "max_connections": 40,
    "ip_address": "your.server.ip.address"
   }
}
```
--- 

## License

The project is distributed under the MIT license.

---

**Author:** [Nikita Levkovich](https://github.com/Kromvel-X)
