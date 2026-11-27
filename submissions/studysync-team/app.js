/* =========================================================
   STUDYSYNC
   Decentralised P2P Study Room

   Features:
   - WebRTC P2P connection using Trystero
   - Private rooms + optional password
   - Online member list
   - P2P real-time chat
   - Local chat history
   - Late joiner history sync
   - Duplicate message protection
   - Collaborative notes
   - P2P file sharing
   - Chunked file transfer
   - Safe text rendering
   - Invite links
========================================================= */

import {
    joinRoom,
    selfId
} from "https://esm.run/trystero@0.26.0";


/* =========================================================
   APPLICATION CONFIGURATION
========================================================= */

const APP_ID = "studysync-upes-p2p-v1";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

const FILE_CHUNK_SIZE = 32 * 1024; // 32 KB

const MAX_HISTORY_MESSAGES = 100;


/* =========================================================
   DOM HELPER
========================================================= */

const $ = (id) => document.getElementById(id);


/* =========================================================
   APPLICATION STATE
========================================================= */

const state = {

    room: null,

    roomId: "",

    userName: "",

    password: "",

    peers: new Map(),

    actions: {},

    receivedMessageIds: new Set(),

    chatHistory: [],

    incomingFiles: new Map(),

    notesVersion: 0,

    notesOwner: "",

    joined: false
};


/* =========================================================
   BASIC HELPERS
========================================================= */

function generateId() {

    const random =
        crypto.getRandomValues(
            new Uint32Array(1)
        )[0].toString(36);

    return `${selfId}-${Date.now()}-${random}`;
}


function generateRoomId() {

    const random =
        crypto.getRandomValues(
            new Uint32Array(1)
        )[0].toString(36).slice(0, 6);

    return `study-${random}`;
}


function sanitizeRoomId(value) {

    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "")
        .slice(0, 50);
}


function safeName(value) {

    return String(value || "")
        .trim()
        .slice(0, 30);
}


function formatBytes(bytes) {

    if (bytes === 0) {
        return "0 B";
    }

    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {

        return `${(
            bytes / 1024
        ).toFixed(1)} KB`;
    }

    return `${(
        bytes / (1024 * 1024)
    ).toFixed(1)} MB`;
}


function getInitial(name) {

    const cleaned = safeName(name);

    if (!cleaned) {
        return "?";
    }

    return cleaned
        .charAt(0)
        .toUpperCase();
}


function getTime(timestamp) {

    try {

        return new Date(timestamp)
            .toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
            });

    } catch {

        return "";
    }
}


function sleep(ms) {

    return new Promise(
        resolve => setTimeout(resolve, ms)
    );
}


/* =========================================================
   TOAST
========================================================= */

function toast(message, type = "success") {

    const element = $("toast");
    const text = $("toastText");
    const icon = $("toastIcon");

    text.textContent = message;

    if (type === "error") {

        icon.textContent = "!";

        icon.style.color = "#ff5c6c";

    } else {

        icon.textContent = "✓";

        icon.style.color = "#26e86f";
    }

    element.classList.add("show");

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => {

        element.classList.remove("show");

    }, 2500);
}


/* =========================================================
   COPY HELPER
========================================================= */

async function copyText(text, successMessage) {

    try {

        await navigator.clipboard.writeText(text);

        toast(successMessage);

    } catch {

        window.prompt(
            "Copy this:",
            text
        );
    }
}


/* =========================================================
   LOCAL STORAGE
========================================================= */

function historyStorageKey() {

    return `studysync-history-${state.roomId}`;
}


function notesStorageKey() {

    return `studysync-notes-${state.roomId}`;
}


function saveHistory() {

    try {

        const limitedHistory =
            state.chatHistory.slice(
                -MAX_HISTORY_MESSAGES
            );

        localStorage.setItem(
            historyStorageKey(),
            JSON.stringify(limitedHistory)
        );

    } catch (error) {

        console.warn(
            "Could not save chat history:",
            error
        );
    }
}


function loadHistory() {

    try {

        const saved =
            localStorage.getItem(
                historyStorageKey()
            );

        if (!saved) {

            state.chatHistory = [];

            return;
        }

        const parsed = JSON.parse(saved);

        if (!Array.isArray(parsed)) {

            state.chatHistory = [];

            return;
        }

        state.chatHistory =
            parsed.slice(-MAX_HISTORY_MESSAGES);

        for (const message of state.chatHistory) {

            if (message?.id) {

                state.receivedMessageIds.add(
                    message.id
                );
            }
        }

    } catch {

        state.chatHistory = [];
    }
}


function saveNotesLocally(text) {

    try {

        localStorage.setItem(
            notesStorageKey(),
            JSON.stringify({
                text,
                version: state.notesVersion,
                owner: state.notesOwner
            })
        );

    } catch (error) {

        console.warn(
            "Could not save notes:",
            error
        );
    }
}


function loadNotesLocally() {

    try {

        const saved =
            localStorage.getItem(
                notesStorageKey()
            );

        if (!saved) {
            return;
        }

        const data = JSON.parse(saved);

        if (
            !data ||
            typeof data.text !== "string"
        ) {
            return;
        }

        $("sharedNotes").value =
            data.text.slice(0, 20000);

        state.notesVersion =
            Number(data.version) || 0;

        state.notesOwner =
            String(data.owner || selfId);

        updateNotesUI();

    } catch (error) {

        console.warn(
            "Could not load notes:",
            error
        );
    }
}


