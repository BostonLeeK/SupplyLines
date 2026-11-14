# Supply Lines

**A free browser war of logistics. Two factions, one shared planet, no sign-up.**
Open the page and you are on the front line.

![Supply Lines gameplay](docs/gameplay.gif)

> *"Shall we play a game?"*
>
> Inspired by **WarGames** (1983), the film where a teenager breaks into a military computer,
> asks to play *Global Thermonuclear War* and almost starts a real one. The computer's last lesson,
> *"the only winning move is not to play"*, is built into this game: a nuclear strike is possible,
> but a second one in the same season is nuclear winter and **everybody loses**.

Play: **[globalwar.xyz](https://globalwar.xyz)** · World report: **[globalwar.xyz/world](https://globalwar.xyz/world)**

---

## The idea

The world is a network of 184 cities linked by land, sea and air routes on a 3D globe.
You do not move armies across a map: you run **supply lines**. Every city in your colour produces troops,
convoys carry them along routes, and a city cut off from your capital and megahubs stops producing.

The map is the real world with three changes:

- **Russia is gone.** The nations it held are free (Ichkeria, Tatarstan, Bashkortostan, Siberia, the Far East and others),
  drawn with their real regional borders. Each faction can win them over with diplomacy, or take them by force and be remembered for it.
- **Where Muscovy was, there is now a sea.**
- **Iran and North Korea** are a black void that no route can cross.

## Features

| | |
|---|---|
| **Shared live world** | One server-authoritative world for everybody. Bots fill the ranks so the war is alive even with a single player; every human who joins replaces ten of them. |
| **Seasons** | A season is 7 game days. Points come from cities and whole regions. Your rank and XP stay with you. |
| **Fog of war** | You see enemy garrisons and convoys only near your own network. The server sends each faction only its own view. |
| **Abilities** | Fortify, sabotage, airdrop, blockade, fleets, rally points, signals, three convoy types (standard, fast, heavy). |
| **Intel** | Satellites lift the fog over a wide area; spies reveal an enemy city and its plans, and are caught one time in four. |
| **Free nations** | Envoys raise a nation's favour; at 100 all its free cities join you. Betrayal has a price. |
| **Resources** | Uranium feeds the nuclear program, oil speeds convoys, grain boosts production. |
| **World events** | Every game day: oil shock, solar storm, peace summit, hurricane season, disarmament talks… |
| **The bomb** | A faction project: three megahubs, uranium and command points from many players. Launch needs two commanders, a minute of air-raid siren, and can be shot down. |
| **General** | Players vote for a faction general who places strategic attack and hold marks. |
| **Squads** | Create a squad, share the invite link: friends land on your side, and coordinated hits get a combo bonus. |
| **Ranks and cosmetics** | Eight ranks with insignia; each unlocks a convoy trail every player can see. |
| **World report** | A public page with the live map, score, chronicle and leaders, made for sharing. |
| **Optional Google sign-in** | Play anonymously, or sign in to keep your rank, XP and trail on every device. Only a salted hash of the account id is stored. |
| **Push alerts** | Optional browser notifications when your cities are attacked or a launch is detected (PWA). |

![A nuclear strike in Supply Lines](docs/nuke.jpg)

## REAL WAR

This is a game. In Ukraine the war is not.

Behind the **REAL WAR** button is a panel with real figures and their sources: the day of Russia's full-scale invasion,
missiles and drones launched at Ukraine, hours under air-raid alert, and the **live air-raid alert status in Ukraine right now**.
When there is an alert, the button blinks red. After every nuclear strike in the game, a short note reminds players
that the siren they just heard is real somewhere else.

Live data (fetched by the server and cached, no keys needed):

- Air-raid alerts by region: [ubilling.net.ua/aerialalerts](https://ubilling.net.ua/aerialalerts/)
- Daily figures of the General Staff of Ukraine: [russianwarship.rip API](https://russianwarship.rip/)

Help Ukraine: **[UNITED24](https://u24.gov.ua/)**

## Run it locally

Requires Node.js 20 or newer.

```bash
npm install
npm start
```

Open <http://localhost:5177>. Open a second browser (or a private window) to play as another person.
Add `?offline=1` to play a quick single-player world without the server.

Useful environment variables:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `5177` | HTTP and WebSocket port |
| `SIM_SPEED` | `1` | Sim seconds per real second. At `1` a season lasts 15 minutes; `0.1` makes it 2.5 hours |
| `BOTS` | `120` | Bots per faction when nobody is online |
| `DATA_DIR` | `server/data` | Where the world, players, squads and the VAPID key are saved |
| `GOOGLE_CLIENT_ID` | (empty) | Turns on optional Google sign-in, see DEPLOY.md |
| `VAPID_SUBJECT` | `mailto:admin@supply-lines.invalid` | Contact for web push |

```bash
npm test          # engine and save/load tests
npm run balance   # 16 bot-only seasons: are the factions balanced?
```

## Deploy

See [DEPLOY.md](DEPLOY.md): one `docker compose up` on a VPS, behind the reverse proxy you already run.

## How it is built

- `index.html`: the whole client (three.js globe, HUD, UI) in one file. No build step.
- `game/engine.js`: the simulation. The same code runs on the server (authoritative) and in the browser (offline mode and smooth mirroring of server snapshots).
- `server/server.mjs`: Node HTTP + WebSocket server: per-faction fog snapshots four times a second, persistence, push notifications, live real-war data, world report.
- `world.html`: the public world report.
- `net.js`: the map: cities, routes and land outlines, generated by `tools/build-net.mjs` from Natural Earth data.

To rebuild the map, download Natural Earth *Admin 1 – States, Provinces* (10m, GeoJSON) into `tools/data/admin1.geojson`, then run `npm run build:net`.

## Roadmap

- [x] Optional sign-in with Google to keep your rank and XP across devices (playing stays anonymous by default)
- [ ] Ukrainian / English language switch
- [ ] Season replay export as a video for social media
- [ ] Twitter/X bot with season results

## Credits

- Map data: [Natural Earth](https://www.naturalearthdata.com/) and [world-atlas](https://github.com/topojson/world-atlas)
- 3D: [three.js](https://threejs.org/)
- Fonts: Unbounded and Manrope (Google Fonts)
- Inspired by *WarGames* (1983)

## License

[GNU GPL v3.0](LICENSE)
