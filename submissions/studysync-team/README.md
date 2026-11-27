# StudySync — Decentralised P2P Study Room

**Study together. Directly.**

StudySync is a decentralised peer-to-peer study room built using **WebRTC and Trystero**.

It allows students to join a private study room and communicate directly between their browsers. Connected students can use real-time chat, collaborate on shared notes, view online members, and transfer files without using an application database or cloud file-storage server.

GitHub Pages hosts only the static HTML, CSS and JavaScript files. Peer discovery/signaling is handled using Trystero's public infrastructure, while study-room data is exchanged through peer-to-peer WebRTC connections.

---

## Team Members

| Name | SAP ID | Contribution |
| --- | --- | --- |
| **Priyansh Dixit** | 590021860 | Project integration, WebRTC room setup, overall testing and GitHub Pages deployment |
| **Krish Kanwadia** | 590029379 | Real-time P2P chat, message handling, duplicate-message protection and chat history |
| **Sahaj Karanwal** | 590022602 | Collaborative shared notes, local storage, notes synchronization and late-joiner sync |
| **Rishabh Tripathi** | 590026253 | P2P file sharing, chunked file transfer, file validation and transfer interface |
| **Ian Axl Morris** | 590022524 | UI/UX design, responsive layout, room/member interface, input validation and documentation |

---

# Features

StudySync provides the following features:

- Decentralised peer-to-peer study rooms
- WebRTC browser-to-browser communication
- Private Room IDs
- Random hard-to-guess Room ID generation
- Optional room password
- Shareable invite links
- Real-time P2P group chat
- Online member list
- Local chat history
- Chat history synchronization for late joiners
- Duplicate-message protection
- Collaborative shared notes
- Local notes persistence
- Notes synchronization between peers
- Direct P2P file sharing
- Chunked file transfer
- File-size validation
- Received file verification
- Drag-and-drop file sharing
- Multiple file selection
- Safe rendering of peer-controlled text
- Responsive desktop, tablet and mobile interface
- Live P2P connection status
- No application database
- No application file-storage server

---

# How to Use StudySync

## Step 1 — Open StudySync

Open the deployed StudySync GitHub Pages website on the first device.

## Step 2 — Enter Your Name

Enter a display name.

Example:

```text
Priyansh
```

## Step 3 — Choose a Room

StudySync automatically generates a random Room ID.

Example:

```text
study-k7f2x9
```

You can also generate another Room ID using the refresh button.

## Step 4 — Set a Password

A room password is optional but recommended.

Students joining the same private room should use:

- the same Room ID
- the same room password

## Step 5 — Enter the Study Room

Click:

```text
Enter Study Room
```

The room becomes active and waits for another peer.

## Step 6 — Invite Another Student

Click:

```text
Copy Invite Link
```

Send the link to another group member.

The Room ID is automatically included in the URL.

## Step 7 — Connect Another Device

Open the invite link on another device.

Enter:

- a different display name
- the same room password

After the WebRTC connection is established, StudySync displays:

```text
P2P Live
```

## Step 8 — Start Collaborating

Connected students can now:

- send messages;
- edit shared notes;
- transfer files;
- see connected members.

---

# How StudySync Works

The basic architecture is:

```text
                    GitHub Pages
                         |
                         |
                  Serves the website
                         |
             +-----------+-----------+
             |                       |
             v                       v
        Browser A                Browser B
        Priyansh                   Krish
             |                       |
             |   Peer Discovery      |
             +------ Signaling ------+
             |                       |
             |                       |
             +====== WebRTC =========+
                     Direct P2P
                         |
             +-----------+-----------+
             |           |           |
            Chat        Notes       Files
```

GitHub Pages only provides the website files.

It does not store chat messages, shared notes or transferred files in an application database.

Trystero is used to help peers discover each other and establish WebRTC connections.

After the peers connect, StudySync uses WebRTC communication between the connected browsers.

---

# Technologies Used

## HTML5

Used to create the structure of the StudySync interface.

## CSS3

Used for:

- responsive layout;
- dark navy interface;
- electric-blue design system;
- animations;
- cards;
- forms;
- mobile responsiveness.

## JavaScript

Used for:

- room handling;
- P2P communication;
- chat;
- notes;
- file transfer;
- local storage;
- input validation;
- UI updates.

## WebRTC

WebRTC provides peer-to-peer communication between browsers.

StudySync uses WebRTC communication for study-room data exchanged between connected peers.

## Trystero 0.26.0

