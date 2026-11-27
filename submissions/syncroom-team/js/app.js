const APP_ID = "syncroom.example.p2p-music.v1";
const $ = (id) => document.getElementById(id);

const usernameInput = $("username");
const roomCodeInput = $("roomCode");
const message = $("message");

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("error", isError);
}

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join("");
}

function enterRoom(code, isHost) {
  const username = usernameInput.value.trim();
  if (!username) {
    showMessage("Please enter your display name.", true);
    usernameInput.focus();
    return;
  }
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    showMessage("Room codes must contain exactly 6 letters or numbers.", true);
    return;
  }

  sessionStorage.setItem("syncroom_username", username);
  sessionStorage.setItem("syncroom_room", code);
  sessionStorage.setItem("syncroom_is_host", String(isHost));
  window.location.href = `room.html#${encodeURIComponent(code)}`;
}

$("createRoom").addEventListener("click", () => enterRoom(makeRoomCode(), true));
$("joinRoom").addEventListener("click", () => {
  const code = roomCodeInput.value.trim().toUpperCase();
  enterRoom(code, false);
});
roomCodeInput.addEventListener("input", () => {
  roomCodeInput.value = roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
});
usernameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") $("createRoom").click();
});