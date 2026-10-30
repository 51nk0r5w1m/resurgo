FROM node:26.13.0-bookworm-slim@sha256:bc0a2afd3b74ce12222fc8bab99271e66257f021078f5f4a5d687a77d280c1d9

ENV NODE_ENV=production \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH

RUN npm install --global pnpm@12.16.1
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/document-worker/package.json apps/document-worker/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/documents/package.json packages/documents/package.json
RUN pnpm install --frozen-lockfile --prod

COPY apps/document-worker apps/document-worker
COPY packages/config packages/config
COPY packages/db packages/db
COPY packages/documents packages/documents

USER node
CMD ["./apps/document-worker/node_modules/.bin/tsx", "apps/document-worker/src/index.ts"]
