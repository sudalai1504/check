import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ================== MongoDB ==================
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ MongoDB Error:", err));

// ================== Schema ==================
const userSchema = new mongoose.Schema({
  email: { type: String, required: true },
  username: String,
  password: String,
  otp: String,
  otpExpiry: Date
});

const User = mongoose.model("User", userSchema);

// ================== Mail Setup ==================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ================== Generate OTP ==================
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ================== SEND OTP ==================
app.post("/send-otp", async (req, res) => {
  try {
    const { email, username, password } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    const otp = generateOTP();
    const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    let user = await User.findOne({ email });

    if (user) {
      // update existing user
      user.otp = otp;
      user.otpExpiry = expiry;
      user.username = username;
      user.password = password;
    } else {
      // create new user
      user = new User({
        email,
        username,
        password,
        otp,
        otpExpiry: expiry
      });
    }

    await user.save();

    // Send Mail
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "OTP Verification",
      text: `Your OTP is: ${otp} (valid for 5 minutes)`
    });

    res.json({ message: "✅ OTP Sent Successfully" });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "❌ Error sending OTP" });
  }
});

// ================== VERIFY OTP ==================
app.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP ❌" });
    }

    if (user.otpExpiry < new Date()) {
      return res.status(400).json({ message: "OTP Expired ⏰" });
    }

    // OTP correct → clear OTP
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    res.json({ message: "✅ OTP Verified Successfully" });

  } catch (err) {
    res.status(500).json({ message: "❌ Error verifying OTP" });
  }
});

// ================== TEST ROUTE ==================
app.get("/", (req, res) => {
  res.send("🔥 OTP Server Running");
});

// ================== START SERVER ==================
app.listen(process.env.PORT, () => {
  console.log(`🚀 Server running on http://localhost:${process.env.PORT}`);
});