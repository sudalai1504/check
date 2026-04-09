import mongoose from "mongoose";
import nodemailer from "nodemailer";

let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  const db = await mongoose.connect(process.env.MONGO_URL);
  isConnected = db.connections[0].readyState;
}

// Schema
const otpSchema = new mongoose.Schema({
  email: String,
  otp: String,
  username: String,
  password: String,
  createdAt: { type: Date, default: Date.now, expires: 300 }
});

const Otp = mongoose.models.Otp || mongoose.model("Otp", otpSchema);

function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export default async function handler(req, res) {

  try {
    await connectDB();

    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    const { email, username, password } = req.body;

    const otp = generateOTP();

    await Otp.deleteMany({ email });
    await Otp.create({ email, otp, username, password });

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
      subject: "OTP",
      text: `Your OTP is ${otp}`
    });

    return res.json({ message: "OTP sent ✅" });

  } catch (err) {
    console.log("ERROR:", err);
    return res.status(500).json({ message: "Server error ❌" });
  }
}