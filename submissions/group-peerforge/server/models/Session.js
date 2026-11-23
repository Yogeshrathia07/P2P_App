import mongoose from "mongoose";

const SessionSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    track: {
      type: String,
      default: "Data Structures & Algorithms (DSA)",
    },
    difficulty: {
      type: String,
      default: "Mid-Level",
    },
    participants: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        role: {
          type: String,
          enum: ["candidate", "interviewer"],
          default: "candidate",
        },
      },
    ],
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["active", "completed", "abandoned"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

const Session = mongoose.model("Session", SessionSchema);
export default Session;

