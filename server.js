require("dotenv").config();
const express = require("express");
const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL, {
    tls: {}, // Ensures TLS is used
    retryStrategy: (times) => Math.min(times * 50, 2000), // Retry with backoff
    reconnectOnError: (err) => {
        console.error("Redis Connection Error:", err);
        return true; // Try to reconnect
    }
});

redis.on("connect", () => console.log("✅ Connected to Redis!"));
redis.on("error", (err) => console.error("❌ Redis Error:", err));

const PORT = process.env.PORT || 3000;
const RATE_LIMIT = process.env.RATE_LIMIT || 10;
const RATE_LIMIT_WINDOW = process.env.RATE_LIMIT_WINDOW || 60;


const app = express();
app.use(express.json());

const rateLimiter = async (req, res, next) => {
    const IP = req.ip;
    const key = `rate-limit:${IP}`;

    try {
        let requests = await redis.get(key);

        if (requests) {
            requests = parseInt(requests);
            if (requests >= RATE_LIMIT) {
                return res.status(429).json({ 
                    error: "Too many requests. Please try again later." 
                });
            }
            await redis.incr(key);
        } else {
            await redis.set(key, 1, "EX", RATE_LIMIT_WINDOW);
        }

        next();
    } catch (error) {
        console.error("Redis error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

app.use(rateLimiter);

app.get("/", (req, res) => {
    res.send("Welcome to the API! You're not rate-limited yet.");
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
