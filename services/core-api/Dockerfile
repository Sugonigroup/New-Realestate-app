# Multi-stage build (WP-0B). Non-root runtime; migrations run as a separate
# deploy step (expand-contract), not at boot.
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY services/core-api ./services/core-api
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @buildos/money-utils --filter @buildos/permissions --filter @buildos/core-api build

FROM node:22-alpine AS runtime
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
ENV NODE_ENV=production
COPY --from=build /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=build /app/services/core-api/dist ./dist
COPY --from=build /app/services/core-api/node_modules ./services/core-api/node_modules
COPY --from=build /app/services/core-api/package.json ./services/core-api/
COPY --from=build /app/services/core-api/prisma ./services/core-api/prisma
USER app
EXPOSE 8080
WORKDIR /app/services/core-api
CMD ["node", "dist/src/main.js"]
