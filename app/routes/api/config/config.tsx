import type { Route } from "./+types/config";
import { env } from "cloudflare:workers";

export async function action({
  request,
  context,
}: Route.ActionArgs): Promise<CONFIG_API_RESULT> {
  if (request.method !== "GET" && request.method !== "POST") {
    return {
      success: false,
      error: "Method not allowed",
    };
  }

  try {
    const {
      MULTIPART_CHUNK_SIZE,
      MAX_FILE_SIZE_MULTIPART,
      MAX_FILE_SIZE_BINDING,
      MULTIPART_BATCH_SIZE,
    } = env;

    return {
      success: true,
      config: {
        multipartChunkSize: Number(MULTIPART_CHUNK_SIZE),
        maxFileSizeMultipart: Number(MAX_FILE_SIZE_MULTIPART),
        maxFileSizeBinding: Number(MAX_FILE_SIZE_BINDING),
        multipartBatchSize: Number(MULTIPART_BATCH_SIZE),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: "Failed to load configuration",
    };
  }
}
