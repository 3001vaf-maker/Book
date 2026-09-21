FROM node:24-alpine AS frontend-build
WORKDIR /app
COPY . .
RUN node scripts/build-pages.mjs

FROM node:24-alpine AS build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/prisma ./prisma
RUN npx prisma generate
COPY server/tsconfig.json server/nest-cli.json ./
COPY server/src ./src
RUN npm run build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app/server
COPY server/package*.json ./
COPY server/prisma ./prisma
COPY server/scripts ./scripts
COPY --from=build /app/server/node_modules ./node_modules
COPY --from=build /app/server/dist ./dist
COPY --from=frontend-build /app/_site /app/site
EXPOSE 3000
CMD ["sh", "-c", "node scripts/recover-global-account-migration.mjs; recovery_status=$?; if [ \"$recovery_status\" -eq 42 ]; then npx prisma migrate resolve --rolled-back 20260921130000_global_account_identity; elif [ \"$recovery_status\" -ne 0 ]; then exit \"$recovery_status\"; fi; npx prisma migrate deploy && npm run seed:owner && node dist/main.js"]
