import type { Route } from "./+types/uploadUsingBinding";
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
}: Route.ActionArgs): Promise<BINDING_API_RESULT> {
  if (request.method !== "PUT") {
    return {
      success: false,
      error: "Method not allowed",
    };
  }

  const { bucket, fileName } = params;

  const bucketValidation = validateBucketParameter(bucket);
  if (!bucketValidation.valid) {
    return {
      success: false,
      error: bucketValidation.error,
    };
  }

  const fileNameValidation = validateFileName(fileName);
  if (!fileNameValidation.valid) {
    return {
      success: false,
      error: fileNameValidation.error,
    };
  }

  const contentTypeHeader = request.headers.get("Content-Type");
  const contentTypeValidation = validateContentType(contentTypeHeader);
  if (!contentTypeValidation.valid) {
    return {
      success: false,
      error: contentTypeValidation.error,
    };
  }

  if (!request.body) {
    return {
      success: false,
      error: "Request body is required",
    };
  }

  try {
    const r2 = context.cloudflare.env[bucket as BucketRegion];

    if (!r2) {
      logError(
        "uploadUsingBinding",
        `R2 binding not found for bucket: ${bucket}`,
      );
      return {
        success: false,
        error: "Server configuration error",
      };
    }

    const result = await r2.put(fileName, request.body, {
      httpMetadata: {
        contentType: contentTypeHeader || "application/octet-stream",
      },
    });

    if (!result) {
      logError("uploadUsingBinding", "Upload returned no result");
      return { success: false, error: "Upload failed" };
    }

    return {
      success: true,
      etag: result.etag,
    };
  } catch (error) {
    logError("uploadUsingBinding", error);
    return {
      success: false,
      error: "Upload failed",
    };
  }
}
