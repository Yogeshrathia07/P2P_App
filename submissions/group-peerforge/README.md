# PeerForge — Decentralized Peer-to-Peer Technical Mock Interview Platform

PeerForge is a high-performance, decentralized peer-to-peer technical mock interview platform designed for software engineers. It enables two developers to connect directly over WebRTC for live audio, video, and screen sharing, while collaborating in real-time inside a synchronized Monaco code editor with an in-browser test runner, automated 60-minute bilateral role rotations (30m Candidate / 30m Interviewer), and symmetric double-blind evaluations.

---

## 1. Project Information & Team Members

- **Project Name:** PeerForge
- **Live Deployment (Frontend):** [https://peerforge-one.vercel.app](https://peerforge-one.vercel.app)
- **Production Backend API:** [https://peerforge-backend.onrender.com](https://peerforge-backend.onrender.com)
- **Target Pull Request:** `Yogeshrathia07/P2P_App` (Branch: `main`)

### Members

| Name | SAP ID | GitHub username |
| :--- | :--- | :--- |
| Atishay Gupta | 590025547 | atishaycodes |
| Ujjwal Tyagi | 590025596 | ujjwal29-iu |

### Member Roles & Detailed Contributions

| Member Name | Role | Responsibilities & What Each Member Implemented |
| :--- | :--- | :--- |
| **Atishay Gupta**<br>(`atishaycodes`) | **Lead System Architect & Full-Stack Developer** | • Designed and engineered the end-to-end **WebRTC P2P communication pipeline** (`RTCPeerConnection`), handling media tracks, transceivers, mute/unmute toggles, camera switches, screen sharing, and ICE gathering.<br>• Implemented **STUN/TURN network traversal** with OpenRelay fallback to ensure connectivity across strict campus and corporate symmetric NATs.<br>• Built the **authoritative Socket.IO signaling server** (`server/socket/roomSignaling.js`) managing room session snapshots, role complement arbitration, and the strict 2-peer capacity gate.<br>• Engineered the **Monaco collaborative code editor** with remote-change latch flags to prevent infinite echo loops, language switching, and the client-side JavaScript execution and test evaluation engine.<br>• Built the **60-minute interview state machine** orchestrating the 30-minute bilateral role swap (Phase 1 &rarr; Phase 2).<br>• Designed the **double-blind symmetric feedback engine** with MongoDB storage, preventing retaliation bias until both peers submit.<br>• Designed and developed the **minimalist monochrome UI design system** and SaaS landing page. |
| **Ujjwal Tyagi**<br>(`ujjwal29-iu`) | **Frontend & Problem Bank Contributor** | • Curated, structured, and implemented the comprehensive **problem bank dataset** (`src/data/problems.js`) covering Data Structures & Algorithms (DSA), Frontend Web Architecture, and Backend System Design with structured test cases.<br>• Built the **Problem Specification Drawer** (`src/components/room/ProblemDrawer.jsx`), displaying problem descriptions, input/output examples, and edge-case constraints.<br>• Designed and styled difficulty badges, track filter pills, and responsive layout containers for mobile, tablet, and desktop viewports.<br>• Conducted cross-browser layout testing and UI refinement for candidate and interviewer view modes. |

---

## 2. What the App Does & How to Use It

### Core Capabilities
1. **Direct P2P Audio & Video:** Low-latency WebRTC media streaming between two candidate devices with independent mic, camera, and display screen capture controls.
2. **Synchronized Collaborative Monaco Editor:** Sub-150ms bidirectional code editing with syntax highlighting (JavaScript, TypeScript, Python, C++, Java) and cursor position indicators.
3. **In-Browser Code Execution & Test Evaluator:** Safely executes code against predefined assertion test suites in real-time, intercepting `console.log` stdout into a dedicated console drawer.
4. **Automated Bilateral Role Swap (60-Min Split):**
   - **Minute 00–30 (Phase 1):** Peer A is Candidate (active coder), Peer B is Interviewer (spec & solution guide).
   - **Minute 30–60 (Phase 2):** Roles rotate automatically. Peer B receives a fresh challenge as Candidate, Peer A becomes Interviewer.
5. **Symmetric Blind Evaluation:** After session completion, both engineers evaluate each other across 4 competency rubrics (Problem Solving, Code Quality, Communication, System Design). Neither can view the other's feedback until both have submitted.

### Live Deployment Links
- **Live Web Application:** [https://peerforge-one.vercel.app](https://peerforge-one.vercel.app)
- **Signaling & Backend Server:** [https://peerforge-backend.onrender.com](https://peerforge-backend.onrender.com)

---

### Step-by-Step Usage Guide

1. **Access the Application:**
   - Open [https://peerforge-one.vercel.app](https://peerforge-one.vercel.app) in your web browser.
   - Click **"Sign Up"** or **"Sign In"** to access your dashboard.

2. **Create or Join a Room:**
   - In the Dashboard or Lobby, select your preferred interview track (**Data Structures & Algorithms**, **Frontend Architecture**, or **Backend System Design**) and difficulty level (**Junior**, **Mid-Level**, **Senior**).
   - Click **"Generate Room Code & Link"** to create a private room (e.g., `PF-MJSP9N`).
   - Share the 6-character room code or direct link with your peer.
   - The second peer joins by entering the code in the **"Join with Room Code"** box on another device or tab.

3. **Phase 1: First Round (30 Minutes):**
   - The system automatically assigns complementary roles: one user is **Candidate** (active coder), and the other is **Interviewer** (assessor).
   - The Candidate solves the assigned challenge in the Monaco editor; the Interviewer reviews test cases, hints, and live code.
   - Click **"Run Code (Ctrl + Enter)"** to run test assertions and view stdout.
   - Use the camera, microphone, or screen-share buttons to communicate in real time.

4. **Phase 2: Role Rotation (30 Minutes):**
   - At the 30-minute mark, the session advances to Phase 2: roles swap automatically, the editor resets with a new challenge, and the new Candidate takes the coding lead.

5. **Double-Blind Symmetric Evaluation:**
   - When the session ends, both peers rate each other across 4 rubrics.
   - Reviews remain locked until both users submit, preventing retaliation bias.

---

## 3. Libraries & Services Used

### Frontend Client
- **React 18 & Vite:** High-performance component rendering and sub-second asset bundling.
- **Tailwind CSS & Lucide React:** Utility-first monochrome styling and responsive icon set.
- **@monaco-editor/react:** VS Code editor engine powering collaborative typing and multi-language syntax highlighting.
- **Socket.IO Client (`socket.io-client`):** Real-time WebSocket connection for room signaling, live code synchronization, and session state.
- **WebRTC API (`RTCPeerConnection`):** Native browser peer-to-peer audio, video, and screen-sharing pipeline.

### Backend & Cloud Infrastructure
- **Node.js & Express.js:** RESTful API endpoints and WebSocket server hosting.
- **Socket.IO Server:** Peer discovery, room lifecycle arbitration, and WebRTC SDP/ICE candidate relaying.
- **MongoDB Atlas & Mongoose:** Cloud database persisting user accounts, session history, and symmetric blind feedback reports.
- **JWT & bcryptjs:** Cryptographic token verification, password hashing, and authorization.
- **Google STUN & OpenRelay TURN:** Public STUN (`stun:stun.l.google.com:19302`) and TURN relays (`turn:standard.relay.metered.ca`) for NAT/firewall traversal across campus and mobile networks.
- **Vercel & Render:** Automated continuous deployment for the frontend client and backend microservice.

---

## 4. Section 3 Decentralized Problems Solved & How

PeerForge addresses 5 core challenges of decentralized and peer-to-peer architectures:

### 1. Problem #1: Late Joiners See No History
- **Why it happens:** In decentralized P2P networks, media and data events are broadcast only to peers currently connected at that exact moment. A peer joining 5 minutes late would receive an empty code editor and missed timer state.
- **How PeerForge solves it:** The signaling coordination layer maintains an authoritative memory state snapshot of the active session (`room.code`, `room.activeProblemId`, `room.language`, `room.timer`, `room.participants`). When a late joiner connects via `room:join`, the system immediately dispatches a `room:state` catch-up packet containing the full document buffer and timer offset before peer negotiation starts.

### 2. Problem #2: Data Lost on Refresh
- **Why it happens:** Browser memory clears upon page reload, destroying local component state, WebRTC peer connections, and in-flight code.
- **How PeerForge solves it:** 
  1. The client maintains authenticated JWT tokens and pre-hydrates user state from persistent storage.
  2. Upon page refresh, the user's re-connection handshake reconciles their authenticated `userId` against existing room participant records, cleanly re-attaching their new socket without terminating the session or resetting the code buffer.
  3. Historical session metrics and evaluations are permanently committed to MongoDB Atlas.

### 3. Problem #5: Peers Cannot Connect (Campus / Office Wi-Fi NAT)
- **Why it happens:** Academic campus networks and corporate firewalls enforce **Symmetric NATs** and block inbound UDP hole punching, causing direct peer-to-peer WebRTC connections to fail during candidate gathering.
- **How PeerForge solves it:** `useWebRTC.js` configures dual Google STUN servers with an **OpenRelay TURN fallback** (`turns:standard.relay.metered.ca`). When direct P2P UDP traversal is blocked by symmetric firewalls, WebRTC automatically switches to an encrypted TURN relay over TCP port 443. An internal `iceCandidatesQueueRef` buffers candidates arriving before the SDP remote description completes, preventing handshake drops.

### 4. Problem #7: Too Many People in One Room (Mesh Explosion)
- **Why it happens:** Pure decentralized mesh networks scale as $\mathcal{O}(N^2)$ connections ($\frac{N(N-1)}{2}$). If participants grow beyond 2–3 peers, CPU encoding and network bandwidth saturate and crash the browser tab.
- **How PeerForge solves it:** PeerForge enforces a strict **bilateral architectural invariant**. Rooms are hard-capped at exactly 2 peers (`room.participants.size >= 2`). Any 3rd peer attempting to enter receives an explicit `room:full` rejection, strictly guaranteeing a constant $N=2$ topology (1 connection per device) with deterministic resource usage.

### 5. Problem #11: Strangers in Your Room (Address Guessing)
- **Why it happens:** If room identifiers are sequential or short (e.g., `room1`, `room2`), attackers or strangers can enumerate or guess room URLs and interrupt live sessions.
- **How PeerForge solves it:** Room codes are generated using high-entropy random identifiers (`generateRandomRoomCode`) in the format `PF-XXXXXX` from a base-32 alphanumeric character space ($32^6 \approx 1.07 \times 10^9$ possibilities). Furthermore, once both candidate and interviewer are in the room, entry is instantly locked to outsiders.

---

## 5. Five Technical Challenges Faced While Building & How We Solved Them

### Problem 1: One-Way Audio Transmission Mismatch in WebRTC (Laptop to Phone Silent)
- **The problem:** WebRTC audio transmitted in only one direction: the phone's voice was clearly audible on the laptop speaker, but the laptop's microphone produced complete silence on the phone.
- **Why it happened:** Pre-allocating transceivers with `pc.addTransceiver("audio", { direction: "sendrecv" })` created an empty sender with `sender.track === null`. When local media was acquired, `sender.replaceTrack(track)` was called asynchronously without awaiting the returned promise before invoking `pc.createOffer()`. Because `replaceTrack` was still pending during SDP generation, the browser generated an SDP offer without audio SSRCs or media stream descriptors, causing the receiving device to decode zero audio packets.
- **What you tried:** Adding fallback transceiver checks, polling sender state in intervals, and setting `offerToReceiveAudio: true` in the offer options.
- **Your final solution:** Created a synchronous track attachment helper (`attachTracksToPeer` in [`src/hooks/useWebRTC.js`](file:///c:/Users/Atishay/Downloads/peerForge/src/hooks/useWebRTC.js)) that binds the microphone track directly via `pc.addTrack(track, stream)`. This binds the track synchronously and associates media stream IDs prior to SDP negotiation, ensuring both SDP Offer and Answer contain complete audio SSRCs.

---

### Problem 2: Mobile Browser Autoplay Audio Policy Suppression & Touch Unlock
- **The problem:** On mobile devices (iOS Safari and Android Chrome), remote audio would not play automatically when joining an interview room, even when audio packets were arriving across the network.
- **Why it happened:** Modern mobile operating systems strictly enforce media autoplay policies that block unmuted `<video>` and `<audio>` elements unless triggered directly inside a user gesture (`touchstart`/`touchend`). Setting `muted={false}` on the `<video>` element caused iOS Safari to pause the video element entirely. Furthermore, previous autoplay unlock handlers only listened for desktop `click` and `keydown` events, which do not reliably fire on mobile touch viewports.
- **What you tried:** Unmuting the video element directly and attaching window-level `click` listeners.
- **Your final solution:** In [`src/components/room/VideoTiles.jsx`](file:///c:/Users/Atishay/Downloads/peerForge/src/components/room/VideoTiles.jsx), we decoupled video display from audio playback:
  1. Kept `<video>` permanently set to `muted={true}` with `playsInline`, ensuring 100% compliant video playback without browser pause blocks.
  2. Routed remote audio through a dedicated `<audio>` element with global capture listeners for `touchstart`, `touchend`, `pointerdown`, and `click`.
  3. Added an interactive **"🔊 Tap here to enable sound"** banner that appears if the browser blocks autoplay, allowing an instant one-tap user unlock.

---

### Problem 3: Cross-Origin Production API Routing & Third-Party Cookie Drops on Refresh
- **The problem:** In production, submitting forms returned `SyntaxError: Unexpected token 'T', "The page c"... is not valid JSON` (404 HTML) or HTTP 405, and refreshing the browser immediately logged the user out and redirected to `/login`.
- **Why it happened:** The frontend was hosted on Vercel (`peerforge-one.vercel.app`) while the backend ran on Render (`peerforge-backend.onrender.com`). Calling relative `/api/*` endpoints hit Vercel's static host instead of Render, returning Vercel's default 404 HTML page. Furthermore, cross-site third-party cookies are blocked by default on modern browsers between different domains (Vercel and Render), causing cookie-only `checkAuth()` to fail on page reload.
- **What you tried:** Using Vite development proxies (which do not apply to production static builds) and relying solely on `credentials: "include"` session cookies.
- **Your final solution:** 
  1. Added a `vercel.json` rewrites configuration routing all `/api/:path*` requests directly to `https://peerforge-backend.onrender.com/api/:path*`.
  2. Implemented an `authFetch` utility in [`src/utils/api.js`](file:///c:/Users/Atishay/Downloads/peerForge/src/utils/api.js) attaching standard `Authorization: Bearer <token>` headers to every request.
  3. Updated backend cookies with `sameSite: "none"` and `secure: true`.
  4. Pre-hydrated user authentication state synchronously from `localStorage.getItem("auth_user")` in `AuthContext.jsx`, eliminating session logout on page refresh.

---

### Problem 4: Monaco Collaborative Editor Infinite Echo Loop & Cursor Jumping
- **The problem:** Whenever either peer typed in the shared code editor, the browser entered an infinite broadcast loop, freezing the tab and resetting the user's cursor to line 1, column 1 on every keystroke.
- **Why it happened:** When Peer A typed, Socket.IO sent `room:code-change`. When Peer B received this and called `editor.setValue(newCode)`, Monaco's native `onDidChangeContent` listener fired on Peer B's client, broadcasting the same code back to Peer A in an infinite ping-pong loop.
- **What you tried:** Applying a debounce timer (300ms–500ms) on code emissions. This delayed the loop but caused character dropping and desynchronization when both users typed concurrently.
- **Your final solution:** Implemented an `isRemoteChangeRef` latch flag in [`src/components/room/CodeEditor.jsx`](file:///c:/Users/Atishay/Downloads/peerForge/src/components/room/CodeEditor.jsx). Before applying incoming code via `setValue()`, the latch is set to `true`. The editor's change event handler checks this flag: if `true`, it suppresses socket emission and resets the latch, completely eliminating echo loops while preserving cursor positions.

---

### Problem 5: Cloud Database Dynamic IP Whitelisting & SSL Alert Number 80 on Render
- **The problem:** When deploying the backend to Render, the service failed to connect to MongoDB Atlas, repeatedly logging `[Database Error] Connection error: ... SSL routines:ssl3_read_bytes:tlsv1 alert internal error ... SSL alert number 80` and `Mongoose disconnected from MongoDB`.
- **Why it happened:** Render instances run inside AWS container environments with dynamic IP addresses and default IPv6 DNS resolution. MongoDB Atlas rejects inbound connections from non-whitelisted IPs with TLS alert 80, and Node.js attempting IPv6 resolution against Atlas SRV records timed out.
- **What you tried:** Restarting the Render service and hardcoding individual Render outbound IP addresses.
- **Your final solution:** 
  1. Configured Network Access in MongoDB Atlas with `0.0.0.0/0` (allowing cloud deployment connections secured via strong cluster credentials).
  2. Configured Mongoose with `family: 4` in [`server/config/db.js`](file:///c:/Users/Atishay/Downloads/peerForge/server/config/db.js) to force IPv4 DNS resolution.
  3. Added an exponential backoff reconnect loop in `server/config/db.js` so transient network hiccups reconnect automatically without crashing the server process.

---

## 6. How to Run & Verify Locally

### Prerequisites
- Node.js (v18 or higher)
- npm or pnpm
- MongoDB Atlas cluster URI (or local MongoDB)

### Installation & Launch
```bash
# 1. Clone the repository
git clone https://github.com/atishaycodes/peerForge.git
cd peerForge

# 2. Install dependencies
npm install

# 3. Configure environment variables
# Copy .env.example to .env and configure your variables:
cp .env.example .env

# 4. Start the backend signaling and API server
npm run server

# 5. In a second terminal, start the frontend client
npm run dev
```

Visit `http://localhost:5173` in two different browser windows (or across two devices on the same local network) to test the peer-to-peer interview flow.

---

## 7. License

Open source and released under the [MIT License](LICENSE).
