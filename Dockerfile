# 1. Base image
FROM node:20-alpine AS builder

WORKDIR /app

# 2. Install dependencies
COPY package*.json ./
RUN npm install

# 3. Copy source and Prisma schema
COPY . .

# 4. Generate Prisma Client and Build the app
RUN npx prisma generate
RUN npm run build

# --- Production Image ---
FROM node:20-alpine

WORKDIR /app

# Copy only what we need from the builder
COPY --from=builder /app ./

EXPOSE 3000

# Start the application
CMD ["npm", "run", "start:prod"]