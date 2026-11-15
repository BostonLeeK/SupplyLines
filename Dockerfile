FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY index.html world.html icons.js i18n.js i18n-uk.js net.js sw.js manifest.json og.jpg ./
COPY game ./game
COPY icons ./icons
COPY server/*.mjs ./server/
# world saves, players and the generated VAPID key live here
ENV DATA_DIR=/data PORT=5177
RUN mkdir -p /data && chown node:node /data
VOLUME /data
EXPOSE 5177
USER node
HEALTHCHECK --interval=60s --timeout=5s --start-period=40s --retries=3 CMD wget -qO- http://127.0.0.1:5177/healthz >/dev/null || exit 1
CMD ["node", "server/server.mjs"]
