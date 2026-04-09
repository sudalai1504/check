import mongoose from "mongoose";

if (!mongoose.connections[0].readyState) {
  await mongoose.connect(process.env.MONGO_URL);
}

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

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { email, otp } = req.body;

  const record = await Otp.findOne({ email, otp });

  if (!record) {
    return res.status(400).json({ message: "Invalid OTP ❌" });
  }

  await User.create(record);
  await Otp.deleteMany({ email });

  res.json({ message: "Registration Successful ✅" });
}