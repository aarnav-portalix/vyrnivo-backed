FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY src ./src
COPY worker ./worker
COPY dist/index.html ./dist/index.html
COPY build.cjs ./
COPY google820cceee3edb5964.html ./
RUN node build.cjs
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=10000
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ffmpeg && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/downloader && /opt/downloader/bin/pip install --no-cache-dir "yt-dlp[default]"
ENV PYTHON=/opt/downloader/bin/python
COPY --from=build /app/dist ./dist
COPY hosting ./hosting
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 10000
CMD ["node", "hosting/server.mjs"]
