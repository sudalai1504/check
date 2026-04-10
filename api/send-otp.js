import { connectDB } from "./db.js";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import bcrypt from "bcryptjs";

// Schema
const otpSchema = new mongoose.Schema({
  email: String,
  otp: String,
  username: String,
  password: String,
  createdAt: { type: Date, default: Date.now, expires: 300 }
});

const Otp = mongoose.models.Otp || mongoose.model("Otp", otpSchema);

// OTP generate
function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export default async function handler(req, res) {
  try {
    await connectDB();

    if (req.method !== "POST") {
      return res.status(405).json({ message: "Only POST allowed ❌" });
    }

    const { email, username, password } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({ message: "All fields required ❌" });
    }

    // 🔐 Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const otp = generateOTP();

    await Otp.deleteMany({ email });

    await Otp.create({
      email,
      otp,
      username,
      password: hashedPassword
    });

    // Mail config
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "OTP Verification",
      text: `Your OTP is ${otp}`
    });

    return res.status(200).json({
      success: true,
      message: "OTP sent ✅"
    });

  } catch (err) {
    console.log("🔥 ERROR:", err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}