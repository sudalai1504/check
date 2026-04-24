import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    // ─── Profile Fields ───────────────────────────────────────────────────────
    contactNumber: {
      type: String,
      default: "",
      trim: true,
    },
    bloodGroup: {
      type: String,
      default: "",
      enum: ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", userSchema);