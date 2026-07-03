import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import routes from "./routes";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(pinoHttp());

app.get("/health", (_req, res) => res.json({ status: "ok", service: "cfo-virtual-pachos-backend" }));

app.use("/api/v1", routes);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.status ?? 500;
  res.status(status).json({ error: { code: err.code ?? "INTERNAL_ERROR", message: err.message ?? "Error interno" } });
});
