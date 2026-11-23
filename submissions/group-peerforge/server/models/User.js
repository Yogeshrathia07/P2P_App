import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const profileSchema = new mongoose.Schema(
  {
    avatarUrl: {
      type: String,
      trim: true,
      default: "",
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [300, "Bio cannot exceed 300 characters"],
      default: "",
    },
    targetRoles: {
      type: [String],
      default: [],
    },
    skills: {
      type: [String],
      default: [],
    },
    timeZone: {
      type: String,
      default: "UTC",
    },
    availability: {
      isSearching: {
        type: Boolean,
        default: true,
      },
      preferredWindows: {
        type: [String],
        default: ["Weekday Evenings", "Weekends"],
      },
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/,
        "Please provide a valid email address",
      ],
    },
    passwordHash: {
      type: String,
      required: [true, "Password hash is required"],
    },
    profile: {
      type: profileSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

// Method to compare candidate password with passwordHash
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Static helper to hash passwords
userSchema.statics.hashPassword = async function (plainPassword) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
};

export const User = mongoose.model("User", userSchema);
export default User;

