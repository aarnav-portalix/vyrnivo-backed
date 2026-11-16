FROM node:24-bookworm-slim AS cobalt
RUN apt-get update && apt-get install -y --no-install-recommends git python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@9.6.0
RUN git clone https://github.com/imputnet/cobalt.git /opt/cobalt && cd /opt/cobalt && git checkout a636575b09de1fc55d9b8cd98cac88f5f2f16b42 && pnpm install --filter @imput/cobalt-api... --frozen-lockfile
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY src ./src
COPY worker ./worker
COPY dist/index.html ./dist/index.html
COPY build.cjs ./
RUN node build.cjs
FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=10000
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/downloader && /opt/downloader/bin/pip install --no-cache-dir "yt-dlp[default]"
ENV PYTHON=/opt/downloader/bin/python
COPY --from=cobalt /opt/cobalt /opt/cobalt
COPY --from=build /app/dist ./dist
COPY hosting ./hosting
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 10000
CMD ["sh", "-c", "node hosting/cobalt-probe.mjs & exec node hosting/server.mjs"]
