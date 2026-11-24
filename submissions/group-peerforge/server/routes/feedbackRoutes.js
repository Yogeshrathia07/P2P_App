import express from "express";
import {
  initSession,
  submitFeedback,
  getSessionFeedback,
} from "../controllers/feedbackController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// All feedback endpoints require active user authentication
router.use(auth);

router.post("/session/init", initSession);
router.post("/submit", submitFeedback);
router.get("/session/:roomId", getSessionFeedback);

export default router;

