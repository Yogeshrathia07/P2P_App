import express from "express";
import {
  getSessionHistory,
  getUserAnalytics,
  getUpcomingSessions,
} from "../controllers/sessionController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// All session history and analytics require authenticated user
router.use(auth);

router.get("/history", getSessionHistory);
router.get("/analytics", getUserAnalytics);
router.get("/upcoming", getUpcomingSessions);

export default router;
