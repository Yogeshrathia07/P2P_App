/**
 * PeerForge WebRTC Signaling & Room Session State
 * Manages peer connection negotiation, live code/cursor sync, and interview session state.
 */

// In-memory room store: roomId -> RoomState
export const activeRooms = new Map();
let socketIoInstance = null;

export const normalizeRoomId = (id) => {
  if (!id) return "";
  try {
    id = decodeURIComponent(id);
  } catch (e) {}
  return id.toString().replace(/\s+/g, "").trim().toUpperCase();
};

export const setSocketIoInstance = (io) => {
  socketIoInstance = io;
};

/**
 * Broadcast real-time unlock event when both peers have submitted feedback
 */
export const notifyFeedbackUnlocked = (roomId) => {
  if (socketIoInstance && roomId) {
    socketIoInstance.to(roomId).emit("feedback:unlocked", {
      roomId,
      unlockedAt: new Date(),
    });
  }
};

/**
 * Notify room partner that a peer has submitted their evaluation
 */
export const notifyPartnerSubmitted = (roomId, reviewerUserId) => {
  if (socketIoInstance && roomId) {
    socketIoInstance.to(roomId).emit("feedback:partner-submitted", {
      roomId,
      reviewerUserId,
    });
  }
};

// Helper to safely format participant object for transmission
export const formatParticipant = (p) => ({
  socketId: p.socketId,
  userId: p.userId,
  name: p.user?.name || "Developer",
  avatarUrl: p.user?.profile?.avatarUrl || null,
  role: p.role,
  media: p.media,
});

/**
 * Register all room and WebRTC signaling listeners for a connected socket
 */
