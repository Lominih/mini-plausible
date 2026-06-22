import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import collectRouter from "./routes/collect";
import healthRouter from "./routes/health";
import { globalLimiter, eventLimiter } from "./middleware/rate-limit";

export function createApp(): express.Application {
  const app = express();

  // Security and utility middleware
  app.use(helmet());
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "x-site-id",
      "x-device-id",
      "x-session-id",
    ],
  }));
  app.use(compression());
  app.use(morgan("combined"));

  // Body parsing
  app.use(express.json({ limit: "10kb" }));
  app.use(express.urlencoded({ extended: false }));

  // Rate limiting
  app.use(globalLimiter);

  // Routes
  app.use(healthRouter);
  app.use(eventLimiter);
  app.use(collectRouter);

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Error handler
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error("Unhandled error:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  );

  return app;
}
