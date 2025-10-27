// Bucket region type for type safety
type BucketRegion = "eeur" | "weur" | "wnam" | "apac";

type PRESIGNED_API_RESULT =
  | {
      success: true;
      presignedUrl: string;
    }
  | {
      success: false;
      error: string;
    };

type PRESIGNED_API_REQUEST = {
  fileName: string;
  bucket: BucketRegion;
  contentType: string;
  contentLength: number;
};

type BINDING_API_RESULT =
  | {
      success: true;
      etag: string;
    }
  | {
      success: false;
      error: string;
    };

// Upload progress state interface
interface UploadProgress {
  finished: boolean;
  timeTook: number;
  error?: string;
  estimated?: number;
  rate?: number;
}

type MULTIPART_API_MERGE_RESULT =
  | {
      success: true;
      etag: string;
      uploadId: string;
    }
  | {
      success: false;
      error: string;
    };

type MULTIPART_API_UPLOAD_RESULT =
  | {
      success: true;
      uploadId: string;
      multiPart: MULTIPART_COMPLETED_PART;
    }
  | {
      success: false;
      partNumber: number;
      uploadId: string;
      error: string;
    };

type MULTIPART_API_GENERATE_RESULT =
  | {
      success: true;
      uploadId: string;
      key: string;
    }
  | {
      success: false;
      error: string;
      key: string;
    };

type MULTIPART_API_REQUEST = {
  parts: MULTIPART_COMPLETED_PART[];
  uploadId: string;
};

type MULTIPART_COMPLETED_PART = {
  partNumber: number;
  etag: string;
};