/* =========================================================
   CONNECTION UI
========================================================= */

function setConnectionState(
    status,
    text
) {

    const dot = $("connectionDot");

    dot.className =
        `connection-dot ${status}`;

    $("connectionText").textContent =
        text;
}


function updatePeerConnectionUI() {

    const count =
        state.peers.size;

    $("memberCount").textContent =
        count + 1;

    if (count > 0) {

        setConnectionState(
            "connected",
            "P2P Live"
        );

        $("chatStatus").textContent =
            `${count} peer${count > 1 ? "s" : ""} connected`;

        $("peerConnectionInfo").textContent =
            `${count} peer device${count > 1 ? "s are" : " is"} directly connected through WebRTC.`;

        $("footerStatus").textContent =
            "Direct peer connection active";

    } else {

        setConnectionState(
            "waiting",
            "Waiting for peer"
        );

        $("chatStatus").textContent =
            "Waiting for another device";

        $("peerConnectionInfo").textContent =
            "Waiting for another device to join this room.";

        $("footerStatus").textContent =
            "StudySync room active";
    }

    renderMembers();
}


/* =========================================================
   MEMBERS
========================================================= */

function createMemberElement(
    peerId,
    name,
    isSelf = false
) {

    const member =
        document.createElement("div");

    member.className = "member";


    const avatar =
        document.createElement("div");

    avatar.className =
        "member-avatar";

    avatar.textContent =
        getInitial(name);


    const online =
        document.createElement("span");

    online.className =
        "member-online";

    avatar.appendChild(online);


    const details =
        document.createElement("div");

    details.className =
        "member-details";


    const memberName =
        document.createElement("strong");

    memberName.textContent =
        name || `Peer ${peerId.slice(0, 5)}`;


    const status =
        document.createElement("span");

    status.textContent =
        isSelf
            ? "This device"
            : "Connected";


    details.append(
        memberName,
        status
    );


    member.append(
        avatar,
        details
    );


    if (isSelf) {

        const you =
            document.createElement("span");

        you.className =
            "you-tag";

        you.textContent = "YOU";

        member.appendChild(you);
    }

    return member;
}


function renderMembers() {

    const list =
        $("membersList");

    list.textContent = "";


    list.appendChild(
        createMemberElement(
            selfId,
            state.userName,
            true
        )
    );


    for (
        const [peerId, peer]
        of state.peers
    ) {

        list.appendChild(
            createMemberElement(
                peerId,
                peer.name,
                false
            )
        );
    }
}


/* =========================================================
   CHAT UI
========================================================= */

function removeEmptyChat() {

    const empty =
        $("emptyChat");

    if (empty) {
        empty.remove();
    }
}


function renderMessage(message) {

    if (
        !message ||
        typeof message.text !== "string"
    ) {
        return;
    }

    removeEmptyChat();


    const own =
        message.senderId === selfId;


    const row =
        document.createElement("div");

    row.className =
        own
            ? "message-row own"
            : "message-row";


    if (!own) {

        const avatar =
            document.createElement("div");

        avatar.className =
            "message-avatar";

        avatar.textContent =
            getInitial(message.name);

        row.appendChild(avatar);
    }


    const content =
        document.createElement("div");

    content.className =
        "message-content";


    if (!own) {

        const name =
            document.createElement("div");

        name.className =
            "message-name";

        /*
           textContent is deliberately used here.
           Peer supplied content is never inserted
           using innerHTML.
        */

        name.textContent =
            safeName(message.name) ||
            "Peer";

        content.appendChild(name);
    }


    const bubble =
        document.createElement("div");

    bubble.className =
        "message-bubble";

    bubble.textContent =
        message.text.slice(0, 1000);


    const time =
        document.createElement("span");

    time.className =
        "message-time";

    time.textContent =
        getTime(message.time);


    content.append(
        bubble,
        time
    );

    row.appendChild(content);

    $("messages").appendChild(row);

    $("messages").scrollTop =
        $("messages").scrollHeight;
}


function renderHistory() {

    const messages =
        $("messages");

    messages.textContent = "";


    if (
        state.chatHistory.length === 0
    ) {

        const empty =
            document.createElement("div");

        empty.id = "emptyChat";

        empty.className =
            "empty-state";


        const icon =
            document.createElement("div");

        icon.className =
            "empty-icon";

        icon.textContent = "◌";


        const heading =
            document.createElement("h3");

        heading.textContent =
            "Your study room is ready";


        const paragraph =
            document.createElement("p");

        paragraph.textContent =
            "Invite another student to start a peer-to-peer conversation.";


        empty.append(
            icon,
            heading,
            paragraph
        );

        messages.appendChild(empty);

        return;
    }


    const sorted =
        [...state.chatHistory]
            .sort(
                (a, b) =>
                    (a.time || 0) -
                    (b.time || 0)
            );


    for (const message of sorted) {

        renderMessage(message);
    }
}


/* =========================================================
   MESSAGE VALIDATION
========================================================= */

