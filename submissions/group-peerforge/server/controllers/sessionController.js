import Session from "../models/Session.js";
import Feedback from "../models/Feedback.js";

/**
 * GET /api/sessions/history
 * Returns the authenticated user's past sessions with associated feedback and peer details.
 */
export const getSessionHistory = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find sessions where the user was a participant
    const sessions = await Session.find({
      "participants.user": userId,
    })
      .populate("participants.user", "name email profile")
      .sort({ createdAt: -1 })
      .lean();

    // Attach feedback for each session
    const enrichedSessions = await Promise.all(
      sessions.map(async (session) => {
        // Find peer participant
        const peer = session.participants.find(
          (p) => p.user && p.user._id.toString() !== userId.toString()
        );

        // Find feedback received by current user in this session
        const receivedFeedback = await Feedback.findOne({
          roomId: session.roomId,
          candidate: userId,
        }).lean();

        // Find feedback given by current user in this session
        const givenFeedback = await Feedback.findOne({
          roomId: session.roomId,
          reviewer: userId,
        }).lean();

        let feedbackData = null;

        if (receivedFeedback) {
          if (receivedFeedback.isRevealed) {
            // Safe to disclose full scores and qualitative review
            feedbackData = {
              isRevealed: true,
              scores: receivedFeedback.scores,
              strengths: receivedFeedback.strengths,
              improvements: receivedFeedback.improvements,
              privateNotes: receivedFeedback.privateNotes,
              compositeScore: Number(
                (
                  (receivedFeedback.scores.codeCorrectness +
                    receivedFeedback.scores.problemSolving +
                    receivedFeedback.scores.communication +
                    receivedFeedback.scores.architecture) /
                  4
                ).toFixed(1)
              ),
              submittedAt: receivedFeedback.submittedAt,
            };
          } else {
            // Guard unrevealed state (FEED-02)
            feedbackData = {
              isRevealed: false,
              myFeedbackSubmitted: Boolean(givenFeedback),
              partnerSubmitted: Boolean(receivedFeedback),
            };
          }
        }

        return {
          ...session,
          peer: peer
            ? {
                id: peer.user._id,
                name: peer.user.name,
                email: peer.user.email,
                avatarUrl: peer.user.profile?.avatarUrl,
                skills: peer.user.profile?.skills || [],
                targetRoles: peer.user.profile?.targetRoles || [],
                roleInSession: peer.role,
              }
            : null,
          myRole:
            session.participants.find(
              (p) => p.user && p.user._id.toString() === userId.toString()
            )?.role || "candidate",
          feedback: feedbackData,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: enrichedSessions.length,
      sessions: enrichedSessions,
    });
  } catch (error) {
    console.error("Error fetching session history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch session history",
      error: error.message,
    });
  }
};

/**
 * GET /api/sessions/analytics
 * Computes aggregated competency ratings and overall statistics for the candidate.
 */
export const getUserAnalytics = async (req, res) => {
  try {
    const userId = req.user._id;

    // Fetch all revealed feedbacks for this candidate
    const feedbacks = await Feedback.find({
      candidate: userId,
      isRevealed: true,
    }).lean();

    if (!feedbacks || feedbacks.length === 0) {
      return res.status(200).json({
        success: true,
        analytics: {
          totalSessions: 0,
          overallAverage: 0,
          competencies: {
            codeCorrectness: 0,
            problemSolving: 0,
            communication: 0,
            architecture: 0,
          },
        },
      });
    }

    const totals = feedbacks.reduce(
      (acc, fb) => {
        acc.codeCorrectness += fb.scores?.codeCorrectness || 0;
        acc.problemSolving += fb.scores?.problemSolving || 0;
        acc.communication += fb.scores?.communication || 0;
        acc.architecture += fb.scores?.architecture || 0;
        return acc;
      },
      { codeCorrectness: 0, problemSolving: 0, communication: 0, architecture: 0 }
    );

    const count = feedbacks.length;
    const codeCorrectness = Number((totals.codeCorrectness / count).toFixed(1));
    const problemSolving = Number((totals.problemSolving / count).toFixed(1));
    const communication = Number((totals.communication / count).toFixed(1));
    const architecture = Number((totals.architecture / count).toFixed(1));

    const overallAverage = Number(
      ((codeCorrectness + problemSolving + communication + architecture) / 4).toFixed(1)
    );

    res.status(200).json({
      success: true,
      analytics: {
        totalSessions: count,
        overallAverage,
        competencies: {
          codeCorrectness,
          problemSolving,
          communication,
          architecture,
        },
      },
    });
  } catch (error) {
    console.error("Error computing user analytics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to compute analytics",
      error: error.message,
    });
  }
};

/**
 * GET /api/sessions/upcoming
 * Returns upcoming or active sessions for the user.
 */
export const getUpcomingSessions = async (req, res) => {
  try {
    const userId = req.user._id;

    const upcoming = await Session.find({
      "participants.user": userId,
      status: "active",
    })
      .populate("participants.user", "name email profile")
      .sort({ startedAt: -1 })
      .limit(5)
      .lean();

    const formatted = upcoming.map((session) => {
      const peer = session.participants.find(
        (p) => p.user && p.user._id.toString() !== userId.toString()
      );
      return {
        ...session,
        peer: peer
          ? {
              id: peer.user._id,
              name: peer.user.name,
              email: peer.user.email,
              avatarUrl: peer.user.profile?.avatarUrl,
            }
          : null,
      };
    });

    res.status(200).json({
      success: true,
      count: formatted.length,
      upcoming: formatted,
    });
  } catch (error) {
    console.error("Error fetching upcoming sessions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch upcoming sessions",
      error: error.message,
    });
  }
};
