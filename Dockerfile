# --- Stage 1: Build ---
FROM node:20 AS builder
WORKDIR /app

# Copy package files and install ALL dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the source code
COPY . .

# Generate Prisma client and build the app
RUN npx prisma generate
RUN npm run build

# --- Stage 2: Run ---
FROM node:20-slim
WORKDIR /app

# Copy only the necessary files from the builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
# Copy prisma folder if you need it for migrations at runtime
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

# Start the app
CMD [ "npm", "run", "start:prod" ]