function validMessage(message) {

    if (
        !message ||
        typeof message !== "object"
    ) {
        return false;
    }

    if (
        typeof message.id !== "string" ||
        message.id.length > 150
    ) {
        return false;
    }

    if (
        typeof message.text !== "string" ||
        message.text.length === 0 ||
        message.text.length > 1000
    ) {
        return false;
    }

    if (
        typeof message.senderId !== "string"
    ) {
        return false;
    }

    return true;
}


/* =========================================================
   ADD CHAT MESSAGE
========================================================= */

function addMessage(
    message,
    save = true
) {

    if (!validMessage(message)) {
        return false;
    }

    /*
       Duplicate-message protection.
    */

    if (
        state.receivedMessageIds
            .has(message.id)
    ) {
        return false;
    }


    state.receivedMessageIds
        .add(message.id);


    state.chatHistory.push(
        message
    );


    state.chatHistory =
        state.chatHistory.slice(
            -MAX_HISTORY_MESSAGES
        );


    if (save) {
        saveHistory();
    }


    renderMessage(message);

    return true;
}


/* =========================================================
   MERGE HISTORY FROM PEER
========================================================= */

function mergeHistory(history) {

    if (!Array.isArray(history)) {
        return;
    }

    let changed = false;


    for (
        const message
        of history.slice(-MAX_HISTORY_MESSAGES)
    ) {

        if (!validMessage(message)) {
            continue;
        }

        if (
            state.receivedMessageIds
                .has(message.id)
        ) {
            continue;
        }

        state.receivedMessageIds
            .add(message.id);

        state.chatHistory.push(
            message
        );

        changed = true;
    }


    if (!changed) {
        return;
    }


    state.chatHistory =
        state.chatHistory
            .sort(
                (a, b) =>
                    (a.time || 0) -
                    (b.time || 0)
            )
            .slice(-MAX_HISTORY_MESSAGES);


    saveHistory();

    renderHistory();

    toast(
        "Chat history synced"
    );
}


/* =========================================================
   NOTES UI
========================================================= */

function updateNotesUI() {

    const text =
        $("sharedNotes").value;

    $("notesCharacters").textContent =
        `${text.length} characters`;


    const preview =
        $("notesPreview");

    preview.textContent = "";


    if (!text.trim()) {

        const placeholder =
            document.createElement("span");

        placeholder.textContent =
            "Shared notes will appear here as your group starts writing.";

        preview.appendChild(
            placeholder
        );

    } else {

        preview.textContent =
            text.slice(0, 900);
    }
}


/* =========================================================
   NOTES VERSION COMPARISON
========================================================= */

/*
   Every notes update contains:

   version
   owner

   If two peers have the same version,
   owner peerId is used as a tie-breaker.

   This gives every connected browser a
   deterministic way to choose one update.
*/

function isNewerNotesUpdate(data) {

    const incomingVersion =
        Number(data.version) || 0;

    const incomingOwner =
        String(data.owner || "");


    if (
        incomingVersion >
        state.notesVersion
    ) {
        return true;
    }


    if (
        incomingVersion <
        state.notesVersion
    ) {
        return false;
    }


    return (
        incomingOwner >
        state.notesOwner
    );
}


/* =========================================================
   FILE UI
========================================================= */

function removeEmptyFiles() {

    const empty =
        $("emptyFiles");

    if (empty) {
        empty.remove();
    }
}


function createTransferItem(
    id,
    name,
    fileSize,
    direction
) {

    removeEmptyFiles();


    const item =
        document.createElement("div");

    item.className =
        "transfer-item";

    item.id =
        `transfer-${id}`;


    const top =
        document.createElement("div");

    top.className =
        "transfer-top";


    const icon =
        document.createElement("div");

    icon.className =
        "file-type-icon";

    icon.textContent =
        direction === "Sending"
            ? "↑"
            : "↓";


    const details =
        document.createElement("div");

    details.className =
        "transfer-details";


    const fileName =
        document.createElement("strong");

    fileName.textContent =
        name;


    const info =
        document.createElement("span");

    info.textContent =
        `${direction} • ${formatBytes(fileSize)}`;


    details.append(
        fileName,
        info
    );


    const percent =
        document.createElement("div");

    percent.className =
        "transfer-percent";

    percent.textContent =
        "0%";


    top.append(
        icon,
        details,
        percent
    );


    const progress =
        document.createElement("div");

    progress.className =
        "transfer-progress";


    const bar =
        document.createElement("div");

    progress.appendChild(bar);


    item.append(
        top,
        progress
    );


    $("fileTransfers")
        .prepend(item);


    return {
        item,
        percent,
        bar,
        info
    };
}


function updateTransferProgress(
    transfer,
    received,
    total,
    text
) {

    if (!transfer) {
        return;
    }


    const safeTotal =
        Math.max(total, 1);


    const percentage =
        Math.min(
            100,
            Math.round(
                received /
                safeTotal *
                100
            )
        );


    transfer.percent.textContent =
        `${percentage}%`;

    transfer.bar.style.width =
        `${percentage}%`;


    if (text) {

        transfer.info.textContent =
            text;
    }
}


/* =========================================================
   RECENT FILE
========================================================= */