export const registerRoomHandlers = (io, socket) => {
  if (io) setSocketIoInstance(io);
  /**
   * Check room status by code
   */
  socket.on("room:check", ({ roomId }, callback) => {
    if (!roomId) {
      if (typeof callback === "function") callback({ exists: false, message: "Room Code required" });
      return;
    }
    const cleanRoomId = normalizeRoomId(roomId);
    const room = activeRooms.get(cleanRoomId);
    if (typeof callback === "function") {
      if (room) {
        callback({
          exists: true,
          roomId: cleanRoomId,
          track: room.track,
          difficulty: room.difficulty,
          participantCount: room.participants.size,
          isFull: room.participants.size >= 2,
        });
      } else {
        callback({
          exists: false,
          roomId: cleanRoomId,
          participantCount: 0,
          isFull: false,
        });
      }
    }
  });

  /**
   * Join an interview room
   */
  socket.on("room:join", ({ roomId, track, difficulty, user: clientUser }, callback) => {
    try {
      if (!roomId) {
        const err = { success: false, message: "Room ID or Code is required" };
        if (typeof callback === "function") callback(err);
        return;
      }

      const cleanRoomId = normalizeRoomId(roomId);
      let room = activeRooms.get(cleanRoomId);

      // If client supplied user information, update socket.user
      if (clientUser && clientUser.name) {
        socket.user = {
          ...socket.user,
          _id: clientUser.id || clientUser._id || socket.user?._id,
          name: clientUser.name,
          email: clientUser.email || socket.user?.email || "",
          profile: {
            ...socket.user?.profile,
            avatarUrl: clientUser.avatarUrl || socket.user?.profile?.avatarUrl,
          },
        };
      }

      // Initialize room if it does not exist
      if (!room) {
        room = {
          roomId: cleanRoomId,
          track: track || "Data Structures & Algorithms (DSA)",
          difficulty: difficulty || "Mid-Level",
          participants: new Map(),
          code: "",
          language: "javascript",
          activeProblemId: null,
          timer: {
            startedAt: Date.now(),
            durationSeconds: 3600, // 60 minutes
            isRunning: true,
            phase: 1, // Phase 1: 0-30m, Phase 2: 30-60m
          },
          lastActivity: Date.now(),
        };
        activeRooms.set(cleanRoomId, room);
      }

      // Check if user already exists in room (by socket.id OR by userId)
      const myUserId = (socket.user?._id || socket.id).toString();
      let existingSocketId = null;
      for (const [sId, p] of room.participants.entries()) {
        if (sId === socket.id || (p.userId && p.userId === myUserId)) {
          existingSocketId = sId;
          break;
        }
      }

      if (existingSocketId && existingSocketId !== socket.id) {
        // User reconnected or refreshed; safely replace their old socket
        room.participants.delete(existingSocketId);
      }

      const isExistingParticipant = Boolean(existingSocketId);
      if (!isExistingParticipant && room.participants.size >= 2) {
        const fullErr = { success: false, message: "Room is at maximum capacity (2 peers)" };
        socket.emit("room:full", fullErr);
        if (typeof callback === "function") callback(fullErr);
        return;
      }

      // Determine participant role (strictly complementary)
      let role = "candidate";
      if (room.participants.size === 1) {
        const existingParticipant = Array.from(room.participants.values())[0];
        role = existingParticipant.role === "candidate" ? "interviewer" : "candidate";
      } else if (existingSocketId && room.participants.has(existingSocketId)) {
        role = room.participants.get(existingSocketId).role;
      }

      const participant = {
        socketId: socket.id,
        userId: socket.user?._id?.toString() || socket.id,
        user: socket.user,
        role,
        media: {
          audio: true,
          video: true,
        },
      };

      room.participants.set(socket.id, participant);
      room.lastActivity = Date.now();
      socket.join(cleanRoomId);
      socket.currentRoomId = cleanRoomId;

      console.log(`[Room Joined] User ${socket.user?.name} (${role}) joined ${cleanRoomId}`);

      const participantsList = Array.from(room.participants.values()).map(formatParticipant);

      // Send initial room snapshot to the joining user
      const roomState = {
        success: true,
        roomId: cleanRoomId,
        roomCode: cleanRoomId,
        track: room.track,
        difficulty: room.difficulty,
        myRole: role,
        code: room.code,
        language: room.language,
        activeProblemId: room.activeProblemId,
        timer: room.timer,
        participants: participantsList,
      };

      socket.emit("room:state", roomState);
      if (typeof callback === "function") callback(roomState);

      // Notify other peer in the room
      socket.to(cleanRoomId).emit("room:peer-joined", {
        peer: formatParticipant(participant),
        participants: participantsList,
      });
    } catch (err) {
      console.error("[Room Join Error]", err);
      socket.emit("room:error", { message: "Failed to join room" });
    }
  });

  /**
   * WebRTC Signaling: SDP Offer
   */
  socket.on("webrtc:offer", ({ roomId, offer, targetSocketId }) => {
    const cleanRoomId = normalizeRoomId(roomId || socket.currentRoomId);
    if (!cleanRoomId || !offer) return;

    const payload = {
      offer,
      senderSocketId: socket.id,
      senderUser: {
        _id: socket.user?._id,
        name: socket.user?.name,
      },
    };

    if (targetSocketId && io.sockets?.sockets?.has(targetSocketId)) {
      io.to(targetSocketId).emit("webrtc:offer", payload);
    } else {
      socket.to(cleanRoomId).emit("webrtc:offer", payload);
    }
  });

  /**
   * WebRTC Signaling: SDP Answer
   */
  socket.on("webrtc:answer", ({ roomId, answer, targetSocketId }) => {
    const cleanRoomId = normalizeRoomId(roomId || socket.currentRoomId);
    if (!cleanRoomId || !answer) return;

    const payload = {
      answer,
      senderSocketId: socket.id,
    };

    if (targetSocketId && io.sockets?.sockets?.has(targetSocketId)) {
      io.to(targetSocketId).emit("webrtc:answer", payload);
    } else {
      socket.to(cleanRoomId).emit("webrtc:answer", payload);
    }
  });

  /**
   * WebRTC Signaling: ICE Candidate Relay
   */
  socket.on("webrtc:ice-candidate", ({ roomId, candidate, targetSocketId }) => {
    const cleanRoomId = normalizeRoomId(roomId || socket.currentRoomId);
    if (!cleanRoomId || !candidate) return;

    const payload = {
      candidate,
      senderSocketId: socket.id,
    };

    if (targetSocketId && io.sockets?.sockets?.has(targetSocketId)) {
      io.to(targetSocketId).emit("webrtc:ice-candidate", payload);
    } else {
      socket.to(cleanRoomId).emit("webrtc:ice-candidate", payload);
    }
  });

  /**
   * Code Editor: Text Synchronization
   */
  socket.on("room:code-change", ({ roomId, code, version }) => {
    const cleanRoomId = normalizeRoomId(roomId || socket.currentRoomId);
    if (!cleanRoomId) return;
    const room = activeRooms.get(cleanRoomId);
    if (room) {
      room.code = code;
      room.lastActivity = Date.now();
    }

    // Broadcast update to other peer in the room (< 150ms latency)
    socket.to(cleanRoomId).emit("room:code-update", {
      code,
      version: version || Date.now(),
      senderSocketId: socket.id,
    });
  });

  /**
   * Code Editor: Cursor Position Broadcast
   */
  socket.on("room:cursor-change", ({ roomId, cursor }) => {
    const cleanRoomId = normalizeRoomId(roomId || socket.currentRoomId);
    if (!cleanRoomId || !cursor) return;

    socket.to(cleanRoomId).emit("room:cursor-update", {
      cursor,
      user: {
        name: socket.user?.name || "Peer",
      },
      senderSocketId: socket.id,
    });
  });

  /**
   * Code Editor: Language Selection
   */
  socket.on("room:language-change", ({ roomId, language }) => {
    const cleanRoomId = normalizeRoomId(roomId || socket.currentRoomId);
    if (!cleanRoomId || !language) return;
    const room = activeRooms.get(cleanRoomId);
    if (room) {
      room.language = language;
      room.lastActivity = Date.now();
    }

    socket.to(cleanRoomId).emit("room:language-updated", {
      language,
      senderSocketId: socket.id,
    });
  });

  /**
   * Interview Session: Question / Problem Selection
   */
  socket.on("room:problem-change", ({ roomId, problemId, starterCode }) => {
    const cleanRoomId = normalizeRoomId(roomId || socket.currentRoomId);
    if (!cleanRoomId || !problemId) return;
    const room = activeRooms.get(cleanRoomId);
    if (room) {
      room.activeProblemId = problemId;
      if (starterCode) {
        room.code = starterCode;
      }
      room.lastActivity = Date.now();
    }

    // Notify all participants in room of problem change
    io.to(cleanRoomId).emit("room:problem-updated", {
      problemId,
      code: starterCode || room?.code || "",
      senderSocketId: socket.id,
    });
  });

  /**
   * Interview Session: Role Swap (Interviewer <-> Candidate)
   */
  socket.on("room:role-swap", ({ roomId }) => {
    const cleanRoomId = normalizeRoomId(roomId || socket.currentRoomId);
    if (!cleanRoomId) return;
    const room = activeRooms.get(cleanRoomId);
    if (!room) return;

    // Swap roles for all participants
    for (const [sId, p] of room.participants.entries()) {
      p.role = p.role === "candidate" ? "interviewer" : "candidate";
    }

    if (room.timer) {
      room.timer.phase = 2; // Advance to phase 2
    }
    room.lastActivity = Date.now();

    const participantsList = Array.from(room.participants.values()).map(formatParticipant);

    io.to(cleanRoomId).emit("room:role-swapped", {
      participants: participantsList,
      phase: 2,
    });
  });

  /**
   * Media Controls: Audio / Video State Broadcast
   */
  socket.on("room:media-status", ({ roomId, audio, video }) => {
    const cleanRoomId = normalizeRoomId(roomId || socket.currentRoomId);
    if (!cleanRoomId) return;
    const room = activeRooms.get(cleanRoomId);
    if (room && room.participants.has(socket.id)) {
      const p = room.participants.get(socket.id);
      if (typeof audio === "boolean") p.media.audio = audio;
      if (typeof video === "boolean") p.media.video = video;

      socket.to(cleanRoomId).emit("room:peer-media-status", {
        socketId: socket.id,
        media: p.media,
      });
    }
  });

  /**
   * Explicit Leave Room
   */
  socket.on("room:leave", ({ roomId }) => {
    const cleanRoomId = normalizeRoomId(roomId || socket.currentRoomId);
    handleUserLeaveRoom(io, socket, cleanRoomId);
  });
};

