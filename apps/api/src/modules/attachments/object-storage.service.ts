import { Injectable } from '@nestjs/common';
import { GetObjectCommand, PutObjectCommand, S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

@Injectable()
export class ObjectStorageService {
  private readonly bucket = process.env.S3_BUCKET || 'nexoria-artifacts';
  private readonly region = process.env.S3_REGION || 'us-east-1';
  private readonly forcePathStyle = (process.env.S3_FORCE_PATH_STYLE || 'true') === 'true';
  private readonly internalClient = this.client(process.env.S3_ENDPOINT || 'http://minio:9000');
  private readonly publicClient = this.client(process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT || 'http://localhost:9000');

  bucketName(): string {
    return this.bucket;
  }

  async putObject(key: string, bytes: Buffer, mimeType: string): Promise<void> {
    await this.internalClient.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: bytes,
      ContentType: mimeType,
      ContentLength: bytes.length,
    }));
  }

  async getObjectBuffer(key: string): Promise<Buffer> {
    const result = await this.internalClient.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const body = result.Body;
    if (!body) return Buffer.alloc(0);
    if (body instanceof Readable) {
      const chunks: Buffer[] = [];
      for await (const chunk of body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return Buffer.concat(chunks);
    }
    const webStream = body as any;
    if (typeof webStream.transformToByteArray === 'function') {
      return Buffer.from(await webStream.transformToByteArray());
    }
    return Buffer.from(await new Response(webStream).arrayBuffer());
  }

  async deleteObject(key: string): Promise<void> {
    await this.internalClient.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async signedUploadUrl(key: string, mimeType: string, expiresInSeconds = 600): Promise<string> {
    return getSignedUrl(this.publicClient, new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    }), { expiresIn: expiresInSeconds });
  }

  async signedDownloadUrl(key: string, filename: string, expiresInSeconds = 600): Promise<string> {
    return getSignedUrl(this.publicClient, new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, '')}"`,
    }), { expiresIn: expiresInSeconds });
  }

  private client(endpoint: string): S3Client {
    return new S3Client({
      endpoint,
      region: this.region,
      forcePathStyle: this.forcePathStyle,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || process.env.MINIO_ROOT_USER || 'nexoria',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || process.env.MINIO_ROOT_PASSWORD || 'nexoria-minio-secret',
      },
    });
  }
}
