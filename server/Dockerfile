FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Gera o Prisma Client a partir do schema
RUN npx prisma generate

EXPOSE 3000

# Roda migrations e depois inicia o servidor
CMD ["sh", "-c", "npx prisma migrate deploy && node index.js"]
