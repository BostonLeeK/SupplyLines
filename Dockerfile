FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY index.html world.html net.js sw.js manifest.json og.jpg ./
COPY game ./game
COPY icons ./icons
COPY server/server.mjs ./server/server.mjs
# world saves, players and the generated VAPID key live here
ENV DATA_DIR=/data PORT=5177
RUN mkdir -p /data && chown node:node /data
VOLUME /data
EXPOSE 5177
USER node
CMD ["node", "server/server.mjs"]
