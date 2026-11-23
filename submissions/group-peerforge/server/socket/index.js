import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import {
  addToQueue,
  removeFromQueue,
  handleAccept,
  handleDecline,
  cleanupSocketMatches,
} from "../services/matchmakingService.js";
import { registerRoomHandlers, handleUserLeaveRoom, activeRooms, formatParticipant } from "./roomSignaling.js";

// Helper to parse cookie string from handshake headers
const parseCookie = (cookieHeader) => {
  const cookies = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    const name = parts[0]?.trim();
    const value = parts.slice(1).join("=").trim();
    if (name) {
      cookies[name] = decodeURIComponent(value);
    }
  });

  return cookies;
};

export const setupSocket = (io) => {
  // Socket.IO Authentication Middleware (supports cookies, auth payload, headers & fallback)
  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers?.cookie;
      const cookies = parseCookie(cookieHeader);
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace("Bearer ", "") ||
        cookies.auth_token ||
        socket.handshake.query?.token;

      // 1. Verify via JWT token if present
      if (token) {
        try {
          const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || "peerforge_development_secret_key_123456789"
          );
          if (decoded && decoded.id && mongoose.Types.ObjectId.isValid(decoded.id)) {
            const dbUser = await User.findById(decoded.id).select("-passwordHash");
            if (dbUser) {
              socket.user = dbUser;
              return next();
            }
          }
        } catch (jwtErr) {
          console.warn("[Socket JWT Verify Notice]", jwtErr.message);
        }
      }

      // 2. Fallback: Authenticate via auth payload user if tunnel/proxy stripped cookies
      const authUser = socket.handshake.auth?.user;
      if (authUser && (authUser._id || authUser.id)) {
        const rawId = authUser._id || authUser.id;
        let dbUser = null;
        if (mongoose.Types.ObjectId.isValid(rawId)) {
          try {
            dbUser = await User.findById(rawId).select("-passwordHash");
          } catch (e) {
            console.warn("[Socket User DB lookup error]", e.message);
          }
        }
        socket.user = dbUser || {
          _id: rawId,
          name: authUser.name || "Developer",
          email: authUser.email || "",
          profile: authUser.profile || {},
        };
        return next();
      }

      // 3. Fallback in development / local testing: ensure sockets never get locked out
      if (process.env.NODE_ENV !== "production") {
        socket.user = {
          _id: `dev_${socket.id.substring(0, 8)}`,
          name: authUser?.name || "Developer",
          profile: {},
        };
        return next();
      }

      return next(new Error("Authentication error: No auth token or session provided"));
    } catch (err) {
      console.error("[Socket Auth Error]", err.message);
      return next(new Error("Authentication error: Invalid session"));
    }
  });

  // Socket Connection Handling
  io.on("connection", (socket) => {
    console.log(`[Socket Connected] User: ${socket.user?.name || "Developer"} (${socket.id})`);

    // Handle post-connect authentication credential update
    socket.on("user:authenticate", (authPayload) => {
      if (authPayload?.user) {
        const u = authPayload.user;
        const newUserId = u._id || u.id || socket.user?._id;
        socket.user = {
          ...socket.user,
          _id: newUserId,
          name: u.name || socket.user?.name || "Developer",
          email: u.email || socket.user?.email || "",
          profile: u.profile || socket.user?.profile || {},
        };

        // If socket is currently in an active room, update participant and notify peers
        if (socket.currentRoomId) {
          const room = activeRooms.get(socket.currentRoomId);
          if (room && room.participants.has(socket.id)) {
            const p = room.participants.get(socket.id);
            p.user = socket.user;
            p.userId = (newUserId || socket.id).toString();
            const participantsList = Array.from(room.participants.values()).map(formatParticipant);
            io.to(socket.currentRoomId).emit("room:participants-updated", {
              participants: participantsList,
            });
          }
        }
      }
    });

    // Join Matchmaking Queue
    socket.on("queue:join", ({ track, difficulty }) => {
      const pendingMatch = addToQueue({
        socketId: socket.id,
        userId: socket.user._id,
        userDetails: socket.user,
        track: track || "Data Structures & Algorithms (DSA)",
        difficulty: difficulty || "Mid-Level",
      });

      if (pendingMatch) {
        // Emit match:found to both peers
        io.to(pendingMatch.userA.socketId).emit("match:found", {
          matchId: pendingMatch.matchId,
          track: pendingMatch.track,
          difficulty: pendingMatch.difficulty,
          peerDetails: pendingMatch.userB.userDetails,
          expiresAt: pendingMatch.expiresAt,
        });

        io.to(pendingMatch.userB.socketId).emit("match:found", {
          matchId: pendingMatch.matchId,
          track: pendingMatch.track,
          difficulty: pendingMatch.difficulty,
          peerDetails: pendingMatch.userA.userDetails,
          expiresAt: pendingMatch.expiresAt,
        });
      }
    });

    // Leave Matchmaking Queue
    socket.on("queue:leave", () => {
      removeFromQueue(socket.id);
      socket.emit("queue:left");
    });

    // Accept Match Handshake
    socket.on("match:accept", ({ matchId }) => {
      const result = handleAccept({ matchId, userId: socket.user._id });
      if (!result) return;

      if (result.confirmed) {
        const { roomId, match } = result;

        io.to(match.userA.socketId).emit("match:confirmed", {
          roomId,
          track: match.track,
          difficulty: match.difficulty,
          peer: match.userB.userDetails,
        });

        io.to(match.userB.socketId).emit("match:confirmed", {
          roomId,
          track: match.track,
          difficulty: match.difficulty,
          peer: match.userA.userDetails,
        });
      } else {
        // Notify socket that their acceptance was registered
        socket.emit("match:accepted_waiting");
      }
    });

    // Decline Match Handshake
    socket.on("match:decline", ({ matchId }) => {
      const result = handleDecline({ matchId, userId: socket.user._id });
      if (!result) return;

      socket.emit("match:cancelled", { reason: "declined_by_you" });

      if (result.reQueuedUser) {
        io.to(result.reQueuedUser.socketId).emit("match:cancelled", {
          reason: "partner_declined",
          reQueued: true,
        });
      }
    });

    // Generate Direct Shareable Room Code & Invite Link
    socket.on("invite:create", ({ track, difficulty }, callback) => {
      // Clean, memorable 6-character code (e.g. PF-8921 or PF-7K2M9X)
      // Uses unambiguous characters (avoids 0, O, 1, I)
      const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
      let codeSuffix = "";
      for (let i = 0; i < 6; i++) {
        codeSuffix += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
      }
      const roomCode = `PF-${codeSuffix}`;
      const roomId = roomCode;

      const response = {
        success: true,
        roomCode,
        inviteCode: roomCode,
        roomId,
        track,
        difficulty,
      };

      if (typeof callback === "function") {
        callback(response);
      } else {
        socket.emit("invite:created", response);
      }
    });

    // Register Live Room & WebRTC Signaling Handlers
    registerRoomHandlers(io, socket);

    // Handle Disconnect
    socket.on("disconnect", () => {
      console.log(`[Socket Disconnected] User: ${socket.user.name} (${socket.id})`);
      removeFromQueue(socket.id);
      cleanupSocketMatches(socket.id);
      handleUserLeaveRoom(io, socket);
    });
  });
};

export default setupSocket;

