import dotenv from "dotenv";
dotenv.config();

import http from "http";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import feedbackRoutes from "./routes/feedbackRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";
import { setupSocket } from "./socket/index.js";

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

// Dynamic CORS origin handler to support tunnels (localtunnel, ngrok, LAN IPs) & local development
const corsOriginHandler = (origin, callback) => {
  // Allow requests with no origin (mobile apps, curl, server-to-server)
  if (!origin) return callback(null, true);

  // In non-production or tunnel testing, allow common tunnel domains & local LAN
  const isTunnelOrLocal =
    origin === CLIENT_URL ||
    origin.includes("localhost") ||
    origin.includes("127.0.0.1") ||
    origin.endsWith(".vercel.app") ||
    origin.endsWith(".loca.lt") ||
    origin.endsWith(".ngrok-free.app") ||
    origin.endsWith(".ngrok.io") ||
    origin.endsWith(".trycloudflare.com") ||
    /^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin);

  if (isTunnelOrLocal || process.env.NODE_ENV !== "production") {
    return callback(null, true);
  }

  callback(new Error("CORS policy blocked access from this origin."));
};

// Connect to MongoDB
connectDB();

// Core Middlewares
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: corsOriginHandler,
    credentials: true,
  })
);

// Health Check Endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Authentication Routes
app.use("/api/auth", authRoutes);

// Profile & Preferences Routes
app.use("/api/profile", profileRoutes);

// Structured Feedback & Evaluation Routes
app.use("/api/feedback", feedbackRoutes);

// Session History & Analytics Routes
app.use("/api/sessions", sessionRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("[Server Error]", err.stack || err);
  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// Create HTTP Server & Attach Socket.IO
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: corsOriginHandler,
    credentials: true,
  },
});

// Setup Real-time Sockets & Matchmaking
setupSocket(io);

// Start Server if not imported as module in tests
if (process.env.NODE_ENV !== "test") {
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] PeerForge backend & Socket.IO listening on port ${PORT}`);
  });
}

export { app, httpServer, io };
export default app;
