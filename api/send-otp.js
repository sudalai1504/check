import mongoose from "mongoose";
import nodemailer from "nodemailer";

// ================= DB CONNECT =================
let isConnected = false;

async function connectDB() {
  try {
    if (isConnected) return;

    const db = await mongoose.connect(process.env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    isConnected = db.connections[0].readyState;
    console.log("✅ MongoDB Atlas Connected");

  } catch (err) {
    console.log("❌ Mongo Error:", err);
    throw new Error("MongoDB connection failed");
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

const Otp = mongoose.models.Otp || mongoose.model("Otp", otpSchema);

// ================= OTP =================
function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// ================= HANDLER =================
export default async function handler(req, res) {

  try {
    await connectDB();

    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed ❌" });
    }

    const { email, username, password } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({ message: "All fields required ❌" });
    }

    const otp = generateOTP();

    await Otp.deleteMany({ email });
    await Otp.create({ email, otp, username, password });

    // ================= MAIL =================
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

    return res.status(200).json({ message: "OTP sent ✅" });

  } catch (err) {
    console.log("🔥 FULL ERROR:", err);

    return res.status(500).json({
      message: err.message || "Server error ❌"
    });
  }
}