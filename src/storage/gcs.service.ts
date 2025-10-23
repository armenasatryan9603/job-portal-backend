import { Injectable } from "@nestjs/common";
import { Storage } from "@google-cloud/storage";
import { v4 as uuidv4 } from "uuid";
import { extname } from "path";

@Injectable()
export class GcsService {
  private storage: Storage;
  private bucketName: string;

  constructor() {
    console.log("GOOGLE_CLOUD_PROJECT_ID", process.env.GOOGLE_CLOUD_PROJECT_ID);
    console.log("GOOGLE_CLOUD_KEY_FILE", process.env.GOOGLE_CLOUD_KEY_FILE);
    console.log(
      "GOOGLE_CLOUD_BUCKET_NAME",
      process.env.GOOGLE_CLOUD_BUCKET_NAME
    );

    // Initialize Google Cloud Storage
    try {
      // In Cloud Run, use default credentials. In local dev, use key file if provided.
      const storageConfig: any = {};

      if (process.env.GOOGLE_CLOUD_PROJECT_ID) {
        storageConfig.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
      }

      if (process.env.GOOGLE_CLOUD_KEY_FILE) {
        storageConfig.keyFilename = process.env.GOOGLE_CLOUD_KEY_FILE;
      }
      // If no key file is provided, Storage SDK will use default credentials (Cloud Run service account)

      this.storage = new Storage(storageConfig);
      console.log("Google Cloud Storage initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Google Cloud Storage:", error);
      throw new Error("Failed to initialize Google Cloud Storage");
    }

    this.bucketName =
      process.env.GOOGLE_CLOUD_BUCKET_NAME || "job-portal-media";
    console.log("Using bucket:", this.bucketName);
  }

  /**
   * Generate a signed URL for direct upload to Google Cloud Storage
   */
  async generateSignedUploadUrl(
    fileName: string,
    mimeType: string,
    orderId: number
  ): Promise<{ uploadUrl: string; fileUrl: string; fileName: string }> {
    try {
      console.log(
        `Generating signed URL for file: ${fileName}, mimeType: ${mimeType}, orderId: ${orderId}`
      );

      // Generate unique filename
      const fileExtension = extname(fileName);
      const uniqueFileName = `orders/${orderId}/${uuidv4()}${fileExtension}`;
      console.log(`Generated unique filename: ${uniqueFileName}`);

      // Get bucket and file references
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(uniqueFileName);

      // Generate signed URL for upload (valid for 1 hour)
      const [signedUrl] = await file.getSignedUrl({
        version: "v4",
        action: "write",
        expires: Date.now() + 60 * 60 * 1000, // 1 hour
        contentType: mimeType,
      });

      // Return the public URL for the file
      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${uniqueFileName}`;

      console.log(`Successfully generated signed URL for: ${uniqueFileName}`);

      return {
        uploadUrl: signedUrl,
        fileUrl: publicUrl,
        fileName: uniqueFileName,
      };
    } catch (error) {
      console.error("Error generating signed URL:", error);
      console.error("Error details:", {
        fileName,
        mimeType,
        orderId,
        bucketName: this.bucketName,
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to generate upload URL: ${error.message}`);
    }
  }

  /**
   * Upload a file directly to Google Cloud Storage
   */
  async uploadFile(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    orderId: number
  ): Promise<string> {
    try {
      console.log(
        `Uploading file: ${fileName}, mimeType: ${mimeType}, orderId: ${orderId}`
      );

      // Generate unique filename
      const fileExtension = extname(fileName);
      const uniqueFileName = `orders/${orderId}/${uuidv4()}${fileExtension}`;
      console.log(`Generated unique filename: ${uniqueFileName}`);

      // Get bucket and file references
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(uniqueFileName);

      // Upload the file
      await file.save(buffer, {
        metadata: {
          contentType: mimeType,
        },
      });

      // Return the public URL for the file
      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${uniqueFileName}`;
      console.log(`Successfully uploaded file: ${uniqueFileName}`);

      return publicUrl;
    } catch (error) {
      console.error("Error uploading file:", error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Delete a file from Google Cloud Storage
   */
  async deleteFile(fileName: string): Promise<boolean> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);

      await file.delete();
      return true;
    } catch (error) {
      console.error("Error deleting file:", error);
      return false;
    }
  }

  /**
   * Check if a file exists in the bucket
   */
  async fileExists(fileName: string): Promise<boolean> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);

      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      console.error("Error checking file existence:", error);
      return false;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileName: string) {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);

      const [metadata] = await file.getMetadata();
      return metadata;
    } catch (error) {
      console.error("Error getting file metadata:", error);
      throw new Error("Failed to get file metadata");
    }
  }
}
