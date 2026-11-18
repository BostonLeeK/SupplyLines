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
STATS_KEY=some-long-random-string
```

`SIM_SPEED` sets the pace: at `0.125` (the default) a season lasts 2 hours of real time, at `1` 15 minutes, at `0.0104` a full day. `CP_SECONDS` (default `45`) is how many real seconds one command point takes to refill, so a longer season does not starve players of CP.

## Optional: blitz mode

`docker compose up` also starts a second world, **blitz**, on port `5178`: a season there lasts 15 minutes
(`FAST_SIM_SPEED=1`, one CP every `FAST_CP_SECONDS=6` s, so a player gets about as many CP per season as in the 2-hour war).
It keeps its own players, ranks, callsigns and seasons, posts no news and sends no push notifications. Serve it under
`/fast/` next to the main game:

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

Then add `FAST_URL=/fast/` to `.env` and restart: the mode screen shows **Global war**, **Blitz** and **With friends**,
with the season length and how many people play in each right now (each server answers `/room.json`). Keep blitz on
the same site as a path like `/fast/`: picking a mode moves the page's socket to that world without reloading, which
only works within one site. Without `FAST_URL` the blitz card stays hidden. Do not want blitz at all? `docker compose up -d game`.

Already ran the old 30-minute fast room? Its `.env` overrides (`FAST_SIM_SPEED`, `FAST_CP_SECONDS`) still win; remove them
to get the 15-minute blitz.

## Private games

Players can start a game for themselves and their friends from the mode screen: they pick the season length (15 minutes
to 2 hours) and how many bots fill the sides, and get a link like `/r/K7M2QX/` to send. Each game is a separate world:
the main server starts a child copy of itself on a local port and passes the page and the game socket through, so
nginx needs nothing new (the `location /` that already proxies `/ws` with the upgrade headers covers `/r/`). A game
closes by itself ten minutes after the last player leaves, and nothing of it is kept.

`PRIVATE_GAMES` (default `3`) caps how many run at once: each one is a Node process with its own simulation, roughly
60–100 MB of memory and a share of a CPU core. `PRIVATE_GAMES=0` turns the mode off.

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

## Stats, errors, health and backups

- **Stats:** open `https://globalwar.xyz/stats?key=YOUR_KEY` after setting `STATS_KEY=YOUR_KEY` in `.env` (any long random string). It shows, per day: page loads, unique visitors, how many pressed PLAY, played 5+ minutes and came back, plus JS errors. No cookies are set and no IP addresses are stored: a visitor is recognised for one day through a hash with a random salt that lives only in memory.
- **Messages:** the contact form at `/contact` saves messages to `messages.jsonl` in the data folder and lists the newest 50 at the bottom of the stats page. To get each one as a card in a Discord channel, set `CONTACT_DISCORD_WEBHOOK` in `.env` (channel settings → Integrations → Webhooks → New Webhook → Copy Webhook URL; a private channel is best, since messages can hold emails). For Telegram, set `CONTACT_TG_TOKEN` (a bot token from @BotFather) and `CONTACT_TG_CHAT` (your chat id). Any of them, both or none.
- **Errors from players' browsers** are written to `errors.log` in the data volume: `docker compose exec game tail -n 50 /data/errors.log`.
- **Health:** `/healthz` returns the season, players online and uptime. Docker uses it as a healthcheck, so `docker compose ps` shows `healthy`; point any uptime monitor (UptimeRobot and similar) at it.
- **Backups:** once a day the server copies the world, players, squads, archive, accounts, stats and the VAPID key into `/data/backups/YYYY-MM-DD/` and keeps 14 days. These protect against a broken save, not against losing the disk, so also copy the volume off the server now and then (see Logs and backups).

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
