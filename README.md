# PeerDesk — Decentralised Peer-to-Peer Group Study Room

> A zero-server, WebRTC-powered collaborative study studio where students exchange study notes, whiteboard drawings, chat messages, Pomodoro timer state, and chunked files **directly peer-to-peer** between browsers.

**Live App Link:** `https://<username>.github.io/P2P_App/submissions/shagun/` *(replace `<username>` with your GitHub fork username after enabling GitHub Pages)*

---

## Team Members & Contributions

*(Update the names, SAP IDs, and GitHub handles with your 4 group members before opening the final PR.)*

| Member Name | SAP ID | GitHub Handle | Contribution |
| :--- | :--- | :--- | :--- |
| Member 1 (e.g. Shagun) | `5000XXXXX` | `@member1` | WebRTC transport layer (`src/transport.js`), Trystero Nostr/MQTT signaling & Manual SDP/QR fallback |
| Member 2 | `5000XXXXX` | `@member2` | Lamport causal clock, CRDT block notes, deduplication & signed tombstones (`src/sync.js`, `src/storage.js`) |
| Member 3 | `5000XXXXX` | `@member3` | Web Crypto ECDSA identity signing, AES-256-GCM room encryption, sanitization & rate limiting (`src/crypto.js`, `src/sanitize.js`) |
| Member 4 | `5000XXXXX` | `@member4` | Responsive studio UI, HTML5 HiDPI whiteboard, chunked file vault & Pomodoro sync (`index.html`, `styles.css`, `app.js`, `src/chunker.js`) |

---

## What PeerDesk Does & How to Use It

PeerDesk turns any browser tab into a self-contained collaborative study room with **zero backend servers storing or forwarding user data**.

### Features
1. **Verified P2P Study Chat**: Messages are signed with each peer's ECDSA P-256 key, ordered via Lamport logical clocks, and safely auto-linked (`http`/`https` only).
2. **Block-Based Collaborative Study Notes**: Add/edit independent note cards concurrently; conflicts resolve deterministically per block via Last-Write-Wins (Lamport + Peer ID), with one-click Markdown export.
3. **Live Multi-User Whiteboard**: HiDPI HTML5 `<canvas>` with Pen, Eraser, Colors, Brush size, throttled live peer cursors, synced Clear All, and PNG export.
4. **Chunked P2P File Vault**: Drag-and-drop PDFs, slides, or images (up to 50 MB). Files stream in 24 KB chunks over a dedicated `RTCDataChannel`, verify against a SHA-256 hash, and cache in IndexedDB.
5. **Synced Study Pomodoro Timer**: Start, pause, or switch between 25:00 Focus and 5:00 Break across all connected peers.
6. **Three Peer-Discovery Modes**:
   - **Nostr Public Relays** (zero-config default)
   - **MQTT-over-WSS Public Brokers** (alternative relay if Nostr is blocked)
   - **Manual WebRTC SDP / QR Handshake** (works 100% offline/without any signaling servers by exchanging Offer/Answer tokens)

### How to Use
1. Open the live GitHub Pages URL on two or more devices (laptop + phone, or two laptops).
2. Enter your **Display Name** and a shared **Study Room Code** (e.g., `OS-EXAM-404`). Optionally enter a **Room Passcode** to enable AES-256-GCM end-to-end encryption.
3. Click **Enter Study Room** (or click **Invite / QR** inside the room to share the URL/QR code with classmates).
4. Once connected, chat, draw, co-edit study blocks, and drop files—all data travels directly over `RTCDataChannel`.

### Screenshots
> *Add 2–3 screenshots of your live two-device session inside `submissions/shagun/screenshots/` and embed them here before submitting your PR:*
> - `screenshots/lobby.png` — Lobby & cryptographic identity fingerprint
> - `screenshots/studio-two-devices.png` — Live two-device session with whiteboard, notes & chat
> - `screenshots/diagnostics.png` — WebRTC ICE diagnostics & chunked file transfer

---

## Libraries & Public Services Used (Credits)

