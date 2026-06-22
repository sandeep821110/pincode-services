import { createClient } from "redis";
import { configDotenv } from "dotenv";
configDotenv();

let client;
let redisAvailable = false;

try {
  client = createClient({
    url: process.env.REDIS_URL,
  });

  client.on("connect", () => {
    redisAvailable = true;
    console.log("Redis connected");
  });
  client.on("ready", () => {
    redisAvailable = true;
    console.log("Redis ready");
  });
  client.on("error", (err) => {
    redisAvailable = false;
    console.log("Redis Error", err);
  });
  client.on("end", () => {
    redisAvailable = false;
  });

  await client.connect();
} catch (err) {
  console.log("Redis connection failed, running without cache");
  redisAvailable = false;
  client = {
    get: async () => null,
    setEx: async () => {},
    del: async () => {},
    connect: async () => {},
    on: () => {},
  };
}

export const isRedisAvailable = () => redisAvailable;

export const getRedisStatus = () => ({
  connected: redisAvailable,
  available: redisAvailable,
  status: redisAvailable ? "ready" : "disconnected",
});

export const checkRedisHealth = async () => {
  if (!redisAvailable) {
    return { status: "unhealthy", message: "Redis not connected", connected: false };
  }
  try {
    const pong = await Promise.race([
      client.ping(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Ping timeout")), 3000)
      ),
    ]);
    return { status: "healthy", message: pong, connected: true };
  } catch (error) {
    return { status: "unhealthy", message: error.message, connected: false };
  }
};

export default client;
