import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

function connect() {
    mongoose.connect(process.env.MONGODB_URL)
    .then(() => {
        console.log("✅ Connected to MongoDB ALTAS Success-Fully. ");
    })
    .catch(err => {
        console.error("❌ MongoDB Connection Error:", err);
    });
}

export default connect;