function addRecentFile(
    name,
    fileSize,
    url = null,
    downloadName = null
) {

    const empty =
        $("noRecentFiles");

    if (empty) {
        empty.remove();
    }


    const item =
        document.createElement("div");

    item.className =
        "recent-file";


    const icon =
        document.createElement("div");

    icon.className =
        "recent-file-icon";

    icon.textContent = "FILE";


    const info =
        document.createElement("div");

    info.className =
        "recent-file-info";


    const title =
        document.createElement("strong");

    title.textContent =
        name;


    const meta =
        document.createElement("span");

    meta.textContent =
        formatBytes(fileSize);


    info.append(
        title,
        meta
    );


    item.append(
        icon,
        info
    );


    if (url) {

        const download =
            document.createElement("a");

        download.className =
            "download-link";

        download.href = url;

        download.download =
            downloadName || name;

        download.textContent =
            "Download";

        item.appendChild(download);
    }


    $("recentFiles")
        .prepend(item);
}


/* =========================================================
   COMPLETE RECEIVED FILE
========================================================= */

function completeIncomingFile(id) {

    const incoming =
        state.incomingFiles.get(id);

    if (!incoming) {
        return;
    }


    if (
        incoming.received !==
        incoming.meta.size
    ) {

        incoming.transfer.percent
            .textContent = "Failed";

        incoming.transfer.info
            .textContent =
                "Incomplete transfer";

        toast(
            "File transfer incomplete",
            "error"
        );

        state.incomingFiles.delete(id);

        return;
    }


    const blob =
        new Blob(
            incoming.chunks,
            {
                type:
                    incoming.meta.type ||
                    "application/octet-stream"
            }
        );


    if (
        blob.size !==
        incoming.meta.size
    ) {

        incoming.transfer.percent
            .textContent = "Failed";

        incoming.transfer.info
            .textContent =
                "File verification failed";

        toast(
            "File verification failed",
            "error"
        );

        state.incomingFiles.delete(id);

        return;
    }


    const url =
        URL.createObjectURL(blob);


    updateTransferProgress(
        incoming.transfer,
        incoming.meta.size,
        incoming.meta.size,
        `Received • ${formatBytes(blob.size)}`
    );


    const download =
        document.createElement("a");

    download.className =
        "download-link";

    download.href = url;

    download.download =
        incoming.meta.name;

    download.textContent =
        "Download file";


    incoming.transfer.item
        .appendChild(download);


    addRecentFile(
        incoming.meta.name,
        blob.size,
        url,
        incoming.meta.name
    );


    state.incomingFiles.delete(id);


    toast(
        `${incoming.meta.name} received`
    );
}


/* =========================================================
   TRYSTERO ACTIONS
========================================================= */

