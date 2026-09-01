# === Этап 1: Сборка (Build) ===
FROM node:24-alpine AS builder

WORKDIR /app

# Копируем package.json и устанавливаем зависимости
COPY package*.json ./
RUN npm install

# Копируем весь исходный код проекта
COPY . .

RUN mkdir -p src/data && \
    wget -O src/data/changelog.yml "https://raw.githubusercontent.com/TheMaidDev/Maid-14/refs/heads/main/Resources/Changelog/MaidChangelog.yml"

# Собираем статический сайт
RUN npm run build

# === Этап 2: Раздача статики (Production) ===
FROM nginx:alpine

# Копируем собранный сайт из первого этапа в Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Открываем 80 порт
EXPOSE 80

# Запускаем Nginx
CMD ["nginx", "-g", "daemon off;"]