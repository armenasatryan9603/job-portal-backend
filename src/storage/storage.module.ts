import { Module } from "@nestjs/common";
import { VercelBlobService } from "./vercel-blob.service";

@Module({
  providers: [VercelBlobService],
  exports: [VercelBlobService],
})
export class StorageModule {}
