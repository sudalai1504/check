import mongoose from "mongoose";

let isConnected = false;

export const connectDB = async () => {
  if (isConnected) return;

  try {
    const conn = await mongoose.connect(process.env.MONGO_URL);
    isConnected = conn.connections[0].readyState;
    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.log("❌ DB Error:", err);
    throw err;
  }
};