import type { Route } from "./+types/getPreSignedUrl";
import { AwsClient } from "aws4fetch";
import { isValidBucket } from "../../../utils";

export async function action({
  request,
  context,
}: Route.ActionArgs): Promise<PRESIGNED_API_RESULT> {
  if (request.method !== "POST") {
    console.error("Method not allowed: expected POST");
    return {
      success: false,
      error: "Method not allowed",
    };
  }
  const {
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    CF_ACCOUNT_ID,
    PRESIGNED_APAC_BUCKET_NAME,
    PRESIGNED_EEUR_BUCKET_NAME,
    PRESIGNED_WEUR_BUCKET_NAME,
    PRESIGNED_WNAM_BUCKET_NAME,
  } = context.cloudflare.env;
  if (
    !R2_ACCESS_KEY_ID ||
    !R2_SECRET_ACCESS_KEY ||
    !CF_ACCOUNT_ID ||
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
  let payload: PRESIGNED_API_REQUEST;
  try {
    payload = await request.json<PRESIGNED_API_REQUEST>();
  } catch (error) {
    console.error("Failed to parse request body:", error);
    return {
      success: false,
      error: "Invalid JSON payload",
    };
  }

  const { fileName, bucket, contentType, contentLength } = payload;

  if (!fileName || !bucket || !contentType || !contentLength) {
    console.error("Missing required fields in payload");
    return {
      success: false,
      error:
        "Missing required fields: fileName, bucket, contentType, contentLength",
    };
  }

  if (!isValidBucket(bucket)) {
    console.error("Invalid bucket:", bucket);
    return {
      success: false,
      error: `Invalid bucket. Must be one of: eeur, weur, wnam, apac`,
    };
  }

  // Map bucket region to environment variable
  const bucketNameMap: Record<BucketRegion, string> = {
    eeur: PRESIGNED_EEUR_BUCKET_NAME,
    weur: PRESIGNED_WEUR_BUCKET_NAME,
    wnam: PRESIGNED_WNAM_BUCKET_NAME,
    apac: PRESIGNED_APAC_BUCKET_NAME,
  };
  const bucketName = bucketNameMap[bucket];

  const URL = `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucketName}/${fileName}`;

  console.debug("Presigned target URL", URL);
  const client = new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    region: "auto",
  });

  const url = `${URL}?X-Amz-Expires=${3600}`;
  const signedUrl = await client.sign(
    new Request(url, {
      method: "PUT",
      headers: {
        "content-type": contentType,
        "content-length": contentLength.toString(),
      },
    }),
    {
      aws: { signQuery: true },
    }
  );

  if (!signedUrl) {
    console.error("Failed to generate presigned URL");
    return {
      success: false,
      error: "Failed to generate presigned URL",
    };
  }
  console.debug("signedUrl", signedUrl.url);

  return {
    success: true,
    presignedUrl: signedUrl.url,
  };
}
