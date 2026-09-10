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
RUN npm install --omit=dev
COPY server/prisma ./prisma
COPY --from=build /app/server/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/server/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/server/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
