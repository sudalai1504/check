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
  email: String
});

const Otp = mongoose.models.Otp || mongoose.model("Otp", otpSchema);
const User = mongoose.models.User || mongoose.model("User", userSchema);

export default async function handler(req, res) {
  try {
    await connectDB();

    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed ❌" });
    }

    const { email, otp } = req.body;

    const record = await Otp.findOne({ email, otp });

    if (!record) {
      return res.status(400).json({ message: "Invalid OTP ❌" });
    }

    await User.create({
      username: record.username,
      password: record.password,
      email: record.email
    });

    await Otp.deleteMany({ email });

    return res.json({ message: "Registration Successful ✅" });

  } catch (err) {
    console.log("🔥 VERIFY ERROR:", err);
    return res.status(500).json({ message: err.message });
  }
}