function setupP2PActions() {

    const room =
        state.room;


    /*
       Each action is a named P2P data channel.
    */

    const nameAction =
        room.makeAction("member-name");

    const chatAction =
        room.makeAction("study-chat");

    const historyAction =
        room.makeAction("chat-history");

    const notesAction =
        room.makeAction("shared-notes");

    const notesRequestAction =
        room.makeAction("notes-request");

    const fileMetaAction =
        room.makeAction("file-meta");

    const fileChunkAction =
        room.makeAction("file-chunk");


    state.actions = {

        nameAction,
        chatAction,
        historyAction,
        notesAction,
        notesRequestAction,
        fileMetaAction,
        fileChunkAction
    };


    /* =====================================================
       RECEIVE MEMBER NAME
    ====================================================== */

    nameAction.onMessage =
        (
            incomingName,
            { peerId }
        ) => {

            const name =
                safeName(incomingName);

            if (!name) {
                return;
            }


            state.peers.set(
                peerId,
                { name }
            );


            updatePeerConnectionUI();
        };


    /* =====================================================
       RECEIVE CHAT MESSAGE
    ====================================================== */

    chatAction.onMessage =
        (
            message,
            { peerId }
        ) => {

            if (!validMessage(message)) {
                return;
            }


            /*
               The senderId must represent
               the peer that actually sent it.
            */

            const safeMessage = {
                id:
                    String(message.id),

                senderId:
                    peerId,

                name:
                    safeName(message.name) ||
                    state.peers.get(peerId)?.name ||
                    "Peer",

                text:
                    String(message.text)
                        .slice(0, 1000),

                time:
                    Number(message.time) ||
                    Date.now()
            };


            addMessage(
                safeMessage
            );
        };


    /* =====================================================
       RECEIVE CHAT HISTORY
    ====================================================== */

    historyAction.onMessage =
        (
            history
        ) => {

            mergeHistory(
                history
            );
        };


    /* =====================================================
       RECEIVE SHARED NOTES
    ====================================================== */

    notesAction.onMessage =
        (
            data,
            { peerId }
        ) => {

            if (
                !data ||
                typeof data.text !== "string" ||
                data.text.length > 20000
            ) {
                return;
            }


            const incoming = {

                text:
                    data.text.slice(
                        0,
                        20000
                    ),

                version:
                    Number(
                        data.version
                    ) || 0,

                owner:
                    String(
                        data.owner ||
                        peerId
                    )
            };


            if (
                !isNewerNotesUpdate(
                    incoming
                )
            ) {
                return;
            }


            state.notesVersion =
                incoming.version;

            state.notesOwner =
                incoming.owner;


            $("sharedNotes").value =
                incoming.text;


            saveNotesLocally(
                incoming.text
            );


            updateNotesUI();


            $("notesSyncStatus")
                .textContent =
                    "Synced from peer";

            $("notesSaved")
                .textContent =
                    "Synced";


            setTimeout(() => {

                $("notesSaved")
                    .textContent =
                        "Ready";

            }, 1500);
        };


    /* =====================================================
       NOTES REQUEST

       Late joiner asks an existing peer
       for current notes.
    ====================================================== */

    notesRequestAction.onMessage =
        async (
            _request,
            { peerId }
        ) => {

            try {

                await notesAction.send(
                    {
                        text:
                            $("sharedNotes").value,

                        version:
                            state.notesVersion,

                        owner:
                            state.notesOwner ||
                            selfId
                    },
                    {
                        target: peerId
                    }
                );

            } catch (error) {

                console.warn(
                    "Notes sync failed:",
                    error
                );
            }
        };


    /* =====================================================
       RECEIVE FILE METADATA
    ====================================================== */

    fileMetaAction.onMessage =
        (
            meta,
            { peerId }
        ) => {

            if (
                !meta ||
                typeof meta.id !== "string" ||
                typeof meta.name !== "string" ||
                typeof meta.size !== "number"
            ) {
                return;
            }


            if (
                meta.size < 0 ||
                meta.size > MAX_FILE_SIZE
            ) {

                toast(
                    "Peer tried to send an invalid file",
                    "error"
                );

                return;
            }


            const safeMeta = {

                id:
                    meta.id.slice(
                        0,
                        150
                    ),

                name:
                    meta.name.slice(
                        0,
                        180
                    ),

                size:
                    meta.size,

                type:
                    typeof meta.type === "string"
                        ? meta.type.slice(0, 100)
                        : "application/octet-stream"
            };


            const transfer =
                createTransferItem(
                    safeMeta.id,
                    safeMeta.name,
                    safeMeta.size,
                    "Receiving"
                );


            state.incomingFiles.set(
                safeMeta.id,
                {
                    meta:
                        safeMeta,

                    peerId,

                    chunks: [],

                    received: 0,

                    transfer
                }
            );


            if (
                safeMeta.size === 0
            ) {

                completeIncomingFile(
                    safeMeta.id
                );
            }
        };


    /* =====================================================
       RECEIVE FILE CHUNKS
    ====================================================== */

    fileChunkAction.onMessage =
        (
            data,
            {
                peerId,
                metadata
            }
        ) => {

            const fileId =
                metadata?.fileId;


            if (
                typeof fileId !== "string"
            ) {
                return;
            }


            const incoming =
                state.incomingFiles.get(
                    fileId
                );


            if (!incoming) {
                return;
            }


            if (
                incoming.peerId !==
                peerId
            ) {
                return;
            }


            let bytes;


            if (
                data instanceof ArrayBuffer
            ) {

                bytes =
                    new Uint8Array(data);

            } else if (
                data instanceof Uint8Array
            ) {

                bytes = data;

            } else if (
                ArrayBuffer.isView(data)
            ) {

                bytes =
                    new Uint8Array(
                        data.buffer,
                        data.byteOffset,
                        data.byteLength
                    );

            } else {

                return;
            }


            /*
               Copy bytes before storing.
            */

            const copy =
                new Uint8Array(
                    bytes.byteLength
                );

            copy.set(bytes);


            incoming.chunks.push(
                copy
            );


            incoming.received +=
                copy.byteLength;


            if (
                incoming.received >
                incoming.meta.size
            ) {

                incoming.transfer
                    .percent
                    .textContent =
                        "Failed";

                incoming.transfer
                    .info
                    .textContent =
                        "Invalid file data";

                state.incomingFiles
                    .delete(fileId);

                toast(
                    "Invalid file transfer",
                    "error"
                );

                return;
            }


            updateTransferProgress(
                incoming.transfer,
                incoming.received,
                incoming.meta.size,
                `Receiving • ${formatBytes(incoming.received)} / ${formatBytes(incoming.meta.size)}`
            );


            if (
                metadata?.last === true
            ) {

                completeIncomingFile(
                    fileId
                );
            }
        };


    /* =====================================================
       PEER JOINS
    ====================================================== */

    room.onPeerJoin =
        async (peerId) => {

            /*
               Initially peer may not have
               sent its name yet.
            */

            if (
                !state.peers.has(peerId)
            ) {

                state.peers.set(
                    peerId,
                    {
                        name:
                            `Peer ${peerId.slice(0, 5)}`
                    }
                );
            }


            updatePeerConnectionUI();


            try {

                /*
                   Send our name only to
                   newly connected peer.
                */

                await nameAction.send(
                    state.userName,
                    {
                        target: peerId
                    }
                );


                /*
                   Send existing chat history.
                   This solves the late-joiner
                   history problem.
                */

                await historyAction.send(
                    state.chatHistory,
                    {
                        target: peerId
                    }
                );


                /*
                   Ask for notes so both peers
                   can compare current state.
                */

                await notesRequestAction.send(
                    {
                        request: true
                    },
                    {
                        target: peerId
                    }
                );


                /*
                   Also send our notes.
                */

                await notesAction.send(
                    {
                        text:
                            $("sharedNotes").value,

                        version:
                            state.notesVersion,

                        owner:
                            state.notesOwner ||
                            selfId
                    },
                    {
                        target: peerId
                    }
                );

            } catch (error) {

                console.warn(
                    "Initial peer sync failed:",
                    error
                );
            }


            toast(
                "A study partner connected"
            );
        };


    /* =====================================================
       PEER LEAVES
    ====================================================== */

    room.onPeerLeave =
        (peerId) => {

            const name =
                state.peers.get(peerId)?.name;


            state.peers.delete(
                peerId
            );


            updatePeerConnectionUI();


            toast(
                name
                    ? `${name} disconnected`
                    : "A peer disconnected"
            );
        };
}


