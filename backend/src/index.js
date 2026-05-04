import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { notFound } from "./middlewares/notFound.js";
import { apiRouter } from "./routes/index.js";

const app = express();

// Simplified CORS for Vercel deployment
app.use(
  cors({
    origin: true, // This allows your Vercel frontend to communicate with the backend
    credentials: true,
  })
);

app.use(express.json());

app.get("/", (_req, res) => {
  res.status(200).json({
    ok: true,
    message: "ClinikaPlus backend is running",
  });
});

// Your routes are prefixed with /api
app.use("/api", apiRouter);

app.use(notFound);
app.use(errorHandler);

// CRITICAL: Export default app for Vercel
export default app;

// Only call app.listen when running locally
if (process.env.NODE_ENV !== "production") {
  const port = env.port || 4000;
  app.listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`);
  });
}
