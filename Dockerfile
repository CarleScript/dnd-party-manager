FROM node:24.17.0-alpine

ENV NODE_ENV=production

RUN mkdir -p /app \
    && chown node:node /app \
    && corepack enable \
    && corepack prepare pnpm@11.0.5 --activate

USER node
WORKDIR /app

COPY --chown=node:node package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --chown=node:node . .

EXPOSE 3000

CMD [ "node", "src/server.js" ]