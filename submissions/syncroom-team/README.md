# SyncRoom – Decentralised Music Listening Room

Create or join a room, chat, and listen to music together. Chat, playback commands and audio travel directly between browsers over WebRTC. There is no application server or database.

**Live app:** https://sanchigoyal26.github.io/P2P_App/submissions/syncroom-team/
**Screenshots:** _add after final deployment_

## Members
| Name | SAP ID | What they did |
|---|---|---|
| Sanchi Goyal |590027281| Frontend: home page, music room UI, upload/player, chat UI |
| Shresth Chaudhary |590025387 | Trystero/WebRTC integration, peer discovery, P2P messaging |


## How to use
1. Open the live link, enter a name, press **Create a Room**. Share the **Copy invite** link (or the 6-character code).
2. On another device open the link (or enter the code on the home page) and join.
3. The header says "Connected" only once a real WebRTC connection to a peer is open.
4. Host picks a mode:
   - **Synchronized local playback:** everyone picks the *same* file. Files are compared by SHA-256; a different file is refused. The host's play/pause/seek are mirrored, with gentle drift correction.
   - **Host streams audio live:** the host's player output is sent to guests over WebRTC. Guests may need to press **Enable audio** (browser autoplay rules).

## Libraries and services
- [Trystero](https://github.com/dmotz/trystero) 0.27.0 (via esm.sh) for WebRTC matchmaking and data/media channels.
- Public Nostr relays (Trystero default) for peer discovery only. They never see chat or audio.
- Public STUN servers (Trystero defaults). An optional TURN fallback can be added in `js/room.js` (`TURN_SERVERS`).
- GitHub Pages for hosting.

## Assignment problems solved
| # | Problem | How |
|---|---|---|
| 1 | Late joiners see no history | On connect, each peer sends its last 100 messages directly to the newcomer (`sr-history` action). |
| 2 | Data lost on refresh | Chat and the Lamport clock are saved to `localStorage` per room and restored on load. Local only; audio files must be re-selected. |
| 3 | Wrong order | Lamport logical clock, ties broken by message id, so all devices sort identically. |
| 4 | Duplicates | Every message has a random UUID; a seen-set drops repeats, including during history merge. |
| 9 | Malicious input | Payload shape/length validation, names stripped of control characters, text rendered with `textContent`, sizes capped. |
| 11 | Guessable rooms | Room codes come from `crypto.getRandomValues` (32-character alphabet, 6 chars). |

## Known limitations
- Display names are labels, not verified identities. The "host" is whoever claims it first, so a malicious peer could try to spoof it.
- Offline peers cannot supply history or files.
- Networks that block direct WebRTC need a TURN server, which is not configured by default.
- Autoplay policies require a user tap on some browsers.
- If the host leaves, nobody controls playback.

## Problems we faced
_Fill these in from your real experience (problem, why, what you tried, final fix). Candidates that did occur in this codebase, if you hit them yourselves:_
1. `room.js` used `import` but was loaded with a normal `<script>`, so it never ran.
2. `room.html` was missing elements the script looked up, so the room code stayed as dashes.
3. An action name longer than Trystero's 12-byte limit, and a `modeAction` used before being created.
4. Mixing Trystero 0.26 property-style handlers with 0.27 `on*()` methods.
5. Stale `sessionStorage` overriding the room code in the URL.