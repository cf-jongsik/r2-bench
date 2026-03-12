import type { Route } from "./+types/getPreSignedUrl";
import { AwsClient } from "aws4fetch";
import { validatePresignedRequest, CONSTANTS } from "$lib/validation";
import { logError } from "$lib/errors";

const BUCKET_NAME_MAP: Record<BucketRegion, string> = {
  eeur: "PRESIGNED_EEUR_BUCKET_NAME",
  weur: "PRESIGNED_WEUR_BUCKET_NAME",
  wnam: "PRESIGNED_WNAM_BUCKET_NAME",
  apac: "PRESIGNED_APAC_BUCKET_NAME",
};

export async function action({
  request,
  context,
}: Route.ActionArgs): Promise<PRESIGNED_API_RESULT> {
  if (request.method !== "POST") {
    return {
      success: false,
      error: "Method not allowed",
    };
  }

  const env = context.cloudflare.env as unknown as Record<string, string>;
  const {
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    CF_ACCOUNT_ID,
    PRESIGNED_APAC_BUCKET_NAME,
    PRESIGNED_EEUR_BUCKET_NAME,
    PRESIGNED_WEUR_BUCKET_NAME,
    PRESIGNED_WNAM_BUCKET_NAME,
  } = env;

  if (
    !R2_ACCESS_KEY_ID ||
    !R2_SECRET_ACCESS_KEY ||
    !CF_ACCOUNT_ID ||
    !PRESIGNED_APAC_BUCKET_NAME ||
    !PRESIGNED_EEUR_BUCKET_NAME ||
    !PRESIGNED_WEUR_BUCKET_NAME ||
    !PRESIGNED_WNAM_BUCKET_NAME
  ) {
    logError("getPreSignedUrl", "Missing required environment variables");
    return {
      success: false,
      error: "Server configuration error",
    };
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    logError("getPreSignedUrl", "Failed to parse request body");
    return {
      success: false,
      error: "Invalid JSON payload",
    };
  }

  const validation = validatePresignedRequest(payload);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
    };
  }

  const { fileName, bucket, contentType, contentLength } = validation.data;

  const envVarName = BUCKET_NAME_MAP[bucket];
  const bucketName =
    context.cloudflare.env[envVarName as keyof typeof context.cloudflare.env];

  if (!bucketName) {
    logError(
      "getPreSignedUrl",
      `Bucket environment variable not found: ${envVarName}`,
    );
    return {
      success: false,
      error: "Server configuration error",
    };
  }

  const targetUrl = `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucketName}/${fileName}`;

  try {
    const client = new AwsClient({
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      region: "auto",
    });

    const presignedUrl = `${targetUrl}?X-Amz-Expires=${CONSTANTS.PRESIGNED_URL_EXPIRY}`;
    const signedUrl = await client.sign(
      new Request(presignedUrl, {
        method: "PUT",
        headers: {
          "content-type": contentType,
          "content-length": contentLength.toString(),
        },
      }),
      {
        aws: { signQuery: true },
      },
    );

    if (!signedUrl) {
      logError("getPreSignedUrl", "Failed to generate presigned URL");
      return {
        success: false,
        error: "Failed to generate presigned URL",
      };
    }

    return {
      success: true,
      presignedUrl: signedUrl.url,
    };
  } catch (error) {
    logError("getPreSignedUrl", error);
    return {
      success: false,
      error: "Failed to generate presigned URL",
    };
  }
}