- **[Trystero](https://github.com/dmotz/trystero)** (`@trystero-p2p/nostr@0.26.0` & `@trystero-p2p/mqtt@0.26.0`, MIT License) — Serverless WebRTC signaling over public Nostr relays and MQTT-over-WSS brokers (`wss://test.mosquitto.org`, `wss://broker.hivemq.com`, public Nostr relays).
- **[qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)** (`1.4.4`, MIT License) — Client-side SVG QR code generation for room invite links.
- **Public STUN Servers**: Google STUN (`stun:stun.l.google.com:19302`, `stun:stun1.l.google.com:19302`) and Cloudflare STUN (`stun:stun.cloudflare.com:3478`), plus optional user-supplied TURN relays (e.g., [Metered Open Relay](https://www.metered.ca/tools/openrelay/)).
- **Browser Native APIs**: WebRTC (`RTCPeerConnection`, `RTCDataChannel`), Web Crypto API (`ECDSA` P-256, `PBKDF2`, `AES-GCM`, `SHA-256`), IndexedDB, and HTML5 Canvas.

---

## Problems from Section 3 Solved (10 Solved)

1. **Late joiners see no history (`src/sync.js`)**  
   On peer connection (`HELLO`), peers exchange a compact `SYNC_DIGEST` containing known message IDs, note block versions, stroke IDs, file IDs, and tombstones. Existing peers compute missing records via `getItemsMissingFrom()` and transmit `SYNC_BATCH` packets directly to the late joiner.
2. **Data lost on refresh (`src/storage.js`)**  
   All room state (messages, note blocks, strokes, file metadata, tombstones, Lamport clock), user ECDSA identity keypairs, and received file blobs are persisted in **IndexedDB** (`PeerDeskDB_v1`). Refreshing restores the workspace immediately and merges deltas upon reconnecting.
3. **Messages in the wrong order (`src/sync.js`)**  
   Every event increments a **Lamport Logical Clock** (`lamport = max(local, remote) + 1`). Messages, strokes, and note updates are sorted deterministically by `(lamport, senderId, id)`, completely immune to device clock skew.
4. **Duplicate messages (`src/sync.js`)**  
   Every item carries a unique ID (`fingerprint:lamport:nonce`) tracked in an IndexedDB-backed `seenIds` `Set`. Reconnections and redundant multi-peer history batches drop already-seen IDs idempotently.
5. **Peers cannot connect on campus/office Wi-Fi (`src/transport.js`)**  
   Uses multi-provider STUN (Google + Cloudflare), user-configurable TURN credentials (for symmetric NATs), **triple signaling fallback** (Nostr → MQTT → 100% relay-free Manual SDP Offer/Answer), and an in-app **Diagnostics & ICE Restart** modal.
6. **Large files crash the tab (`src/chunker.js`, `src/transport.js`)**  
   Files are sliced into **24 KB chunks**, streamed over a separate `pd-file` DataChannel with `bufferedAmountLowThreshold` backpressure pacing, reassembled out-of-order by `FileAssembler`, and verified against a **SHA-256** digest before saving to IndexedDB.
7. **Too many people in one room (`src/transport.js`)**  
   Enforces a configurable **Soft Mesh Cap** (`MAX_MESH_PEERS = 8`) to prevent $O(N^2)$ WebRTC connection explosions and throttles high-frequency cursor updates to ~65 ms intervals.
8. **Fake identities (`src/crypto.js`, `app.js`)**  
   Generates a persistent local **ECDSA P-256** keypair on first launch and derives a visual **Fingerprint** (e.g., `A4F9-21C8`). Every message, note edit, file meta, and tombstone is signed with `crypto.subtle.sign` and verified against the sender's JWK public key before rendering.
9. **Malicious input (`src/sanitize.js`)**  
   Zero `innerHTML` rendering on untrusted peer input (strict `textContent` DOM construction + `http`/`https` URL allowlist blocking `javascript:` XSS), strict packet schema & size checks (`96 KB` control cap, `50 MB` file cap), and a **per-peer Token Bucket rate limiter**.
10. **Strangers in your room & Deleting data everywhere (`src/crypto.js`, `src/sync.js`)**  
    - **Strangers**: Adding an optional Room Passcode hashes the signaling topic (`SHA-256`) and encrypts all WebRTC payloads with **PBKDF2 + AES-256-GCM**; unauthorized peers fail decryption.  
    - **Deleting data everywhere**: Deleting a message, note, or file broadcasts an ECDSA-signed **Tombstone** (`delete-wins`). Author fingerprints are verified on message/file deletes, and tombstones sync to offline devices as soon as they reconnect.

---

## 5 Real Problems Faced While Building (& How We Solved Them)

1. **Whiteboard coordinates shifted across laptop vs. phone screens**  
   - *Why it happened*: Initially storing pixel `(x, y)` coordinates caused strokes drawn on a `1200×700` laptop canvas to draw off-screen on a `360×500` mobile screen, and HiDPI (`devicePixelRatio = 2`) screens blurred strokes.  
   - *What we tried*: Scaling by fixed aspect ratios, which clipped when resizing the browser window.  
   - *Final solution*: Normalized all stroke points to `[0, 1]` relative coordinates (`x / width`, `y / height`) and applied `devicePixelRatio` canvas scaling on resize (`app.js`), so drawings align across any screen size.

2. **Public signaling relay blocked on restrictive campus Wi-Fi**  
   - *Why it happened*: Campus firewalls sometimes block WebSocket ports or specific Nostr relay domains, leaving peers stuck on "Connecting...".  
   - *What we tried*: Switching to a single hardcoded MQTT broker, which could also fail if offline or firewalled.  
   - *Final solution*: Built a triple-mode transport (`src/transport.js`) offering Nostr relays, MQTT-over-WSS brokers, AND a 100% relay-free Manual WebRTC SDP Offer/Answer mode with full ICE gathering (`waitForIceGathering`), plus custom TURN server fields.

3. **Concurrent note editing caused cursor jumps and clobbered paragraphs**  
   - *Why it happened*: Syncing one giant `<textarea>` as a single string meant typing in one paragraph overwrote another student's paragraph, and re-rendering `value` reset the cursor to the end.  
   - *What we tried*: Debouncing the single textarea, which still caused whole-document overwrites during concurrent study sessions.  
   - *Final solution*: Split notes into independent **Study Blocks** (`src/sync.js`) where each card has its own LWW `(lamport, senderId)` register, and preserved `selectionStart` / `selectionEnd` across renders (`app.js`).

4. **Large file transfers stalled or overflowed `RTCDataChannel` SCTP buffers**  
   - *Why it happened*: Sending a 10 MB file in a single `send()` call or tight loop exceeds browser WebRTC message size limits (~64–256 KB) and freezes/crashes the channel.  
   - *What we tried*: Splitting into 128 KB chunks without pacing, which still dropped chunks on Safari/Firefox.  
   - *Final solution*: Reduced chunk size to **24 KB**, separated file traffic onto a dedicated `pd-file` channel, added `bufferedAmountLowThreshold` backpressure waiting (`src/transport.js`), and verified reassembled bytes with SHA-256 (`src/chunker.js`).

5. **Duplicate DataChannel open events in Manual SDP mode**  
   - *Why it happened*: Creating two DataChannels (`pd-ctrl` and `pd-file`) caused `ondatachannel` on the answerer to fire twice and initially re-initialized the peer entry, resetting connection state.  
   - *What we tried*: Using a single DataChannel for everything, which caused file transfers to block chat responsiveness.  
   - *Final solution*: Allocated a single peer lifecycle entry in `manualPeers` once (`src/transport.js`) and attached both `pd-ctrl` and `pd-file` DataChannels to that shared entry, firing `onPeerJoin` only once when the first channel opens.

---

## Local Testing & Verification

Run the automated test suite (requires Node.js 20+):
```bash
node --test submissions/shagun/tests/run-tests.mjs
```

Serve locally to test between two browser tabs or two devices on the same Wi-Fi:
```bash
python3 -m http.server 8080
# Open http://localhost:8080/submissions/shagun/
```
