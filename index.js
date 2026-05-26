import app from "./src/app.js";
import { connectDB } from "./src/config/db.js";
import { connectRabbitMQ } from "./src/config/rabbitmq.js";

const PORT = process.env.PORT || 5005;

const startServer = async () => {
  try {
    await connectDB();

    try {
      await connectRabbitMQ();
    } catch (err) {
      console.error("RabbitMQ connection failed:", err.message);
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();