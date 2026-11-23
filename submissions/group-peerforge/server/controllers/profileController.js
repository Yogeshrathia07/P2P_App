import User from "../models/User.js";

// @desc    Get current user profile
// @route   GET /api/profile
// @access  Private
export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("-passwordHash");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profile: user.profile,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update current user profile
// @route   PUT /api/profile
// @access  Private
export const updateProfile = async (req, res, next) => {
  try {
    const { bio, targetRoles, skills, timeZone, avatarUrl, availability } = req.body;

    // Validation
    if (bio && typeof bio === "string" && bio.length > 300) {
      return res.status(400).json({
        success: false,
        message: "Bio cannot exceed 300 characters",
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Ensure profile subdocument exists
    if (!user.profile) {
      user.profile = {};
    }

    if (typeof bio === "string") {
      user.profile.bio = bio.trim();
    }

    if (typeof avatarUrl === "string") {
      user.profile.avatarUrl = avatarUrl.trim();
    }

    if (Array.isArray(targetRoles)) {
      user.profile.targetRoles = targetRoles.filter(
        (role) => typeof role === "string" && role.trim().length > 0
      );
    }

    if (Array.isArray(skills)) {
      user.profile.skills = skills.filter(
        (skill) => typeof skill === "string" && skill.trim().length > 0
      );
    }

    if (typeof timeZone === "string" && timeZone.trim().length > 0) {
      user.profile.timeZone = timeZone.trim();
    }

    if (availability && typeof availability === "object") {
      if (typeof availability.isSearching === "boolean") {
        user.profile.availability.isSearching = availability.isSearching;
      }
      if (Array.isArray(availability.preferredWindows)) {
        user.profile.availability.preferredWindows = availability.preferredWindows.filter(
          (w) => typeof w === "string" && w.trim().length > 0
        );
      }
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profile: user.profile,
      },
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getProfile,
  updateProfile,
};

