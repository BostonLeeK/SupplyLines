# Deploying Supply Lines to a VPS

The game is one Node.js process that serves the pages and a WebSocket on `/ws`. With Docker it is one container
listening on one port; put it behind the web server you already run on the VPS (nginx, Apache, Caddy, Traefik) for the domain and HTTPS.

## 1. Start the container

```bash
git clone https://github.com/BostonLeeK/SupplyLines.git supply-lines
cd supply-lines
docker compose up -d --build
```

The game now answers on `http://<server>:5177`. To use another host port, set `HOST_PORT` (see Settings).

## 2. Point the domain at it

Proxy `globalwar.xyz` to `127.0.0.1:5177`. The proxy **must pass WebSocket upgrades** for `/ws`, or the game falls back
to offline practice mode.

nginx example:

```nginx
server {
    server_name globalwar.xyz www.globalwar.xyz;
    # listen 443 ssl; ssl_certificate ...; (as you already do for HTTPS)

    location / {
        proxy_pass http://127.0.0.1:5177;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 1h;
    }
}
```

`X-Forwarded-For` matters: the server limits connections per IP, and without it every player looks like the proxy.

HTTPS is required for push notifications and for installing the game as an app (PWA).

## Settings

Put them in a `.env` file next to `docker-compose.yml` (it is git-ignored):

```env
HOST_PORT=5177
SIM_SPEED=1
BOTS=300
VAPID_SUBJECT=mailto:you@your-domain
```

`SIM_SPEED` sets the pace: at `1` a season lasts 15 minutes of real time, at `0.25` an hour, at `0.0417` a full day.

## Updating

```bash
git pull
docker compose up -d --build
```

The world, players and squads live in the `game-data` Docker volume and survive updates and restarts.
The VAPID key for push notifications is generated there on first start; keep that volume, or every player's
notification subscription stops working.

## Logs and backups

```bash
docker compose logs -f game
docker run --rm -v supply-lines_game-data:/data -v "$PWD":/backup alpine tar czf /backup/game-data.tgz -C /data .
```

## Without Docker

Install Node.js 20+, then run `npm ci --omit=dev && npm start` under systemd or pm2 (`DATA_DIR` sets where saves go),
behind the same proxy config as above.