StudySync uses Trystero to simplify WebRTC peer discovery and communication.

The version is pinned to:

```text
trystero@0.26.0
```

## Web Crypto API

The browser's Web Crypto API is used to generate random identifiers for rooms and messages.

Example:

```javascript
crypto.getRandomValues()
```

## localStorage

Browser `localStorage` is used to preserve:

- display name;
- last Room ID;
- local chat history;
- shared notes.

No external application database is used.

## GitHub Pages

GitHub Pages hosts the static StudySync application.

---

# P2P Problems Addressed

The assignment requires the project to solve at least four problems found in decentralised systems.

StudySync addresses more than four.

---

## Problem 1 — Late Joiners See No Chat History

### Why the problem occurs

In a peer-to-peer system, a message is normally sent only to peers that are connected at that moment.

Suppose:

```text
Priyansh sends Message A

        ↓

Krish is online
Sahaj is offline
```

Krish receives the message.

Sahaj does not receive it because Sahaj was not connected.

### Our Solution

StudySync keeps a limited chat history on each browser.

When another peer connects, the existing peer sends its available history directly to the new peer.

```text
Existing Peer
     |
     | Chat History
     v
New Peer
```

The new peer merges messages that it does not already have.

This allows late joiners to receive available chat history from an online peer.

---

# Problem 2 — Data Is Lost After Refresh

### Why the problem occurs

JavaScript variables normally exist only in browser memory.

Refreshing the page clears that memory.

Without local persistence:

```text
Messages
   ↓
Browser Memory
   ↓
Refresh
   ↓
Lost
```

### Our Solution

StudySync saves local chat history and shared notes using browser `localStorage`.

```text
Chat / Notes
     |
     v
localStorage
     |
   Refresh
     |
     v
Data restored
```

This allows locally stored room data to survive a normal page refresh on the same browser.

---

# Problem 3 — Duplicate Messages

### Why the problem occurs

During reconnection or history synchronization, a browser may receive a message that it already has.

Without protection:

```text
Hello
Hello
Hello
```

could appear multiple times.

### Our Solution

Every StudySync message receives a unique message ID.

Example:

```text
peerId-time-randomValue
```

StudySync maintains a JavaScript `Set` containing message IDs that have already been processed.

Before adding a message:

```text
Have we already seen this ID?

YES → Ignore it

NO  → Add the message
```

This prevents duplicate messages during history synchronization.

---

# Problem 4 — Malicious Peer Input

### Why the problem occurs

There is no central application server checking every message in a decentralised room.

A malicious peer could attempt to send HTML or script-like text.

For example:

```html
<img src=x onerror=alert("test")>
```

Rendering peer data directly as HTML could be unsafe.

### Our Solution

StudySync does not insert peer-controlled messages using `innerHTML`.

Instead, peer text is inserted using:

```javascript
element.textContent = message.text;
```

The browser therefore treats the received value as text rather than executable HTML.

StudySync also validates:

- message length;
- message structure;
- display names;
- Room IDs;
- file metadata;
- file size.

---

# Problem 5 — Strangers Can Guess a Room

### Why the problem occurs

A simple room name such as:

```text
group1
```

can easily be guessed.

Another person using the same room information could attempt to join.

### Our Solution

StudySync generates random Room IDs using:

```javascript
crypto.getRandomValues()
```

Example:

```text
study-k8f31z
```

StudySync also supports an optional shared room password.

Therefore, private groups can use:

```text
Random Room ID
       +
Room Password
```

The invite link makes sharing the random Room ID easier.

---

# Problem 6 — Large Files Can Consume Too Much Memory

### Why the problem occurs

Reading a complete large file into memory before sending it can consume significant browser memory.

For example:

```text
Large File
    |
    v
Entire ArrayBuffer
    |
    v
Browser Memory
```

### Our Solution

StudySync reads outgoing files in small chunks.

The current chunk size is:

```text
32 KB
```

JavaScript uses:

```javascript
file.slice(offset, end)
```

Only a small section of the outgoing file is read at a time.

The process becomes:

```text
File

 ↓

32 KB chunk
 ↓
Peer

32 KB chunk
 ↓
Peer

32 KB chunk
 ↓
Peer
```

The current application-level file limit is:

```text
100 MB
```

---

# Problem 7 — Incomplete File Transfer

### Why the problem occurs

A network interruption or invalid transfer can cause the receiving browser to receive fewer bytes than expected.

### Our Solution

Before transferring the file, StudySync sends metadata containing the expected file size.

The receiver counts the bytes received.

