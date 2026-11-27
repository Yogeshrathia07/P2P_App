
// P2P DOUBT BOARD

// 1. VARIABLES
var pc = null;
var channel = null;
var posts = [];
var storageKey = "doubtBoard";

// 2. GET HTML ELEMENTS
var nameInput = document.getElementById("name");
var doubtInput = document.getElementById("doubt");
var postsBox = document.getElementById("posts");

// 3. LOAD DATA FROM LOCAL STORAGE
function loadPosts() {
    try {
        posts = JSON.parse(localStorage.getItem(storageKey)) || [];
        if (!Array.isArray(posts)) posts = [];
    } catch (error) {
        posts = [];
    }
}

// 4. SAVE DATA
function savePosts() {
    posts = posts.slice(-200);
    localStorage.setItem(storageKey, JSON.stringify(posts));
}

// 5. DISPLAY POSTS
function displayPosts() {
    postsBox.innerHTML = "";

    posts.sort(function(a, b) {
        return a.time - b.time || a.id.localeCompare(b.id);
    });

    for (var i = 0; i < posts.length; i++) {
        var card = document.createElement("div");
        card.className = "post";

        var heading = document.createElement("b");
        heading.textContent = posts[i].name;

        var message = document.createElement("p");
        message.textContent = posts[i].text;

        var date = document.createElement("small");
        date.textContent = new Date(posts[i].time).toLocaleString();

        card.append(heading, message, date);
        postsBox.appendChild(card);
    }
}

// 6. ADD POST AND PREVENT DUPLICATES
function addPost(post) {
    if (!post || typeof post.id !== "string" ||
        typeof post.name !== "string" ||
        typeof post.text !== "string" ||
        post.text.length > 1000 ||
        typeof post.time !== "number") {
        return;
    }

    for (var i = 0; i < posts.length; i++) {
        if (posts[i].id === post.id) return;
    }

    posts.push(post);
    savePosts();
    displayPosts();
}

// 7. POST A DOUBT OR ANSWER
function createPost() {
    var text = doubtInput.value.trim();

    if (text === "") {
        alert("Please write something first.");
        return;
    }

    if (text.length > 1000) {
        alert("Maximum 1000 characters allowed.");
        return;
    }

    var post = {
        id: Date.now().toString() + Math.random().toString(16).slice(2),
        name: nameInput.value.trim() || "Student",
        text: text,
        time: Date.now()
    };

    addPost(post);

    // Send post directly to connected student
    sendData({ type: "post", post: post });

    doubtInput.value = "";
}

// 8. SEND DATA THROUGH WEBRTC
function sendData(data) {
    if (channel && channel.readyState === "open") {
        channel.send(JSON.stringify(data));
    }
}

// 9. SHARE OLD POSTS
function sendHistory() {
    sendData({
        type: "history",
        posts: posts.slice(-200)
    });
}

// 10. RECEIVE DATA
function receiveData(data) {
    if (typeof data !== "string" || data.length > 100000) return;

    var received;

    try {
        received = JSON.parse(data);
    } catch (error) {
        return;
    }

    if (received.type === "post") {
        addPost(received.post);
    }

    if (received.type === "history" &&
        Array.isArray(received.posts)) {

        for (var i = 0; i < received.posts.length && i < 200; i++) {
            addPost(received.posts[i]);
        }
    }
}

// 11. SET UP DATA CHANNEL
function setupChannel(ch) {
    channel = ch;

    ch.onopen = function() {
        document.getElementById("status").textContent = "Connected";
        sendHistory();
    };

    ch.onmessage = function(event) {
        receiveData(event.data);
    };

    ch.onclose = function() {
        document.getElementById("status").textContent = "Disconnected";
    };
}

// 12. CREATE PEER CONNECTION
function createConnection() {
    if (pc) pc.close();

    pc = new RTCPeerConnection({
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" }
        ]
    });

    pc.ondatachannel = function(event) {
        setupChannel(event.channel);
    };

    pc.onconnectionstatechange = function() {
        if (pc.connectionState === "failed") {
            document.getElementById("status").textContent = "Connection Failed";
        }
    };

    return pc;
}

// 13. WAIT FOR CONNECTION DETAILS
function waitForICE() {
    return new Promise(function(resolve) {
        if (pc.iceGatheringState === "complete") {
            resolve();
            return;
        }

        var timer = setTimeout(resolve, 20000);

        function check() {
            if (pc.iceGatheringState === "complete") {
                clearTimeout(timer);
                pc.removeEventListener("icegatheringstatechange", check);
                resolve();
            }
        }

        pc.addEventListener("icegatheringstatechange", check);
    });
}

// 14. CREATE CONNECTION OFFER
async function createOffer() {
    try {
        var connection = createConnection();

        setupChannel(connection.createDataChannel("doubts"));

        var offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        await waitForICE();

        document.getElementById("local").value =
            JSON.stringify(pc.localDescription);

        document.getElementById("status").textContent = "Offer Created";
    } catch (error) {
        alert("Error: " + error.message);
    }
}

// 15. ACCEPT OFFER OR ANSWER
async function acceptConnection() {
    try {
        var description = JSON.parse(
            document.getElementById("remote").value
        );

        if (!description ||
            !["offer", "answer"].includes(description.type) ||
            typeof description.sdp !== "string" ||
            description.sdp.length > 120000) {
            throw new Error("Invalid connection code.");
        }

        if (description.type === "offer") {
            createConnection();

            await pc.setRemoteDescription(description);

            var answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await waitForICE();

            document.getElementById("local").value =
                JSON.stringify(pc.localDescription);

            document.getElementById("status").textContent = "Answer Created";

        } else {
            if (!pc) throw new Error("Create an offer first.");

            await pc.setRemoteDescription(description);

            document.getElementById("status").textContent = "Connecting...";
        }

    } catch (error) {
        alert(error.message);
    }
}

// 16. BUTTON EVENTS
document.getElementById("create").addEventListener("click", createOffer);

document.getElementById("accept").addEventListener("click", acceptConnection);

document.getElementById("post").addEventListener("click", createPost);

document.getElementById("copy").addEventListener("click", async function() {
    try {
        await navigator.clipboard.writeText(
            document.getElementById("local").value
        );
        alert("Connection code copied!");
    } catch (error) {
        document.getElementById("local").select();
        alert("Copy the selected code manually.");
    }
});

// 17. CLEAR LOCAL POSTS
document.getElementById("clear").addEventListener("click", function() {
    if (confirm("Delete all posts saved on this device?")) {
        posts = [];
        savePosts();
        displayPosts();
    }
});

// 18. START APPLICATION
loadPosts();
displayPosts();
