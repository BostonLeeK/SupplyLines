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
SIM_SPEED=0.125
BOTS=120
VAPID_SUBJECT=mailto:you@your-domain
```

`SIM_SPEED` sets the pace: at `0.125` (the default) a season lasts 2 hours of real time, at `1` 15 minutes, at `0.0104` a full day. `CP_SECONDS` (default `45`) is how many real seconds one command point takes to refill, so a longer season does not starve players of CP.

## Optional: the fast room

`docker compose up` also starts a second world, the **fast room**, on port `5178`: a season there lasts about 30 minutes
(`FAST_SIM_SPEED=0.5`, one CP every `FAST_CP_SECONDS=15` s). It is for a quick test game, keeps its own players and seasons,
posts no news and sends no push notifications. Serve it under `/fast/` next to the main game:

```nginx
    location = /fast { return 301 /fast/; }
    location /fast/ {
        proxy_pass http://127.0.0.1:5178/;     # the trailing slash strips /fast from the path
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 1h;
    }
```

Then add `FAST_URL=/fast/` to `.env` and restart: the main intro screen shows a **QUICK 30-MIN ROOM** button, and the fast room
links back to the main war. Without `FAST_URL` the button stays hidden. Do not want the fast room at all? `docker compose up -d game`.

## Optional: sign in with Google

Players can stay anonymous forever. If you set `GOOGLE_CLIENT_ID`, the intro screen and the Locker also offer
"Sign in with Google" so a player keeps their rank, XP, trail and squad on every device. The server checks each
token with Google and stores only a salted hash of the Google account id (in `auth.json` in the data volume): no email, no name.

1. Open [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials) and create a project if you have none.
2. Configure the **OAuth consent screen**: External, app name "Supply Lines", your support email, the domain `globalwar.xyz`. Only the default scopes are needed (`openid`, `email`, `profile`), so no verification review is required.
3. **Create credentials → OAuth client ID → Web application.**
   Authorized JavaScript origins: `https://globalwar.xyz`, `https://www.globalwar.xyz` and, for local testing, `http://localhost:5177`. Leave redirect URIs empty.
4. Copy the client ID (`…apps.googleusercontent.com`) into `.env`:

   ```env
   GOOGLE_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
   ```

5. `docker compose up -d` to restart. The button appears on the intro screen.

For local development without Google, `GOOGLE_CLIENT_ID=test` shows a "TEST SIGN-IN" button that accepts any made-up account id. Never use `test` on a public server.

## Troubleshooting: "Live alert status is unavailable"

The server fetches air-raid alerts from ubilling.net.ua and daily figures from russianwarship.rip. Check what it sees:

```bash
curl -s https://globalwar.xyz/realwar.json | head -c 300
docker compose logs game | grep -i "cannot load"
```

`status.alerts` shows the exact error. If the VPS cannot reach the source (some hosts or regions are blocked), test from the server itself:

```bash
curl -sI https://ubilling.net.ua/aerialalerts/
```

If that fails too, point `ALERTS_URL` in `.env` to a mirror or a small proxy you run elsewhere that returns the same JSON, then `docker compose up -d`.

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
