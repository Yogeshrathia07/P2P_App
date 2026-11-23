import express from "express";
import { getProfile, updateProfile } from "../controllers/profileController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// All profile endpoints are private and protected by JWT auth
router.use(auth);

router.get("/", getProfile);
router.put("/", updateProfile);

export default router;

