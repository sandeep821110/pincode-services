import { createClient } from "redis";
import { configDotenv } from "dotenv";
configDotenv();

let client;

try {
  client = createClient({
    url: process.env.REDIS_URL,
  });

  client.on("connect", () => console.log("Redis connected"));
  client.on("error", (err) => console.log("Redis Error", err));

  await client.connect();
} catch (err) {
  console.log("Redis connection failed, running without cache");
  client = {
    get: async () => null,
    setEx: async () => {},
    del: async () => {},
    connect: async () => {},
    on: () => {},
  };
}

export default client;
