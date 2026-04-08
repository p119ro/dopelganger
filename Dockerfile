FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run db:generate

EXPOSE 3000

CMD ["node", "server/server.js"]
