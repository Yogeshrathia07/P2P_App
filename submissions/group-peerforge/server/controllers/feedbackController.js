import Session from "../models/Session.js";
import Feedback from "../models/Feedback.js";
import { notifyFeedbackUnlocked, notifyPartnerSubmitted } from "../socket/roomSignaling.js";

/**
 * Initialize or join an interview session record
 */
export const initSession = async (req, res) => {
  try {
    const { roomId, track, difficulty, role } = req.body;
    if (!roomId) {
      return res.status(400).json({ error: "Room ID is required" });
    }

    let session = await Session.findOne({ roomId });
    if (!session) {
      session = new Session({
        roomId,
        track: track || "Data Structures & Algorithms (DSA)",
        difficulty: difficulty || "Mid-Level",
        participants: [
          {
            user: req.user._id,
            role: role || "candidate",
          },
        ],
      });
      await session.save();
    } else {
      const alreadyParticipant = session.participants.some(
        (p) => p.user.toString() === req.user._id.toString()
      );
      if (!alreadyParticipant) {
        session.participants.push({
          user: req.user._id,
          role: role || (session.participants[0]?.role === "candidate" ? "interviewer" : "candidate"),
        });
        await session.save();
      }
    }

    return res.status(200).json({ success: true, session });
  } catch (err) {
    console.error("[initSession Error]", err);
    return res.status(500).json({ error: "Failed to initialize session" });
  }
};

/**
 * Submit peer feedback and check for symmetric blind unlock
 */
export const submitFeedback = async (req, res) => {
  try {
    const { roomId, candidateId, scores, strengths, improvements, privateNotes } = req.body;

    if (!roomId || !candidateId) {
      return res.status(400).json({ error: "Room ID and Candidate ID are required" });
    }

    if (req.user._id.toString() === candidateId.toString()) {
      return res.status(400).json({ error: "You cannot submit feedback for yourself" });
    }

    // Validate Rubric Scores (1 - 5)
    if (!scores) {
      return res.status(400).json({ error: "Rubric evaluation scores are required" });
    }

    const { codeCorrectness, problemSolving, communication, architecture } = scores;
    const allScores = [codeCorrectness, problemSolving, communication, architecture];

    if (allScores.some((s) => typeof s !== "number" || s < 1 || s > 5)) {
      return res.status(400).json({
        error: "All 4 competency scores must be numeric values between 1 and 5",
      });
    }

    // Validate Qualitative Feedback Length (min 20 characters)
    if (!strengths || strengths.trim().length < 20) {
      return res.status(400).json({
        error: "Key Strengths feedback must be at least 20 characters",
      });
    }

    if (!improvements || improvements.trim().length < 20) {
      return res.status(400).json({
        error: "Actionable Improvements feedback must be at least 20 characters",
      });
    }

    // Find active session
    let session = await Session.findOne({ roomId });
    if (!session) {
      session = new Session({
        roomId,
        participants: [
          { user: req.user._id, role: "interviewer" },
          { user: candidateId, role: "candidate" },
        ],
      });
      await session.save();
    }

    // Upsert Feedback document for this reviewer in this room
    const feedback = await Feedback.findOneAndUpdate(
      { roomId, reviewer: req.user._id },
      {
        sessionId: session._id,
        roomId,
        reviewer: req.user._id,
        candidate: candidateId,
        scores: {
          codeCorrectness,
          problemSolving,
          communication,
          architecture,
        },
        strengths: strengths.trim(),
        improvements: improvements.trim(),
        privateNotes: (privateNotes || "").trim(),
        submittedAt: new Date(),
      },
      { upsert: true, new: true, runValidators: true }
    );

    // Symmetric Blind Reveal Evaluation: Check total feedbacks in this room
    const allFeedbacks = await Feedback.find({ roomId });

    if (allFeedbacks.length >= 2) {
      // Both peers have submitted: unlock feedback!
      await Feedback.updateMany({ roomId }, { $set: { isRevealed: true } });
      await Session.findOneAndUpdate(
        { roomId },
        { status: "completed", endedAt: new Date() }
      );

      // Real-time broadcast unlock event
      notifyFeedbackUnlocked(roomId);

      return res.status(200).json({
        success: true,
        isRevealed: true,
        message: "Both reviews submitted. Evaluation scorecard is now unlocked!",
      });
    } else {
      // Only 1 review submitted so far: notify partner that reviewer finished
      notifyPartnerSubmitted(roomId, req.user._id.toString());

      return res.status(200).json({
        success: true,
        isRevealed: false,
        message: "Your evaluation has been submitted. Waiting for your peer to complete theirs.",
      });
    }
  } catch (err) {
    console.error("[submitFeedback Error]", err);
    return res.status(500).json({ error: err.message || "Failed to submit feedback" });
  }
};

/**
 * Retrieve feedback for a session with blind protection guard
 */
export const getSessionFeedback = async (req, res) => {
  try {
    const { roomId } = req.params;
    if (!roomId) {
      return res.status(400).json({ error: "Room ID is required" });
    }

    const feedbacks = await Feedback.find({ roomId })
      .populate("reviewer", "name email profile.avatarUrl")
      .populate("candidate", "name email profile.avatarUrl");

    const currentUserId = req.user._id.toString();

    const mySubmittedFeedback = feedbacks.find(
      (f) => f.reviewer._id.toString() === currentUserId
    );
    const partnerSubmittedFeedback = feedbacks.find(
      (f) => f.reviewer._id.toString() !== currentUserId
    );

    // If either hasn't submitted and feedback is not revealed, enforce blind guard
    const isRevealed = feedbacks.length >= 2 && feedbacks.every((f) => f.isRevealed);

    if (!isRevealed) {
      return res.status(200).json({
        isRevealed: false,
        myFeedbackSubmitted: !!mySubmittedFeedback,
        partnerSubmitted: !!partnerSubmittedFeedback,
      });
    }

    // Feedback is fully unlocked: return received and given scorecards
    const receivedFeedback = feedbacks.find(
      (f) => f.candidate._id.toString() === currentUserId
    );
    const givenFeedback = feedbacks.find(
      (f) => f.reviewer._id.toString() === currentUserId
    );

    // Calculate composite average score for received feedback
    let compositeScore = 0;
    if (receivedFeedback?.scores) {
      const s = receivedFeedback.scores;
      compositeScore = Number(
        ((s.codeCorrectness + s.problemSolving + s.communication + s.architecture) / 4).toFixed(1)
      );
    }

    return res.status(200).json({
      isRevealed: true,
      myFeedbackSubmitted: true,
      partnerSubmitted: true,
      compositeScore,
      receivedFeedback,
      givenFeedback,
    });
  } catch (err) {
    console.error("[getSessionFeedback Error]", err);
    return res.status(500).json({ error: "Failed to load session feedback" });
  }
};

