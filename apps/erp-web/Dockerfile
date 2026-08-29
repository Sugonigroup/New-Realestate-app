FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/erp-web ./apps/erp-web
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @buildos/ui --filter @buildos/money-utils --filter @buildos/permissions build
RUN pnpm --filter @buildos/erp-web exec next build

FROM node:22-alpine AS runtime
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
ENV NODE_ENV=production
COPY --from=build /app/apps/erp-web ./.next/standalone ./
COPY --from=build /app/apps/erp-web/.next/static ./apps/erp-web/.next/static
USER app
EXPOSE 3000
CMD ["node", "apps/erp-web/server.js"]