The file is offered for download only when:

```text
Received Bytes = Expected File Size
```

Otherwise, the transfer is marked as incomplete or failed.

---

# Security and Privacy

StudySync follows several basic security practices.

### Safe Text Rendering

Peer-provided text is rendered using `textContent`.

### Input Validation

StudySync validates incoming:

- messages;
- names;
- file metadata;
- file sizes.

### Random Rooms

Room IDs are generated using browser cryptographic random values.

### Optional Password

Study rooms can use a shared password.

### No Application Database

StudySync does not use an application database to store room messages or transferred files.

### WebRTC

Communication between connected peers uses WebRTC.

---

# Problems We Faced While Building StudySync

The following problems were encountered while designing and testing the application.

---

## Development Problem 1 — GitHub Pages Has No Backend

### Problem

GitHub Pages hosts static websites and does not provide our application with a custom backend server.

However, two browsers initially need a way to discover each other.

### Why It Happened

A WebRTC peer cannot automatically know the network information of another browser.

Some form of signaling/discovery is needed before the direct connection can be established.

### What We Tried

We first separated two different requirements:

1. website hosting;
2. peer discovery.

We did not want to create an application server that stored users' messages or files.

### Final Solution

We used:

```text
GitHub Pages → Website hosting

Trystero → Peer discovery / signaling

WebRTC → P2P communication
```

This allows StudySync to remain a static GitHub Pages application while still establishing peer connections.

---

# Development Problem 2 — Opening index.html Directly Did Not Work Correctly

### Problem

Opening:

```text
index.html
```

directly using the `file://` protocol was not suitable for testing the complete networking application.

### Why It Happened

StudySync is designed to run from a served web origin.

### What We Tried

We tested the application using a local static development server.

### Final Solution

For development we use a local server such as:

```bash
npx serve .
```

For final cross-device testing we use the deployed HTTPS GitHub Pages website.

StudySync also detects `file://` and displays a warning.

---

# Development Problem 3 — Joining a Room Does Not Mean a Peer Is Connected

### Problem

Initially, entering a StudySync room could make the application appear ready even when no other device was connected.

### Why It Happened

Joining the signaling room and establishing an actual peer connection are separate events.

### What We Tried

We tested peer join and peer leave events separately from the room-join interface.

### Final Solution

StudySync now shows different connection states.

Before another device connects:

```text
Waiting for peer
```

After another peer connects:

```text
P2P Live
```

The sidebar also displays the connected members.

---

# Development Problem 4 — Late Joiners Missed Previous Messages

### Problem

When a new student joined after a conversation had already started, that student could not see earlier messages.

### Why It Happened

Previous P2P messages had already been transmitted before the new device connected.

### What We Tried

We considered storing chat messages on a server, but that would go against the decentralised design of the project.

### Final Solution

Each browser keeps its own limited history.

When a new peer connects, an existing peer sends its available history directly to that peer.

Unique message IDs are used while merging the history to prevent duplicates.

---

# Development Problem 5 — Notes Generated Too Many Network Updates

### Problem

Sending shared notes after every single keyboard event could generate unnecessary network traffic.

### Why It Happened

Typing produces many `input` events.

For example, typing:

```text
HELLO
```

may produce separate updates for:

```text
H
HE
HEL
HELL
HELLO
```

### What We Tried

Initially, the notes synchronization logic could react immediately to every change.

### Final Solution

StudySync uses a small debounce delay.

After the user stops typing for approximately:

```text
350 ms
```

the latest notes state is sent to connected peers.

This reduces unnecessary P2P messages.

---

# Development Problem 6 — File Transfer Required Binary Reconstruction

### Problem

Files cannot be treated like normal chat strings.

The receiving browser must reconstruct the binary data correctly.

### Why It Happened

A file consists of binary bytes and may be too large to conveniently process as one normal message.

### What We Tried

We separated file metadata from the actual binary file data.

### Final Solution

StudySync first sends metadata:

```text
File ID
File Name
File Size
File Type
```

Then it sends binary chunks.

The receiver:

1. identifies the transfer using the File ID;
2. collects the chunks;
3. counts received bytes;
4. creates a Blob;
5. verifies its size;
6. creates a download link.

---

# Development Problem 7 — Shared Notes Could Be Edited at Similar Times

### Problem

Two connected students may edit shared notes around the same time.

### Why It Happened

There is no central server deciding which update is the latest.

### What We Tried

Using only the device time could be unreliable because device clocks may differ.

### Final Solution

