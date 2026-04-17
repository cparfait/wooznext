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
RUN ./node_modules/.bin/prisma generate
RUN npm run build
RUN npx tsc server.ts src/lib/socket-server.ts src/lib/scheduler.ts src/lib/prisma.ts --outDir dist --esModuleInterop --module commonjs --moduleResolution node --target es2020 --skipLibCheck

# --- Stage 3: Runner ---
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma/migrations ./prisma/migrations
COPY --from=builder /app/dist/server.js ./server.js
COPY --from=builder /app/dist/src ./src

COPY --from=builder /app/node_modules ./node_modules
RUN chown -R nextjs:nodejs /app/node_modules

RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["./entrypoint.sh"]
