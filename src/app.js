import express from "express";
import pincodeRouter from "./routes/pincode.route.js";
import morgan from "morgan";
import cors from "cors";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import { checkDBHealth } from "./config/db.js";
import { checkRedisHealth, isRedisAvailable, getRedisStatus } from "./config/redis.js";
import { checkRabbitMQHealth, isRabbitMQConnected, getRabbitMQStatus } from "./config/rabbitmq.js";

const app = express();

const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:5174").split(",").map(s => s.trim()).filter(Boolean);
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (corsOrigins.includes(origin)) return callback(null, true);
    if (process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

app.use("/api/pincodes", pincodeRouter);

app.get("/health", async (req, res) => {
  const dbHealth = checkDBHealth();
  const redisHealth = await checkRedisHealth();
  const rabbitMQHealth = await checkRabbitMQHealth();

  const allHealthy = dbHealth.status === "healthy" && redisHealth.status === "healthy" && rabbitMQHealth.status === "healthy";
  const overallStatus = allHealthy ? "healthy" : "degraded";

  res.status(allHealthy ? 200 : 503).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      mongodb: {
        status: dbHealth.status,
        message: dbHealth.message,
        connected: dbHealth.connected,
        host: dbHealth.host,
        db: dbHealth.db,
      },
      redis: {
        status: redisHealth.status,
        message: redisHealth.message,
        connected: redisHealth.connected,
        available: isRedisAvailable(),
        details: getRedisStatus(),
      },
      rabbitmq: {
        status: rabbitMQHealth.status,
        message: rabbitMQHealth.message,
        connected: rabbitMQHealth.connected,
        available: isRabbitMQConnected(),
        details: getRabbitMQStatus(),
      },
    },
  });
});

export default app;
