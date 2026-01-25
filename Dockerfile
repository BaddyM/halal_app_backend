FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
COPY config ./config

RUN npm install

COPY . .

RUN npm run build
RUN npx prisma generate

# ---- FINAL IMAGE ----
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/config ./config

ENV PORT=3004
ENV SYSTEM_SECRET="MYAUTHSECRETISVERYSTRONG"

# Expose application port
EXPOSE 3004

# Start the application
CMD ["node", "dist/src/main"]