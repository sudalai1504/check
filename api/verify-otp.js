import { connectDB } from "./db.js";
import mongoose from "mongoose";

// Schemas
const otpSchema = new mongoose.Schema({
  email: String,
  otp: String,
  username: String,
  password: String
});

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  email: String,
  createdAt: { type: Date, default: Date.now }
});

const Otp = mongoose.models.Otp || mongoose.model("Otp", otpSchema);
const User = mongoose.models.User || mongoose.model("User", userSchema);

export default async function handler(req, res) {
  try {
    await connectDB();

    if (req.method !== "POST") {
      return res.status(405).json({ message: "Only POST allowed ❌" });
    }

    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email & OTP required ❌" });
    }

    const record = await Otp.findOne({ email, otp });

    if (!record) {
      return res.status(400).json({ message: "Invalid OTP ❌" });
    }

    // Save user (without OTP)
    await User.create({
      username: record.username,
      password: record.password,
      email: record.email
    });

    // Delete OTP
    await Otp.deleteMany({ email });

    return res.json({
      success: true,
      message: "Registration Successful ✅"
    });

  } catch (err) {
    console.log("🔥 VERIFY ERROR:", err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}