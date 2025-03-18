import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config(); 
// Create a Redis client using REDIS_URL
const redisClient = new Redis(process.env.REDIS_URL);

redisClient.on("connect", () => {
    console.log("✅ Redis connected");
});




redisClient.on("error", (err) => {
    console.error("❌ Redis Error:", err);
});


export default redisClient;
