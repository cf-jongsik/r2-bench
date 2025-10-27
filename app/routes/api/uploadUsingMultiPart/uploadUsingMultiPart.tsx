import type { Route } from "./+types/uploadUsingMultiPart";
import { isValidBucket } from "../../../utils";

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
    console.error("Invalid request method:", request.method);
    return { success: false, error: "Invalid request method", key: fileName };
  }

  if (!bucket || !isValidBucket(bucket)) {
    console.error("Invalid bucket parameter:", bucket);
    return { success: false, error: "Invalid bucket parameter", key: fileName };
  }

  const contentType = request.headers.get("Content-Type");
  if (!contentType) {
    console.error("Missing Content-Type header");
    return {
      success: false,
      error: "Missing Content-Type header",
      key: fileName,
    };
  }
  const r2 = context.cloudflare.env[bucket];
  if (!r2) {
    console.error("Invalid bucket parameter:", bucket);
    return { success: false, error: "Invalid bucket parameter", key: fileName };
  }

  if (request.method === "POST") {
    if (uploadId) {
      if (partNumber) {
        return {
          success: false,
          error: "Invalid request method",
          key: fileName,
        };
      }
      const mergeData: MULTIPART_API_REQUEST = await request.json();
      const uploader = r2.resumeMultipartUpload(fileName, uploadId);
      const mergeResult = await uploader.complete(mergeData.parts);
      if (!mergeResult) {
        console.error("Failed to merge parts");
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

    console.log("creating uploadId");
    const multipartUploadId = await r2.createMultipartUpload(fileName, {
      httpMetadata: { contentType },
    });
    if (!multipartUploadId) {
      console.error("Failed to create uploadId");
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
    console.log("uploading part");
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
      request.body
    );

    if (!res || !res.partNumber) {
      console.error("Failed to upload part", partNumber);
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
}
