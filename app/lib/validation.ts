const VALID_BUCKETS = ["eeur", "weur", "wnam", "apac"] as const;
const MAX_FILE_SIZE_BINDING = 4999 * 1024 * 1024;
const MAX_FILE_SIZE_MULTIPART = 4999 * 1024 * 1024;
const PRESIGNED_URL_EXPIRY = 3600;
const MULTIPART_CHUNK_SIZE = 50 * 1024 * 1024;
const MULTIPART_BATCH_SIZE = 30;

export function isValidBucket(bucket: unknown): bucket is BucketRegion {
  return (
    typeof bucket === "string" && VALID_BUCKETS.includes(bucket as BucketRegion)
  );
}

export function validateBucketParameter(
  bucket: unknown,
): { valid: true } | { valid: false; error: string } {
  if (!isValidBucket(bucket)) {
    return {
      valid: false,
      error: `Invalid bucket. Must be one of: ${VALID_BUCKETS.join(", ")}`,
    };
  }
  return { valid: true };
}

export function validateFileName(
  fileName: unknown,
): { valid: true } | { valid: false; error: string } {
  if (typeof fileName !== "string" || fileName.trim().length === 0) {
    return {
      valid: false,
      error: "File name must be a non-empty string",
    };
  }
  return { valid: true };
}

export function validateContentType(
  contentType: unknown,
): { valid: true } | { valid: false; error: string } {
  if (typeof contentType !== "string" || contentType.trim().length === 0) {
    return {
      valid: false,
      error: "Content-Type header is required",
    };
  }
  return { valid: true };
}

export function validateFileSize(
  size: unknown,
  maxSize: number,
): { valid: true } | { valid: false; error: string } {
  if (typeof size !== "number" || size <= 0) {
    return {
      valid: false,
      error: "File size must be a positive number",
    };
  }
  if (size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${(maxSize / 1024 / 1024).toFixed(0)}MB`,
    };
  }
  return { valid: true };
}

export function validatePresignedRequest(
  payload: unknown,
):
  | { valid: true; data: PRESIGNED_API_REQUEST }
  | { valid: false; error: string } {
  if (!payload || typeof payload !== "object") {
    return { valid: false, error: "Invalid request payload" };
  }

  const p = payload as Record<string, unknown>;

  const fileNameValidation = validateFileName(p.fileName);
  if (!fileNameValidation.valid) return fileNameValidation;

  const bucketValidation = validateBucketParameter(p.bucket);
  if (!bucketValidation.valid) return bucketValidation;

  const contentTypeValidation = validateContentType(p.contentType);
  if (!contentTypeValidation.valid) return contentTypeValidation;

  const fileSizeValidation = validateFileSize(
    p.contentLength,
    Number.MAX_SAFE_INTEGER,
  );
  if (!fileSizeValidation.valid) return fileSizeValidation;

  return {
    valid: true,
    data: {
      fileName: p.fileName as string,
      bucket: p.bucket as BucketRegion,
      contentType: p.contentType as string,
      contentLength: p.contentLength as number,
    },
  };
}

export const CONSTANTS = {
  VALID_BUCKETS,
  MAX_FILE_SIZE_BINDING,
  MAX_FILE_SIZE_MULTIPART,
  PRESIGNED_URL_EXPIRY,
  MULTIPART_CHUNK_SIZE,
  MULTIPART_BATCH_SIZE,
};
