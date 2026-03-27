import { nanoid } from "nanoid";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Pool } from "pg";

export interface StorageCtxConfig {
  pool:         Pool;
  projectSlug:  string;
  endpoint:     string;
  accessKey:    string;
  secretKey:    string;
  bucket:       string;
  publicBase?:  string;   // if set, getUrl() returns a public URL instead of presigned
}

export class StorageCtx {
  private _pool:   Pool;
  private _schema: string;
  private _s3:     S3Client;
  private _bucket: string;
  private _publicBase?: string;

  constructor(config: StorageCtxConfig) {
    this._pool   = config.pool;
    this._schema = `project_${config.projectSlug}`;
    this._bucket = config.bucket;
    this._publicBase = config.publicBase;

    this._s3 = new S3Client({
      endpoint:    config.endpoint,
      region:      "us-east-1",
      credentials: {
        accessKeyId:     config.accessKey,
        secretAccessKey: config.secretKey,
      },
      forcePathStyle: true,
    });
  }

  /**
   * Store a Blob. Returns an opaque storageId.
   * The actual S3 key is internal — callers use getUrl() to retrieve it.
   */
  async store(blob: Blob, opts?: { contentType?: string }): Promise<string> {
    const storageId  = `st_${nanoid(20)}`;
    const ext        = this._extFromType(opts?.contentType ?? blob.type);
    const s3Key      = `${this._schema}/${storageId}${ext}`;
    const contentType = opts?.contentType ?? blob.type ?? "application/octet-stream";

    const buffer = Buffer.from(await blob.arrayBuffer());

    await this._s3.send(new PutObjectCommand({
      Bucket:      this._bucket,
      Key:         s3Key,
      Body:        buffer,
      ContentType: contentType,
    }));

    await this._pool.query(
      `INSERT INTO "${this._schema}"._iac_storage
         (storage_id, s3_key, bucket, content_type, size_bytes)
       VALUES ($1, $2, $3, $4, $5)`,
      [storageId, s3Key, this._bucket, contentType, blob.size]
    );

    return storageId;
  }

  /**
   * Get a URL for a storageId.
   * Returns a presigned URL (expires in 1h) unless publicBase is set.
   */
  async getUrl(storageId: string): Promise<string | null> {
    const { rows } = await this._pool.query(
      `SELECT s3_key FROM "${this._schema}"._iac_storage WHERE storage_id = $1`,
      [storageId]
    );
    if (rows.length === 0) return null;

    const s3Key = rows[0].s3_key;

    if (this._publicBase) {
      return `${this._publicBase}/${s3Key}`;
    }

    return getSignedUrl(
      this._s3,
      new GetObjectCommand({ Bucket: this._bucket, Key: s3Key }),
      { expiresIn: 3600 }
    );
  }

  /** Delete a stored object */
  async delete(storageId: string): Promise<void> {
    const { rows } = await this._pool.query(
      `DELETE FROM "${this._schema}"._iac_storage WHERE storage_id = $1 RETURNING s3_key`,
      [storageId]
    );
    if (rows.length === 0) return;

    await this._s3.send(new DeleteObjectCommand({
      Bucket: this._bucket,
      Key:    rows[0].s3_key,
    }));
  }

  private _extFromType(contentType: string): string {
    const map: Record<string, string> = {
      "image/jpeg":      ".jpg",
      "image/png":       ".png",
      "image/webp":      ".webp",
      "image/gif":       ".gif",
      "application/pdf": ".pdf",
      "text/plain":      ".txt",
      "application/json":".json",
    };
    return map[contentType] ?? "";
  }
}