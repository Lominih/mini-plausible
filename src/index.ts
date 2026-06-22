import { createApp } from "./app";
import { authMiddleware } from "./middleware/auth";
import { authLimiter } from "./middleware/rate-limit";
import analyticsRouter from "./routes/analytics";
import sitesRouter from "./routes/sites";
import authRouter from "./routes/auth";
import usersRouter from "./routes/users";
import eventDefinitionsRouter from "./routes/event-definitions";
import funnelsRouter from "./routes/funnels";
import pathsRouter from "./routes/paths";
import exportRouter from "./routes/export";
import { prisma } from "./utils/prisma";

const app = createApp();

// Auth middleware for protected routes
app.use("/api/auth", authLimiter, authRouter);
app.use("/api/users", authMiddleware, usersRouter);
app.use("/api/events/definitions", authMiddleware, eventDefinitionsRouter);
app.use("/api/analytics/funnels", authMiddleware, funnelsRouter);
app.use("/api/analytics/paths", authMiddleware, pathsRouter);
app.use("/api/export", authMiddleware, exportRouter);

// Analytics and Sites routes (protected with auth middleware)
app.use("/api/analytics", analyticsRouter);
app.use("/api/sites", sitesRouter);

const PORT = parseInt(process.env.PORT || "3000", 10);

app.listen(PORT, () => {
  console.log(`Mini Plausible API running on port ${PORT}`);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("unhandledRejection", (reason: unknown) => {
  console.error("Unhandled rejection:", reason);
});

export default app;
