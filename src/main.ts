import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "path";
import * as express from "express";

async function bootstrap() {
  try {
    console.log("🚀 Starting application...");
    console.log("Environment:", process.env.NODE_ENV || "development");
    console.log("Port:", process.env.PORT || 8080);

    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: ["error", "warn", "log", "debug"],
    });

    // Configure JSON body parser
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // Note: Static file serving removed for serverless deployment
    // Files are now served directly from Vercel Blob

    // Enable CORS
    const corsOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",")
      : ["http://localhost:3000", "http://localhost:3001"];

    console.log("CORS origins:", corsOrigins);

    app.enableCors({
      origin: (origin, callback) => {
        // Mobile apps (React Native/Expo) don't send Origin header
        // Allow requests without origin (native mobile apps)
        if (!origin) {
          console.log("✅ CORS: Allowing request without origin (mobile app)");
          return callback(null, true);
        }

        // Check if origin is in allowed list or if wildcard is enabled
        if (
          corsOrigins.includes("*") ||
          corsOrigins.includes(origin) ||
          corsOrigins.some((allowed) => origin.startsWith(allowed))
        ) {
          console.log(`✅ CORS: Allowing origin: ${origin}`);
          callback(null, true);
        } else {
          console.log(`❌ CORS: Blocking origin: ${origin}`);
          callback(new Error("Not allowed by CORS"));
        }
      },
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Accept"],
      credentials: true,
    });

    const port = process.env.PORT ?? 8080;
    // Cloud Run requires binding to 0.0.0.0 (all interfaces)
    await app.listen(port, "0.0.0.0");

    console.log(`✅ Application is running on port ${port}`);
    console.log(`🔗 Health check: http://0.0.0.0:${port}/health`);
  } catch (error) {
    console.error("❌ Failed to start application:", error);
    process.exit(1);
  }
}

bootstrap();
