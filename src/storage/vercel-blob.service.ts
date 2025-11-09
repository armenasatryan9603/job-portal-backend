import { Injectable } from "@nestjs/common";
import { put, del, head, list } from "@vercel/blob";
import { v4 as uuidv4 } from "uuid";
import { extname } from "path";

@Injectable()
export class VercelBlobService {
  private token: string;

  constructor() {
    this.token = process.env.BLOB_READ_WRITE_TOKEN || "";

    if (!this.token) {
      console.error(
        "❌ BLOB_READ_WRITE_TOKEN not set. Vercel Blob operations will fail."
      );
      console.error("Please set BLOB_READ_WRITE_TOKEN in your .env file.");
      console.error(
        "Get your token from: https://vercel.com/dashboard -> Your Project -> Settings -> Environment Variables"
      );
    } else {
      // Validate token format (should start with vercel_blob_rw_)
      if (!this.token.startsWith("vercel_blob_rw_")) {
        console.warn(
          "⚠️  BLOB_READ_WRITE_TOKEN format may be incorrect. Expected format: vercel_blob_rw_..."
        );
        console.warn("Current token length:", this.token.length, "characters");
      }
      const tokenPrefix = this.token.substring(0, 20);
      console.log(
        `✅ Vercel Blob initialized successfully (token: ${tokenPrefix}...)`
      );
    }
  }

  /**
   * Generate upload info for Vercel Blob
   * Note: Vercel Blob doesn't use presigned URLs like traditional cloud storage.
   * For security, files should be uploaded through the backend /media-files/upload endpoint.
   * This method returns the expected file path structure for compatibility.
   */
  async generateSignedUploadUrl(
    fileName: string,
    mimeType: string,
    orderId: number
  ): Promise<{ uploadUrl: string; fileUrl: string; fileName: string }> {
    try {
      console.log(
        `Generating upload info for file: ${fileName}, mimeType: ${mimeType}, orderId: ${orderId}`
      );

      // Generate unique filename
      const fileExtension = extname(fileName);
      const uniqueFileName = `orders/${orderId}/${uuidv4()}${fileExtension}`;
      console.log(`Generated unique filename: ${uniqueFileName}`);

      // For Vercel Blob, client-side uploads should go through the backend
      // Return the backend upload endpoint as uploadUrl
      // The actual fileUrl will be determined after upload
      const backendUploadUrl = `/media-files/upload`; // Frontend should use this endpoint
      const expectedFileUrl = `https://blob.vercel-storage.com/${uniqueFileName}`;

      return {
        uploadUrl: backendUploadUrl, // Frontend should POST to this endpoint
        fileUrl: expectedFileUrl, // Expected URL after upload (may vary)
        fileName: uniqueFileName,
      };
    } catch (error) {
      console.error("Error generating upload URL:", error);
      throw new Error(`Failed to generate upload URL: ${error.message}`);
    }
  }

  /**
   * Upload a file directly to Vercel Blob
   */
  async uploadFile(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    orderId: number
  ): Promise<string> {
    try {
      if (!this.token) {
        throw new Error(
          "BLOB_READ_WRITE_TOKEN is not set. Please configure it in your .env file."
        );
      }

      console.log(
        `Uploading file: ${fileName}, mimeType: ${mimeType}, orderId: ${orderId}`
      );

      // Generate unique filename
      const fileExtension = extname(fileName);
      const uniqueFileName = `orders/${orderId}/${uuidv4()}${fileExtension}`;
      console.log(`Generated unique filename: ${uniqueFileName}`);

      // Upload to Vercel Blob
      const blob = await put(uniqueFileName, buffer, {
        access: "public",
        contentType: mimeType,
        token: this.token,
      });

      console.log(`Successfully uploaded file: ${blob.url}`);
      return blob.url;
    } catch (error) {
      console.error("Error uploading file:", error);

      // Provide more helpful error messages
      if (
        error.message?.includes("Access denied") ||
        error.message?.includes("valid token")
      ) {
        throw new Error(
          `Vercel Blob authentication failed. Please check your BLOB_READ_WRITE_TOKEN in .env file. ` +
            `Get your token from: https://vercel.com/dashboard -> Your Project -> Settings -> Environment Variables`
        );
      }

      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Delete a file from Vercel Blob
   */
  async deleteFile(fileUrl: string): Promise<boolean> {
    try {
      // Vercel Blob delete takes the full URL
      await del(fileUrl, {
        token: this.token,
      });
      console.log(`File deleted from Vercel Blob: ${fileUrl}`);
      return true;
    } catch (error) {
      console.error("Error deleting file:", error);
      // If file doesn't exist, that's okay - return true
      if (
        error.message?.includes("not found") ||
        error.message?.includes("404")
      ) {
        return true;
      }
      return false;
    }
  }

  /**
   * Check if a file exists in Vercel Blob
   */
  async fileExists(fileUrl: string): Promise<boolean> {
    try {
      await head(fileUrl, {
        token: this.token,
      });
      return true;
    } catch (error) {
      if (
        error.message?.includes("not found") ||
        error.message?.includes("404")
      ) {
        return false;
      }
      console.error("Error checking file existence:", error);
      return false;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileUrl: string) {
    try {
      const metadata = await head(fileUrl, {
        token: this.token,
      });
      return metadata;
    } catch (error) {
      console.error("Error getting file metadata:", error);
      throw new Error("Failed to get file metadata");
    }
  }

  /**
   * Get the blob token for client-side uploads
   * Note: In production, you might want to use a more secure approach
   */
  getToken(): string {
    return this.token;
  }
}
