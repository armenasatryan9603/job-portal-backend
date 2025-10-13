import { Injectable } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import { extname } from 'path';

@Injectable()
export class GcsService {
  private storage: Storage;
  private bucketName: string;

  constructor() {
    console.log('GOOGLE_CLOUD_PROJECT_ID', process.env.GOOGLE_CLOUD_PROJECT_ID);
    console.log('GOOGLE_CLOUD_KEY_FILE', process.env.GOOGLE_CLOUD_KEY_FILE);
    console.log(
      'GOOGLE_CLOUD_BUCKET_NAME',
      process.env.GOOGLE_CLOUD_BUCKET_NAME,
    );

    // Validate required environment variables
    if (!process.env.GOOGLE_CLOUD_PROJECT_ID) {
      throw new Error(
        'GOOGLE_CLOUD_PROJECT_ID environment variable is required',
      );
    }
    if (!process.env.GOOGLE_CLOUD_KEY_FILE) {
      throw new Error('GOOGLE_CLOUD_KEY_FILE environment variable is required');
    }

    // Initialize Google Cloud Storage
    try {
      this.storage = new Storage({
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE, // Path to service account key file
      });
      console.log('Google Cloud Storage initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Google Cloud Storage:', error);
      throw new Error('Failed to initialize Google Cloud Storage');
    }

    this.bucketName =
      process.env.GOOGLE_CLOUD_BUCKET_NAME || 'job-portal-media';
    console.log('Using bucket:', this.bucketName);
  }

  /**
   * Generate a signed URL for direct upload to Google Cloud Storage
   */
  async generateSignedUploadUrl(
    fileName: string,
    mimeType: string,
    orderId: number,
  ): Promise<{ uploadUrl: string; fileUrl: string; fileName: string }> {
    try {
      console.log(
        `Generating signed URL for file: ${fileName}, mimeType: ${mimeType}, orderId: ${orderId}`,
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
        version: 'v4',
        action: 'write',
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
      console.error('Error generating signed URL:', error);
      console.error('Error details:', {
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
   * Delete a file from Google Cloud Storage
   */
  async deleteFile(fileName: string): Promise<boolean> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);

      await file.delete();
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
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
      console.error('Error checking file existence:', error);
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
      console.error('Error getting file metadata:', error);
      throw new Error('Failed to get file metadata');
    }
  }
}
