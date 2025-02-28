import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config(); 
// Create a Redis client using REDIS_URL
const redisClient = new Redis(process.env.REDIS_URL);

redisClient.on("connect", () => {
    console.log("✅ Redis connected");
});


// redisClient.set("testKey", "Redis is working!", (err, reply) => {
//     if (err) console.error("Redis SET error:", err);
//     else console.log("Redis SET reply:", reply);
// });

// redisClient.get("testKey", (err, reply) => {
//     if (err) console.error("Redis GET error:", err);
//     else console.log("Redis GET reply:", reply); // Should log: "Redis is working!"
// });


redisClient.on("error", (err) => {
    console.error("❌ Redis Error:", err);
});


export default redisClient;
