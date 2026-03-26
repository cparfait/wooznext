# --- Stage 1: Dependencies ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Stage 2: Builder ---
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build
# Compile custom server
RUN npx tsc server.ts --outDir . --esModuleInterop --module commonjs --moduleResolution node --skipLibCheck

# --- Stage 3: Runner ---
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/socket.io ./node_modules/socket.io
COPY --from=builder /app/node_modules/socket.io-adapter ./node_modules/socket.io-adapter
COPY --from=builder /app/node_modules/socket.io-parser ./node_modules/socket.io-parser
COPY --from=builder /app/node_modules/engine.io ./node_modules/engine.io
COPY --from=builder /app/node_modules/engine.io-parser ./node_modules/engine.io-parser
COPY --from=builder /app/node_modules/ws ./node_modules/ws
COPY --from=builder /app/node_modules/cors ./node_modules/cors
COPY --from=builder /app/node_modules/base64id ./node_modules/base64id
COPY --from=builder /app/node_modules/@socket.io ./node_modules/@socket.io
# Custom server (compiled)
COPY --from=builder /app/server.js ./server.js

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