/* =========================================================
   JOIN ROOM
========================================================= */

async function joinStudyRoom(event) {

    event.preventDefault();


    const name =
        safeName(
            $("userName").value
        );


    const roomId =
        sanitizeRoomId(
            $("roomId").value
        );


    const password =
        $("roomPassword").value;


    $("joinError").textContent = "";


    if (!name) {

        $("joinError").textContent =
            "Please enter your display name.";

        return;
    }


    if (!roomId) {

        $("joinError").textContent =
            "Please enter a valid Room ID.";

        return;
    }


    /*
       WebRTC/browser networking should
       run from a served origin rather
       than opening index.html directly.
    */

    if (
        location.protocol === "file:"
    ) {

        $("joinError").textContent =
            "StudySync must run through localhost or GitHub Pages. Do not open index.html directly.";

        return;
    }


    try {

        $("joinButton").disabled =
            true;

        $("joinButton")
            .querySelector("span")
            .textContent =
                "Connecting...";


        state.userName =
            name;

        state.roomId =
            roomId;

        state.password =
            password;


        /*
           Join Trystero room.

           Trystero handles signaling and
           creates WebRTC connections
           between browsers.
        */

        state.room =
            joinRoom(
                {
                    appId:
                        APP_ID,

                    password:
                        password ||
                        undefined
                },
                roomId
            );


        setupP2PActions();


        state.joined =
            true;


        /*
           Remember convenience fields
           locally on this browser.
        */

        localStorage.setItem(
            "studysync-name",
            state.userName
        );

        localStorage.setItem(
            "studysync-room",
            state.roomId
        );


        /*
           Load local room data.
        */

        loadHistory();

        loadNotesLocally();


        /*
           Set UI.
        */

        $("headerName").textContent =
            state.userName;

        $("headerAvatar").textContent =
            getInitial(state.userName);

        $("sidebarRoomName").textContent =
            "Study Room";

        $("roomCode").textContent =
            state.roomId;


        renderHistory();

        updateNotesUI();

        updatePeerConnectionUI();


        $("joinScreen")
            .classList
            .add("hidden");

        $("appScreen")
            .classList
            .remove("hidden");


        toast(
            "Study room joined"
        );


    } catch (error) {

        console.error(
            "Room connection error:",
            error
        );


        $("joinError").textContent =
            "Could not join the room. Check your internet connection and try the deployed HTTPS version.";


        setConnectionState(
            "error",
            "Connection error"
        );

    } finally {

        $("joinButton").disabled =
            false;

        $("joinButton")
            .querySelector("span")
            .textContent =
                "Enter Study Room";
    }
}


/* =========================================================
   SEND CHAT MESSAGE
========================================================= */

async function sendChatMessage(event) {

    event.preventDefault();


    if (!state.room) {
        return;
    }


    const input =
        $("messageInput");


    const text =
        input.value
            .trim()
            .slice(0, 1000);


    if (!text) {
        return;
    }


    const message = {

        id:
            generateId(),

        senderId:
            selfId,

        name:
            state.userName,

        text,

        time:
            Date.now()
    };


    /*
       Add locally first.
    */

    addMessage(
        message
    );


    input.value = "";


    try {

        /*
           Sent directly to connected peers.
        */

        await state.actions
            .chatAction
            .send(message);

    } catch (error) {

        console.error(
            "Message send failed:",
            error
        );

        toast(
            "Message could not be sent",
            "error"
        );
    }
}


/* =========================================================
   SHARED NOTES
========================================================= */

let notesTimer = null;


function localNotesChanged() {

    const text =
        $("sharedNotes")
            .value
            .slice(0, 20000);


    state.notesVersion += 1;

    state.notesOwner =
        selfId;


    saveNotesLocally(
        text
    );


    updateNotesUI();


    $("notesSaved")
        .textContent =
            "Saved locally";


    $("notesSyncStatus")
        .textContent =
            state.peers.size
                ? "Syncing..."
                : "Saved locally";


    clearTimeout(
        notesTimer
    );


    /*
       Small debounce prevents sending a
       network update for every keystroke.
    */

    notesTimer =
        setTimeout(
            () =>
                broadcastNotes(text),
            350
        );
}


