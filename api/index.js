import express from "express";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import authMiddleware from "../middleware/auth.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// ─── MongoDB Connect (cached for serverless) ───────────────────────────────────
let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;
  try {
    await mongoose.connect(process.env.MONGO_URL);
    isConnected = true;
    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error("❌ MongoDB error:", err.message);
    throw err;
  }
};

// ─── Nodemailer Setup ──────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ─── OTP Store (in-memory) ─────────────────────────────────────────────────────
const otpStore = {};

// ─── Helpers ───────────────────────────────────────────────────────────────────
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const isOTPValid = (email, otp) => {
  const record = otpStore[email];
  if (!record) return false;
  if (Date.now() > record.expiresAt) {
    delete otpStore[email];
    return false;
  }
  return record.otp === otp;
};

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// ─── Middleware: Connect DB on every request ───────────────────────────────────
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch {
    res.status(500).json({ message: "Database connection failed" });
  }
});

// ─── Routes ────────────────────────────────────────────────────────────────────

// Health Check
app.get("/", (req, res) => {
  res.json({ message: "🔥 Server Running", status: "ok" });
});

// ─── Send OTP ──────────────────────────────────────────────────────────────────
app.post("/send-otp", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(409).json({ message: "Email already registered" });
  }

  const otp = generateOTP();

  otpStore[email] = {
    otp,
    expiresAt: Date.now() + 2 * 60 * 1000,
  };

  setTimeout(() => {
    delete otpStore[email];
  }, 2 * 60 * 1000);

  try {
    await transporter.sendMail({
      from: `"Verify Email" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your OTP Code",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px;">
          <h2 style="color:#1a202c;margin-bottom:8px;">Email Verification</h2>
          <p style="color:#4a5568;">Use this OTP to verify your email. Expires in <strong>2 minutes</strong>.</p>
          <div style="font-size:36px;font-weight:bold;letter-spacing:10px;color:#3182ce;margin:28px 0;padding:16px;background:#ebf8ff;border-radius:8px;text-align:center;">
            ${otp}
          </div>
          <p style="color:#a0aec0;font-size:12px;">If you didn't request this, ignore this email.</p>
        </div>
      `,
    });

    res.json({ message: "OTP sent successfully ✅" });
  } catch (err) {
    console.error("❌ Mail error:", err.message);
    delete otpStore[email];
    res.status(500).json({ message: "Failed to send OTP. Try again." });
  }
});

// ─── Verify OTP + Register ─────────────────────────────────────────────────────
app.post("/verify-otp", async (req, res) => {
  const { username, email, password, otp } = req.body;

  if (!username || !email || !password || !otp) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (password.length < 6) {
    return res
      .status(400)
      .json({ message: "Password must be at least 6 characters" });
  }

  if (!isOTPValid(email, otp)) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      username,
      email,
      password: hashedPassword,
      verified: true,
    });

    await user.save();
    delete otpStore[email];

    // Auto-login after register → return token
    const token = generateToken(user);

    res.status(201).json({
      message: "User registered successfully 🎉",
      token,
      user: {
        username: user.username,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("❌ Register error:", err.message);
    res.status(500).json({ message: "Registration failed. Try again." });
  }
});

// ─── Login ─────────────────────────────────────────────────────────────────────
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.verified) {
      return res.status(403).json({ message: "Email not verified" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // Generate JWT token
    const token = generateToken(user);

    res.json({
      message: "Login successful ✅",
      token,
      user: {
        username: user.username,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("❌ Login error:", err.message);
    res.status(500).json({ message: "Login failed. Try again." });
  }
});

// ─── GET Profile ───────────────────────────────────────────────────────────────
// GET /profile
// Header: Authorization: Bearer <token>
app.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: "Profile fetched successfully ✅",
      profile: {
        username: user.username,
        email: user.email,
        contactNumber: user.contactNumber,
        bloodGroup: user.bloodGroup,
        address: user.address,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error("❌ Profile fetch error:", err.message);
    res.status(500).json({ message: "Failed to fetch profile." });
  }
});

// ─── UPDATE Profile ────────────────────────────────────────────────────────────
// PUT /profile
// Header: Authorization: Bearer <token>
// Body: { username, contactNumber, bloodGroup, address }
app.put("/profile", authMiddleware, async (req, res) => {
  const { username, contactNumber, bloodGroup, address } = req.body;

  // Validate contactNumber if provided
  if (contactNumber) {
    const phoneRegex = /^[6-9]\d{9}$/; // Indian mobile number format
    if (!phoneRegex.test(contactNumber)) {
      return res.status(400).json({ message: "Invalid contact number. Enter a valid 10-digit Indian mobile number." });
    }
  }

  // Validate bloodGroup if provided
  const validBloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
  if (bloodGroup && !validBloodGroups.includes(bloodGroup)) {
    return res.status(400).json({ message: "Invalid blood group." });
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      {
        ...(username && { username }),
        ...(contactNumber !== undefined && { contactNumber }),
        ...(bloodGroup !== undefined && { bloodGroup }),
        ...(address !== undefined && { address }),
      },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: "Profile updated successfully ✅",
      profile: {
        username: updatedUser.username,
        email: updatedUser.email,
        contactNumber: updatedUser.contactNumber,
        bloodGroup: updatedUser.bloodGroup,
        address: updatedUser.address,
        updatedAt: updatedUser.updatedAt,
      },
    });
  } catch (err) {
    console.error("❌ Profile update error:", err.message);
    res.status(500).json({ message: "Failed to update profile." });
  }
});

// ─── Local Dev Server ──────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () =>
    console.log(`🚀 Server at http://localhost:${PORT}`)
  );
}

// ─── Vercel Serverless Export ──────────────────────────────────────────────────
export default app;