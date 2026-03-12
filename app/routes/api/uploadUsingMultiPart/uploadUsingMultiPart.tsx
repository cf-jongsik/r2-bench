import type { Route } from "./+types/uploadUsingMultiPart";
import {
  validateBucketParameter,
  validateFileName,
  validateContentType,
} from "$lib/validation";
import { logError } from "$lib/errors";

export async function action({
  request,
  context,
  params,
}: Route.ActionArgs): Promise<
  | MULTIPART_API_GENERATE_RESULT
  | MULTIPART_API_UPLOAD_RESULT
  | MULTIPART_API_MERGE_RESULT
> {
  const { bucket, fileName, uploadId, partNumber } = params;

  if (request.method !== "POST" && request.method !== "PUT") {
    return { success: false, error: "Invalid request method", key: fileName };
  }

  const bucketValidation = validateBucketParameter(bucket);
  if (!bucketValidation.valid) {
    return { success: false, error: bucketValidation.error, key: fileName };
  }

  const fileNameValidation = validateFileName(fileName);
  if (!fileNameValidation.valid) {
    return { success: false, error: fileNameValidation.error, key: fileName };
  }

  const contentTypeHeader = request.headers.get("Content-Type");
  const contentTypeValidation = validateContentType(contentTypeHeader);
  if (!contentTypeValidation.valid) {
    return {
      success: false,
      error: contentTypeValidation.error,
      key: fileName,
    };
  }

  try {
    const r2 = context.cloudflare.env[bucket as BucketRegion];
    if (!r2) {
      logError(
        "uploadUsingMultiPart",
        `R2 binding not found for bucket: ${bucket}`,
      );
      return {
        success: false,
        error: "Server configuration error",
        key: fileName,
      };
    }

    if (request.method === "POST") {
      if (uploadId) {
        if (partNumber) {
          return {
            success: false,
            error: "Invalid request parameters",
            key: fileName,
          };
        }

        let mergeData: R2UploadedPart[];
        try {
          mergeData = await request.json<R2UploadedPart[]>();
          if (!Array.isArray(mergeData)) {
            throw new Error("Invalid merge data");
          }
        } catch (error) {
          logError("uploadUsingMultiPart", "Failed to parse merge request");
          return {
            success: false,
            error: "Invalid JSON payload",
          } satisfies MULTIPART_API_MERGE_RESULT;
        }

        const uploader = r2.resumeMultipartUpload(fileName, uploadId);
        const mergeResult = await uploader.complete(mergeData);
        if (!mergeResult) {
          logError("uploadUsingMultiPart", "Failed to merge parts");
          return {
            success: false,
            error: "Failed to merge parts",
          } satisfies MULTIPART_API_MERGE_RESULT;
        }

        return {
          success: true,
          etag: mergeResult.etag,
          uploadId,
        } satisfies MULTIPART_API_MERGE_RESULT;
      }

      const multipartUploadId = await r2.createMultipartUpload(fileName, {
        httpMetadata: {
          contentType: contentTypeHeader || "application/octet-stream",
        },
      });
      if (!multipartUploadId) {
        logError("uploadUsingMultiPart", "Failed to create uploadId");
        return {
          success: false,
          error: "Failed to create uploadId",
          key: fileName,
        } satisfies MULTIPART_API_GENERATE_RESULT;
      }

      return {
        success: true,
        uploadId: multipartUploadId.uploadId,
        key: multipartUploadId.key,
      } satisfies MULTIPART_API_GENERATE_RESULT;
    }

    if (request.method === "PUT") {
      if (!uploadId || !partNumber) {
        return {
          success: false,
          error: "Invalid uploadId or partNumber",
          uploadId: uploadId || "",
          partNumber: Number(partNumber) || -1,
        } satisfies MULTIPART_API_UPLOAD_RESULT;
      }

      if (!request.body) {
        return {
          success: false,
          error: "Missing request body",
          uploadId,
          partNumber: Number(partNumber),
        } satisfies MULTIPART_API_UPLOAD_RESULT;
      }

      const multipartUploader = r2.resumeMultipartUpload(fileName, uploadId);
      const res = await multipartUploader.uploadPart(
        Number(partNumber),
        request.body,
      );

      if (!res || !res.partNumber) {
        logError("uploadUsingMultiPart", `Failed to upload part ${partNumber}`);
        return {
          success: false,
          uploadId,
          partNumber: Number(partNumber),
          error: "Failed to upload part",
        } satisfies MULTIPART_API_UPLOAD_RESULT;
      }

      return {
        success: true,
        multiPart: {
          partNumber: res.partNumber,
          etag: res.etag,
        },
        uploadId,
      } satisfies MULTIPART_API_UPLOAD_RESULT;
    }

    return { success: false, error: "Invalid request method", key: fileName };
  } catch (error) {
    logError("uploadUsingMultiPart", error);
    return { success: false, error: "Upload operation failed", key: fileName };
  }
}
