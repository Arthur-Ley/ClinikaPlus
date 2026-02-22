import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { notFound } from "./middlewares/notFound.js";
import { apiRouter } from "./routes/index.js";

const app = express();

app.use(
  cors({
    origin: env.corsOrigin.split(",").map((origin) => origin.trim()),
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