/**
 * Handle cleaning up room state when a user leaves or disconnects
 */
export const handleUserLeaveRoom = (io, socket, targetRoomId) => {
  const cleanRoomId = normalizeRoomId(targetRoomId || socket.currentRoomId);
  if (!cleanRoomId) return;

  const room = activeRooms.get(cleanRoomId);
  if (!room) return;

  if (room.participants.has(socket.id)) {
    const leftParticipant = room.participants.get(socket.id);
    room.participants.delete(socket.id);
    socket.leave(cleanRoomId);
    socket.currentRoomId = null;

    console.log(`[Room Left] User ${leftParticipant.user?.name} left ${cleanRoomId}`);

    const remainingParticipants = Array.from(room.participants.values()).map(formatParticipant);

    // Notify other participant
    socket.to(cleanRoomId).emit("room:peer-left", {
      leftSocketId: socket.id,
      leftUserId: leftParticipant.userId,
      remainingParticipants,
    });

    // If room is empty, schedule memory purge
    if (room.participants.size === 0) {
      setTimeout(() => {
        const checkRoom = activeRooms.get(cleanRoomId);
        if (checkRoom && checkRoom.participants.size === 0) {
          activeRooms.delete(cleanRoomId);
          console.log(`[Room Cleaned] ${cleanRoomId} purged from memory`);
        }
      }, 60000); // 1 minute grace period for refresh
    }
  }
};