async function broadcastNotes(text) {

    if (
        !state.room ||
        state.peers.size === 0
    ) {

        $("notesSyncStatus")
            .textContent =
                "Saved locally";

        return;
    }


    try {

        await state.actions
            .notesAction
            .send({
                text,
                version:
                    state.notesVersion,
                owner:
                    state.notesOwner
            });


        $("notesSyncStatus")
            .textContent =
                "Synced with peers";

        $("notesSaved")
            .textContent =
                "Synced";


    } catch (error) {

        console.error(
            "Notes sync failed:",
            error
        );


        $("notesSyncStatus")
            .textContent =
                "Sync failed";
    }
}


/* =========================================================
   NOTES TOOLBAR
========================================================= */

function insertNotePrefix(prefix) {

    const textarea =
        $("sharedNotes");


    const start =
        textarea.selectionStart;

    const end =
        textarea.selectionEnd;


    const value =
        textarea.value;


    const selected =
        value.slice(
            start,
            end
        );


    let insertion;


    if (prefix === "**") {

        insertion =
            `**${selected}**`;

    } else {

        insertion =
            `${prefix}${selected}`;
    }


    textarea.value =
        value.slice(0, start) +
        insertion +
        value.slice(end);


    textarea.focus();


    textarea.selectionStart =
        textarea.selectionEnd =
            start +
            insertion.length;


    localNotesChanged();
}


/* =========================================================
   SEND FILE
========================================================= */

async function sendFile(file) {

    if (!file) {
        return;
    }


    if (
        file.size >
        MAX_FILE_SIZE
    ) {

        toast(
            `${file.name} is larger than the 100 MB limit`,
            "error"
        );

        return;
    }


    if (
        state.peers.size === 0
    ) {

        toast(
            "Connect another device before sharing a file",
            "error"
        );

        return;
    }


    const id =
        generateId();


    const metadata = {

        id,

        name:
            file.name.slice(
                0,
                180
            ),

        size:
            file.size,

        type:
            file.type ||
            "application/octet-stream"
    };


    const transfer =
        createTransferItem(
            id,
            metadata.name,
            metadata.size,
            "Sending"
        );


    try {

        /*
           Send metadata first.
        */

        await state.actions
            .fileMetaAction
            .send(metadata);


        /*
           Empty file.
        */

        if (
            file.size === 0
        ) {

            updateTransferProgress(
                transfer,
                1,
                1,
                "Sent • 0 B"
            );


            addRecentFile(
                metadata.name,
                0
            );


            toast(
                `${metadata.name} sent`
            );

            return;
        }


        /*
           Give receiver time to create
           its incoming transfer state.
        */

        await sleep(70);


        let sent = 0;


        /*
           IMPORTANT:

           File is not read completely into
           memory.

           Blob.slice() reads one small chunk
           at a time.
        */

        for (
            let offset = 0;
            offset < file.size;
            offset += FILE_CHUNK_SIZE
        ) {

            const end =
                Math.min(
                    offset +
                    FILE_CHUNK_SIZE,
                    file.size
                );


            const buffer =
                await file
                    .slice(
                        offset,
                        end
                    )
                    .arrayBuffer();


            const bytes =
                new Uint8Array(
                    buffer
                );


            const last =
                end >= file.size;


            await state.actions
                .fileChunkAction
                .send(
                    bytes,
                    {
                        metadata: {
                            fileId:
                                id,
                            last
                        }
                    }
                );


            sent = end;


            updateTransferProgress(
                transfer,
                sent,
                file.size,
                `Sending • ${formatBytes(sent)} / ${formatBytes(file.size)}`
            );


            /*
               Yield occasionally so the
               interface remains responsive.
            */

            if (
                sent %
                (FILE_CHUNK_SIZE * 12)
                === 0
            ) {

                await sleep(0);
            }
        }


        updateTransferProgress(
            transfer,
            file.size,
            file.size,
            `Sent • ${formatBytes(file.size)}`
        );


        addRecentFile(
            metadata.name,
            metadata.size
        );


        toast(
            `${metadata.name} sent`
        );


    } catch (error) {

        console.error(
            "File transfer failed:",
            error
        );


        transfer.percent
            .textContent =
                "Failed";

        transfer.info
            .textContent =
                "Transfer failed";


        toast(
            "File transfer failed",
            "error"
        );
    }
}


/* =========================================================
   FILE SELECTION
========================================================= */

async function handleSelectedFiles(
    fileList
) {

    const files =
        Array.from(
            fileList || []
        );


    for (const file of files) {

        await sendFile(
            file
        );
    }
}


/* =========================================================
   TAB NAVIGATION
========================================================= */

function openTab(tabName) {

    document
        .querySelectorAll(
            ".workspace-tab"
        )
        .forEach(button => {

            button.classList
                .toggle(
                    "active",
                    button.dataset.tab ===
                    tabName
                );
        });


    document
        .querySelectorAll(
            ".tab-panel"
        )
        .forEach(panel => {

            panel.classList
                .remove(
                    "active-panel"
                );
        });


    const panel =
        $(
            `${tabName}Panel`
        );


    if (panel) {

        panel.classList
            .add(
                "active-panel"
            );
    }
}


/* =========================================================
   LEAVE ROOM
========================================================= */

async function leaveRoom() {

    try {

        if (state.room) {

            await state.room.leave();
        }

    } catch (error) {

        console.warn(
            "Leave room error:",
            error
        );
    }


    location.reload();
}


