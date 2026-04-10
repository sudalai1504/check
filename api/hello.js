import mongoose from "mongoose";
import nodemailer from "nodemailer";
import bcrypt from "bcryptjs";

// ================= DB CONNECT =================
let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  try {
    const conn = await mongoose.connect(process.env.MONGO_URL);
    isConnected = conn.connections[0].readyState;
    console.log("✅ Mongo Connected");
  } catch (err) {
    console.log("❌ DB Error:", err);
    throw err;
  }
}

// ================= SCHEMA =================
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
  email: String,
  createdAt: { type: Date, default: Date.now }
});

const Otp = mongoose.models.Otp || mongoose.model("Otp", otpSchema);
const User = mongoose.models.User || mongoose.model("User", userSchema);

// ================= MAIL =================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ================= OTP =================
function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// ================= HANDLER =================
export default async function handler(req, res) {
  try {
    await connectDB();

    const { action } = req.query;

    // 🔥 TEST
    if (req.method === "GET") {
      return res.status(200).json({ message: "API working ✅" });
    }

    // ================= SEND OTP =================
    if (req.method === "POST" && action === "send-otp") {
      const { email, username, password } = req.body;

      if (!email || !username || !password) {
        return res.status(400).json({ message: "All fields required ❌" });
      }

      // 🔐 hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      const otp = generateOTP();

      await Otp.deleteMany({ email });

      await Otp.create({
        email,
        otp,
        username,
        password: hashedPassword
      });

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "OTP Verification",
        text: `Your OTP is ${otp}`
      });

      return res.json({ message: "OTP sent ✅" });
    }

    // ================= VERIFY OTP =================
    if (req.method === "POST" && action === "verify-otp") {
      const { email, otp } = req.body;

      if (!email || !otp) {
        return res.status(400).json({ message: "Email & OTP required ❌" });
      }

      const record = await Otp.findOne({ email, otp });

      if (!record) {
        return res.status(400).json({ message: "Invalid OTP ❌" });
      }

      // save user (without OTP)
      await User.create({
        username: record.username,
        password: record.password,
        email: record.email
      });

      await Otp.deleteMany({ email });

      return res.json({ message: "Registration Successful ✅" });
    }

    return res.status(404).json({ message: "Invalid route ❌" });

  } catch (err) {
    console.log("🔥 ERROR:", err);
    return res.status(500).json({ message: err.message });
  }
}