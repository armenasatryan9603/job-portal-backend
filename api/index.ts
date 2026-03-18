import express from "express";
import { ExpressAdapter } from "@nestjs/platform-express";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "../src/app.module";
import { HtmlExceptionFilter } from "../src/credit/html-exception.filter";
import type { Request, Response } from "express";

const server = express();

let isInitialized = false;

async function bootstrap(): Promise<void> {
  if (isInitialized) return;

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: ["error", "warn", "log"],
  });

  app.useGlobalFilters(new HtmlExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
    : ["http://localhost:3000"];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const trimmed = origin.trim();
      const isAllowed =
        corsOrigins.includes("*") ||
        corsOrigins.includes(trimmed) ||
        corsOrigins.some((a) => trimmed.startsWith(a.trim())) ||
        trimmed.startsWith("http://localhost:") ||
        trimmed.startsWith("https://localhost:");
      callback(isAllowed ? null : new Error("Not allowed by CORS"), isAllowed);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
    credentials: true,
  });

  await app.init();
  isInitialized = true;
}

export default async function handler(req: Request, res: Response) {
  await bootstrap();
  server(req, res);
}
