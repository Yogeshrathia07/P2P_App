import mongoose from "mongoose";

const FeedbackSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      index: true,
    },
    roomId: {
      type: String,
      required: true,
      index: true,
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    scores: {
      codeCorrectness: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
      },
      problemSolving: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
      },
      communication: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
      },
      architecture: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
      },
    },
    strengths: {
      type: String,
      required: [true, "Key strengths feedback is required"],
      minlength: [20, "Strengths must be at least 20 characters"],
      trim: true,
    },
    improvements: {
      type: String,
      required: [true, "Actionable improvements feedback is required"],
      minlength: [20, "Improvements must be at least 20 characters"],
      trim: true,
    },
    privateNotes: {
      type: String,
      default: "",
      trim: true,
    },
    isRevealed: {
      type: Boolean,
      default: false,
      index: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Enforce single review per reviewer per room
FeedbackSchema.index({ roomId: 1, reviewer: 1 }, { unique: true });

const Feedback = mongoose.model("Feedback", FeedbackSchema);
export default Feedback;