/* =========================================================
   INVITE LINK
========================================================= */

function createInviteLink() {

    const url =
        new URL(
            location.href
        );


    url.searchParams.set(
        "room",
        state.roomId
    );


    return url.toString();
}


/* =========================================================
   CLEAR TRANSFER LIST
========================================================= */

function clearTransfers() {

    state.incomingFiles.clear();


    $("fileTransfers")
        .textContent = "";


    const empty =
        document.createElement("div");

    empty.id =
        "emptyFiles";

    empty.className =
        "empty-files";


    const icon =
        document.createElement("div");

    icon.textContent = "□";


    const title =
        document.createElement("strong");

    title.textContent =
        "No files shared yet";


    const description =
        document.createElement("span");

    description.textContent =
        "Connect another peer and select a file.";


    empty.append(
        icon,
        title,
        description
    );


    $("fileTransfers")
        .appendChild(empty);
}


/* =========================================================
   EVENT LISTENERS
========================================================= */


/* JOIN */

$("joinForm")
    .addEventListener(
        "submit",
        joinStudyRoom
    );


/* RANDOM ROOM */

$("generateRoom")
    .addEventListener(
        "click",
        () => {

            $("roomId").value =
                generateRoomId();
        }
    );


/* PASSWORD VISIBILITY */

$("togglePassword")
    .addEventListener(
        "click",
        () => {

            const input =
                $("roomPassword");


            if (
                input.type ===
                "password"
            ) {

                input.type =
                    "text";

                $("togglePassword")
                    .textContent =
                        "◎";

            } else {

                input.type =
                    "password";

                $("togglePassword")
                    .textContent =
                        "◉";
            }
        }
    );


/* CHAT */

$("messageForm")
    .addEventListener(
        "submit",
        sendChatMessage
    );


/* NOTES */

$("sharedNotes")
    .addEventListener(
        "input",
        localNotesChanged
    );


document
    .querySelectorAll(
        ".note-tool"
    )
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                insertNotePrefix(
                    button.dataset.prefix
                );
            }
        );
    });


/* WORKSPACE TABS */

document
    .querySelectorAll(
        ".workspace-tab"
    )
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                openTab(
                    button.dataset.tab
                );
            }
        );
    });


/* QUICK OPEN NOTES */

$("openNotes")
    .addEventListener(
        "click",
        () => {

            openTab(
                "notes"
            );
        }
    );


/* QUICK OPEN FILES */

$("openFiles")
    .addEventListener(
        "click",
        () => {

            openTab(
                "files"
            );
        }
    );


/* COPY ROOM */

$("copyRoom")
    .addEventListener(
        "click",
        () => {

            copyText(
                state.roomId,
                "Room ID copied"
            );
        }
    );


/* COPY INVITE */

$("copyInvite")
    .addEventListener(
        "click",
        () => {

            copyText(
                createInviteLink(),
                "Invite link copied"
            );
        }
    );


/* LEAVE */

$("leaveRoom")
    .addEventListener(
        "click",
        leaveRoom
    );


/* FILE INPUT */

$("fileInput")
    .addEventListener(
        "change",
        async event => {

            await handleSelectedFiles(
                event.target.files
            );


            /*
               Reset input so selecting the
               same file again still works.
            */

            event.target.value = "";
        }
    );


/* DRAG AND DROP */

const dropZone =
    $("dropZone");


[
    "dragenter",
    "dragover"
].forEach(
    eventName => {

        dropZone.addEventListener(
            eventName,
            event => {

                event.preventDefault();

                dropZone.classList
                    .add(
                        "dragging"
                    );
            }
        );
    }
);


[
    "dragleave",
    "drop"
].forEach(
    eventName => {

        dropZone.addEventListener(
            eventName,
            event => {

                event.preventDefault();

                dropZone.classList
                    .remove(
                        "dragging"
                    );
            }
        );
    }
);


dropZone.addEventListener(
    "drop",
    async event => {

        await handleSelectedFiles(
            event.dataTransfer.files
        );
    }
);


/* CLEAR FILE LIST */

$("clearTransfers")
    .addEventListener(
        "click",
        clearTransfers
    );


/* =========================================================
   INITIAL PAGE SETUP
========================================================= */

function initialisePage() {

    /*
       Restore previously used name.
    */

    const savedName =
        localStorage.getItem(
            "studysync-name"
        );


    if (savedName) {

        $("userName").value =
            savedName;
    }


    /*
       Invite link has priority over
       previously used room.
    */

    const parameters =
        new URLSearchParams(
            location.search
        );


    const inviteRoom =
        sanitizeRoomId(
            parameters.get("room") ||
            ""
        );


    if (inviteRoom) {

        $("roomId").value =
            inviteRoom;

    } else {

        const savedRoom =
            sanitizeRoomId(
                localStorage.getItem(
                    "studysync-room"
                ) || ""
            );


        $("roomId").value =
            savedRoom ||
            generateRoomId();
    }


    /*
       Show helpful warning when student
       double-clicks index.html directly.
    */

    if (
        location.protocol ===
        "file:"
    ) {

        $("joinError").textContent =
            "For P2P features, run StudySync using Live Server/localhost or deploy it to GitHub Pages.";
    }
}


/* START */

initialisePage();