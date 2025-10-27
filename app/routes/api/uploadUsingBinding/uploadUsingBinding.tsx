import type { Route } from "./+types/uploadUsingBinding";
import { isValidBucket } from "../../../utils";

export async function action({
  request,
  context,
  params,
}: Route.ActionArgs): Promise<BINDING_API_RESULT> {
  if (request.method !== "PUT") {
    console.error("Method not allowed: expected PUT");
    return {
      success: false,
      error: "Method not allowed",
    };
  }
  const {
    PRESIGNED_APAC_BUCKET_NAME,
    PRESIGNED_EEUR_BUCKET_NAME,
    PRESIGNED_WEUR_BUCKET_NAME,
    PRESIGNED_WNAM_BUCKET_NAME,
  } = context.cloudflare.env;
  if (
    !PRESIGNED_APAC_BUCKET_NAME ||
    !PRESIGNED_EEUR_BUCKET_NAME ||
    !PRESIGNED_WEUR_BUCKET_NAME ||
    !PRESIGNED_WNAM_BUCKET_NAME
  ) {
    console.error("no platform variable(s)");
    return {
      success: false,
      error: "no platform variable(s)",
    };
  }

  const { bucket, fileName } = params;

  if (!bucket || !isValidBucket(bucket)) {
    console.error("Invalid bucket parameter:", bucket);
    return {
      success: false,
      error: "Invalid bucket. Must be one of: eeur, weur, wnam, apac",
    };
  }

  console.debug("Binding target bucketName", bucket);
  const r2 = context.cloudflare.env[bucket];

  if (!r2) {
    console.error("no platform variable(s)");
    return {
      success: false,
      error: "no platform variable(s)",
    };
  }

  const contentType = request.headers.get("Content-Type");
  if (!fileName || !contentType) {
    console.error("Missing fileName or Content-Type");
    return {
      success: false,
      error: "Missing fileName or Content-Type header",
    };
  }

  if (!request.body) {
    console.error("Request body is empty");
    return {
      success: false,
      error: "Request body is required",
    };
  }

  console.debug("Uploading file:", fileName);
  try {
    const result = await r2.put(fileName, request.body, {
      httpMetadata: { contentType },
    });

    if (!result) {
      console.error("Upload failed: no result returned");
      return { success: false, error: "Upload failed" };
    }

    return {
      success: true,
      etag: result.etag,
    };
  } catch (error) {
    console.error("Upload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}
