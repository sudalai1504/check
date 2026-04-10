import mongoose from "mongoose";
import nodemailer from "nodemailer";

// Mongo connect
if (!mongoose.connections[0].readyState) {
  mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log("Mongo Connected"))
    .catch(err => console.log(err));
}

// Schema
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

// Mail
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// OTP
function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// ================= SERVERLESS HANDLER =================
export default async function handler(req, res) {

  // 🔥 TEST ROUTE
  if (req.method === "GET") {
    return res.status(200).json({ message: "API working ✅" });
  }

  // ================= SEND OTP =================
  if (req.method === "POST" && req.url.includes("send-otp")) {
    const { email, username, password } = req.body;

    const otp = generateOTP();

    await Otp.deleteMany({ email });
    await Otp.create({ email, otp, username, password });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "OTP",
      text: `Your OTP is ${otp}`
    });

    return res.json({ message: "OTP sent ✅" });
  }

  // ================= VERIFY OTP =================
  if (req.method === "POST" && req.url.includes("verify-otp")) {
    const { email, otp } = req.body;

    const record = await Otp.findOne({ email, otp });

    if (!record) {
      return res.status(400).json({ message: "Invalid OTP ❌" });
    }

    await User.create(record);
    await Otp.deleteMany({ email });

    return res.json({ message: "Registration Successful ✅" });
  }

  return res.status(404).json({ message: "Not Found ❌" });
}