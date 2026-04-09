import express from "express";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config(); // ✅ VERY IMPORTANT

const app = express();
app.use(cors());
app.use(express.json());

// Debug
console.log("MONGO_URL:", process.env.MONGO_URL);

// ================== MongoDB ==================
if (!mongoose.connections[0].readyState) {
  mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log("✅ Mongo Connected"))
    .catch(err => console.log("❌ Mongo Error:", err));
}

// ================== Schema ==================
const otpSchema = new mongoose.Schema({
  email: String,
  otp: String,
  username: String,
  password: String,
  createdAt: { type: Date, default: Date.now, expires: 300 }
});

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  email: String
});

const Otp = mongoose.models.Otp || mongoose.model("Otp", otpSchema);
const User = mongoose.models.User || mongoose.model("User", userSchema);

// ================== Mail ==================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ================== OTP ==================
function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// ================== ROUTES ==================
app.get("/", (req, res) => {
  res.send("Server running ✅");
});

app.post("/send-otp", async (req, res) => {
  try {
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({ message: "All fields required ❌" });
    }

    const otp = generateOTP();

    await Otp.deleteMany({ email });
    await Otp.create({ email, otp, username, password });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "OTP Verification",
      text: `Your OTP is ${otp}`
    });

    res.json({ message: "OTP sent ✅" });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Error sending OTP ❌" });
  }
});

app.post("/verify-otp", async (req, res) => {
  try {
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

    res.json({ message: "Registration Successful ✅" });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error ❌" });
  }
});

// ================== EXPORT ==================
export default app;