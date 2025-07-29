# Cache Warmer Bot

🤖 **Cache Warmer Bot** — это Telegram-бот для прогрева кэша веб-страниц.  
Он загружает URL-адреса из sitemap-файла, «прокручивает» их в браузере (**Puppeteer**) и тем самым ускоряет работу сайта для реальных пользователей.  
Бот поддерживает прогресс-бар, логирование ошибок и отправку отчётов администратору.

---

## 🚀 Возможности

- ✅ Автоматический прогрев страниц по Sitemap.
- ✅ Отчёт в Telegram о количестве прогретых страниц и ошибках.
- ✅ Логирование ошибок в `.log` файлы.
- ✅ Автоматическая выдача и продление SSL-сертификата через **Let's Encrypt**.
- ✅ Уведомления администратору о запусках и ошибках.
- ✅ Запуск на собственном сервере через **Docker**.

---

## 🖼 Пример работы

```
🚀 Cache warm-up running
🟩🟩🟩🟩⬜⬜⬜⬜⬜⬜ 40%

✅ Warm-up complete!
🔗 Total URLs: 120
✅ Successfully “warmed up” URLs: 118
❗ Errors: 2
```

---

## ✅ Требования

1. **Сервер с публичным IP** (например, VPS).
2. **Домен** (обязательно! Бот работает через Webhook и требует HTTPS).
3. Настроенный DNS (домен должен указывать на ваш сервер).
4. Установленные:
   - [Docker](https://docs.docker.com/engine/install/)
   - [Docker Compose](https://docs.docker.com/compose/install/)
   - [Git](https://git-scm.com/downloads)
5. **Телеграм-бот** (создаётся через [@BotFather](https://t.me/BotFather)).
6. **Ваш `chat_id`** в Telegram.
7. **Sitemap URL** вашего сайта (например, `https://example.com/sitemap.xml`).
8. **SSL-сертификат** (будет автоматически получен при первом запуске).
9. Открытые порты **80** и **443** на сервере.

---

## 🔧 Установка и первый запуск

### 1. Клонирование репозитория

```bash
git clone https://github.com/Kromvel-X/cache-warmer.git
cd cache-warmer
```

---

### 2. Создание `.env` файла

Создайте файл **`.env`** в корне проекта:

```
BOT_TOKEN=ВАШ_ТОКЕН_БОТА
ADMIN_CHAT_ID=ID_АДМИН_ЧАТА_В_КОТОРЫЙ_БУДУТ_ПРИХОДИТЬ_ОТЧЁТЫ
DOMAIN=your-domain.com
EMAIL=youremail@example.com
SITE_MAP_URL=https://your-website.com/sitemap.xml
LOG_DIR=/root/cache-warmer/logs
WEBHOOK_PORT=PORT_ДЛЯ_WEBHOOK
```

> ⚠️ **Важное:**
> - `DOMAIN` должен быть привязан к серверу заранее!
> - Сертификат будет автоматически сгенерирован только для указанного домена.
> - При старте выполняется автоматическая установка webhook для бота.
---

### 3. Запуск

Запустите сервис:

```bash
docker compose up --build -d
```

Проверьте логи Certbot:

```bash
docker logs -f certbot
```

Если всё успешно, вы увидите:

```
✅ Certificate obtained
```

Проверьте сайт:

```bash
curl -I https://your-domain.com
```

Должен быть ответ **200 OK**.

---

### 4. **Что нельзя делать!**

⚠️ **НИКОГДА не используйте команду с `-v`, если не хотите заново запрашивать сертификат!**  

Команда:

```bash
docker compose down -v
```

удаляет тома Docker, включая сертификаты в `/etc/letsencrypt`.  
Если вы её используете, нужно будет снова получать сертификат, и вы рискуете попасть под [лимиты Let's Encrypt](https://letsencrypt.org/docs/rate-limits/).

Для остановки используйте:

```bash
docker compose down
```

А для перезапуска:

```bash
docker compose restart
```

---

### 5. Проверка работы бота

После успешного запуска бот автоматически активируется и слушает вебхуки.  
В Telegram отправьте:

```
/start
```

Затем запустите прогрев:

```
/run_cache_warm
```

---

## 📂 Структура проекта

```
cache-warmer/
│
├── bot.js                         # Основной код Telegram-бота
├── cache-warm.js                  # Логика прогрева страниц
├── Dockerfile                     # Docker-образ с Node.js и Chromium
├── docker-compose.yml             # Конфигурация всех сервисов (бот + nginx + certbot)
├── nginx/
│   ├── nginx.http.conf.template   # Конфигурация для получения сертификата
│   └── nginx.https.conf.template  # Конфигурация для работы по HTTPS
├── logs/                          # Логи прогрева (создаются автоматически)
│── README.md                      # Этот файл
└── .env                           # Конфигурация проекта (создаётся вручную)
```

---

## 🐳 Основные Docker-команды

### Логи бота:

Все ошибки прогрева сохраняются в папке, указанной в `LOG_DIR`:

```bash
/root/cache-warmer/logs
```

Файлы имеют вид:

```
warm-errors-YYYY-MM-DD-HH-MM-SS.log
```

### Логи Certbot:

```bash
docker logs -f certbot
```

### Перезапуск бота:

```bash
docker compose restart cache-warmer
```

### Просмотр логов внутри контейнера:

```bash
docker exec -it cache-warmer sh
cd logs
ls -l
```

---

## 🔄 Обновление

Для обновления кода:

```bash
git pull
docker compose down
docker compose up --build -d
```

### Перезапуск бота после обновления кода:

```bash
docker compose down
docker compose up --build -d
```

---

## 🔐 Автоматическое продление сертификата

Certbot в контейнере настроен на автоматическое продление сертификатов каждые 12 часов.  
Логи продления можно смотреть:

```bash
docker logs -f certbot
```

---

## ℹ️ Полезные советы

- Дождитесь, пока Certbot завершит генерацию сертификата при первом запуске.
- Если домен не привязан к серверу, Certbot не сможет получить сертификат.
- Для тестов можно использовать **staging-сертификаты** (в `docker-compose.yml` добавьте флаг `--staging` для Certbot).

---

## ❓ Часто задаваемые вопросы

### 1. Как бот подключается к Telegram?

При старте выполняется автоматическая установка webhook:

```
https://<DOMAIN>/webhook
```

Вручную выполнять `setWebhook` через `curl` **не нужно**.

### 2. Как перенести бота на другой сервер?

- Настройте DNS-домен на новый сервер  
- Скопируйте проект или заново клонируйте из GitHub  
- Создайте `.env` с новыми данными  
- Запустите:

```bash
docker compose up --build -d
```

Certbot автоматически сгенерирует новый сертификат.

---

## 📜 Лицензия

The project is distributed under the MIT license.

---

**Автор:** 

Author: Nikita Levkovich @kromvelll
