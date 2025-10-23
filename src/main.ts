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

    // Serve static files from uploads directory
    app.useStaticAssets(join(__dirname, "..", "uploads"), {
      prefix: "/uploads/",
    });

    // Enable CORS
    const corsOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",")
      : ["http://localhost:3000", "http://localhost:3001"];

    console.log("CORS origins:", corsOrigins);

    app.enableCors({
      origin: corsOrigins,
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
