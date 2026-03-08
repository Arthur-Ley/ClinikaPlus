import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { notFound } from "./middlewares/notFound.js";
import { apiRouter } from "./routes/index.js";

const app = express();
const allowedOrigins = env.corsOrigin
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin requests (like Vite proxy) and non-browser clients.
      if (!origin) return callback(null, true);

      const isExplicitlyAllowed = allowedOrigins.includes(origin);
      const isLocalDevOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

      if (isExplicitlyAllowed || isLocalDevOrigin) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
  })
);
app.use(express.json());

app.get("/", (_req, res) => {
  res.status(200).json({
    ok: true,
    message: "ClinikaPlus backend is running",
  });
});

app.use("/api", apiRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`Backend listening on http://localhost:${env.port}`);
});