StudySync attaches a local version number and peer owner ID to notes updates.

A higher version is preferred.

If versions are equal, the owner ID provides a deterministic tie-breaker.

This gives connected browsers a consistent rule for selecting an update.

---

# Testing

## Test 1 — Peer Connection

1. Open StudySync on two devices.
2. Enter different display names.
3. Use the same Room ID.
4. Use the same password.
5. Join the room.
6. Verify that both devices display:

```text
P2P Live
```

---

## Test 2 — Chat

1. Connect two devices.
2. Send a message from Device A.
3. Verify that Device B receives it.
4. Reply from Device B.
5. Verify that Device A receives the reply.

---

## Test 3 — Late Joiner History

1. Connect Device A and Device B.
2. Send several messages.
3. Connect another peer later.
4. Verify that available chat history synchronizes.

---

## Test 4 — Duplicate Protection

1. Synchronize existing chat history.
2. Verify that previously received messages are not displayed twice.

---

## Test 5 — Shared Notes

1. Connect two devices.
2. Open the Notes tab.
3. Type notes on Device A.
4. Wait briefly.
5. Verify that the notes appear on Device B.

---

## Test 6 — Refresh Persistence

1. Write notes and send messages.
2. Refresh the browser.
3. Join the same room.
4. Verify that locally saved room data is restored.

---

## Test 7 — File Transfer

1. Connect two devices.
2. Open the Files tab.
3. Select a small image, PDF or document.
4. Verify that transfer progress appears.
5. Verify that the receiving browser gets a download option.
6. Download and open the file.

---

## Test 8 — Malicious Text

Send text such as:

```html
<b>Hello</b>
```

The receiving browser should display the characters as text rather than rendering them as HTML.

---

# Known Limitations

StudySync is a peer-to-peer student project and has some limitations.

- Room data is not permanently stored on a central server.
- Chat history is limited to locally available history from browsers.
- A peer holding required data must be online for another peer to receive it.
- Display names are not cryptographically verified identities.
- Very restrictive college or office networks may block direct WebRTC connectivity.
- A TURN fallback may be required on some restrictive networks.
- The current file limit is 100 MB per file.
- Incoming file chunks are temporarily held in browser memory while reconstructing the received file.
- Shared notes use a lightweight version-based synchronization strategy rather than a full CRDT.
- Full-mesh P2P rooms are intended for relatively small study groups.

---

# Project Structure

```text
studysync-team/
│
├── index.html
├── style.css
├── app.js
├── package.json
└── README.md
```

---

# Running StudySync Locally

Do not simply double-click `index.html`.

Run the project through a local web server.

One option is VS Code Live Server.

Another option is:

```bash
npx serve .
```

Then open the localhost address displayed in the terminal.

For real cross-device testing, the deployed HTTPS GitHub Pages version is recommended.

---

# Deployment

StudySync is designed to be hosted using GitHub Pages.

After deployment, the live link will follow the repository structure required by the assignment.

Example:

```text
https://<github-username>.github.io/P2P_App/submissions/<group-folder>/
```

The final live link should be added here after deployment.

---

# Contribution Plan

To keep the Git history meaningful, every team member contributes to a separate part of StudySync.

### Priyansh Dixit

Main responsibilities:

```text
Project integration
WebRTC room setup
Peer lifecycle
Final testing
Deployment
```

Suggested commit:

```text
Integrate StudySync P2P room and peer connection
```

### Krish Kanwadia

Main responsibilities:

```text
P2P chat
Message rendering
Chat history
Duplicate-message protection
```

Suggested commit:

```text
Add P2P chat and message history sync
```

### Sahaj Karanwal

Main responsibilities:

```text
Shared notes
Notes local storage
Notes synchronization
Late joiner notes sync
```

Suggested commit:

```text
Add collaborative notes and peer synchronization
```

### Rishabh Tripathi

Main responsibilities:

```text
File selection
Chunked P2P file transfer
File validation
Download handling
```

Suggested commit:

```text
Add chunked peer to peer file sharing
```

### Ian Axl Morris

Main responsibilities:

```text
StudySync UI
Responsive design
Room and member interface
Validation
README documentation
```

Suggested commit:

```text
Improve responsive UI and project documentation
```

---

# Team

**Priyansh Dixit — 590021860**

**Krish Kanwadia — 590029379**

**Sahaj Karanwal — 590022602**

**Rishabh Tripathi — 590026253**

**Ian Axl Morris — 590022524**

---

## StudySync

**Study together. Directly.**