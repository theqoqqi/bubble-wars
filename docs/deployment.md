# Инструкция по развертыванию Bubble Wars на VPS

## 📋 Как клиент узнает адрес сервера

В игре реализована **многоуровневая система автоматического определения адреса**:

1. **В интерфейсе игры (В меню)**:
   - В меню появилось поле **«СЕРВЕР»**, куда можно ввести любой адрес (например: `ws://123.45.67.89:3000` или `wss://game.my-domain.com`). Адрес сохраняется в памяти браузера (`localStorage`).

2. **Через URL-параметр ссылки**:
   - Можно отправить друзьям прямую ссылку:
     `https://your-site.com/?server=ws://123.45.67.89:3000`
     (клиент автоматически подставит и сохранит этот сервер).

3. **Через переменную сборки Vite (`.env`)**:
   - Создайте `packages/client/.env.production`:
     ```env
     VITE_WS_URL=wss://game.my-domain.com
     ```

4. **Автоматический fallback (Рекомендуемый)**:
   - Если сервер и клиент работают на одном хосте (или за Nginx), клиент автоматически подключается по `ws://хост:3000` или по защищенному `wss://хост` при работе по HTTPS.

---

## 🚀 Вариант 1. Развертывание через Docker (Рекомендуемый)

На сервере установлен Docker и Docker Compose.

1. **Склонируйте репозиторий на VPS**:
   ```bash
   git clone https://github.com/ВАШ_ЛОГИН/ИМЯ_РЕПОЗИТОРИЯ.git /opt/bubble-wars
   cd /opt/bubble-wars
   ```

2. **Запустите контейнер одной командой**:
   ```bash
   docker compose up -d --build
   ```

3. **Проверьте логи**:
   ```bash
   docker compose logs -f
   ```

Сервер запустится на порту `3000` и будет автоматически раздавать как веб-интерфейс игры, так и WebSocket бэкенд по адресу `http://ВАШ_IP_СЕРВЕРА:3000`.

---

## 📦 Вариант 2. Развертывание через Node.js + PM2

На сервере установлен Node.js (v20+) и PM2 (`npm i -g pm2`).

1. **Склонируйте репозиторий и соберите проект**:
   ```bash
   git clone https://github.com/ВАШ_ЛОГИН/ИМЯ_РЕПОЗИТОРИЯ.git /opt/bubble-wars
   cd /opt/bubble-wars
   npm ci
   npm run build
   ```

2. **Запустите процесс через PM2**:
   ```bash
   pm2 start ecosystem.config.cjs
   pm2 save
   pm2 startup
   ```

---

## 🌐 Вариант 3. Настройка домена и SSL (Nginx + Certbot)

Если вы хотите привязать домен (например, `game.example.com`) и получить бесплатный SSL-сертификат:

1. **Скопируйте `nginx.conf` в конфигурацию Nginx**:
   ```bash
   sudo cp nginx.conf /etc/nginx/sites-available/bubble-wars
   sudo nano /etc/nginx/sites-available/bubble-wars
   # Замените your-domain.com на ваш домен
   sudo ln -s /etc/nginx/sites-available/bubble-wars /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

2. **Получите бесплатный SSL через Let's Encrypt**:
   ```bash
   sudo certbot --nginx -d game.example.com
   ```

После этого игра будет доступна по защищенному `https://game.example.com`, а WebSocket автоматически подключится по `wss://game.example.com`!
