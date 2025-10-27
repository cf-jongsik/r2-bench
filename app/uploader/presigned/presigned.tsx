import { useState, useRef, useCallback } from "react";
import axios from "axios";
import { isValidBucket } from "../../utils";

export function Presigned({
  file,
  bucket,
}: {
  file: File | null;
  bucket: string;
}) {
  const [progress, setProgress] = useState<number>(0);
  const [uploadResult, setUploadResult] = useState<UploadProgress | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const startUpload = useCallback(async () => {
    if (!file || !bucket) return;
    if (!isValidBucket(bucket)) return;

    // Reset state
    setProgress(0);
    const startTime = performance.now();

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    try {
      // Step 1: Get presigned URL
      const payload: PRESIGNED_API_REQUEST = {
        fileName: file.name,
        bucket: bucket as BucketRegion,
        contentType: file.type || "application/octet-stream",
        contentLength: file.size,
      };

      const presignedResponse = await fetch("/api/getPreSignedUrl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: abortControllerRef.current.signal,
      });

      if (!presignedResponse.ok) {
        throw new Error(
          `Failed to get presigned URL: ${presignedResponse.status}`
        );
      }

      const json: PRESIGNED_API_RESULT = await presignedResponse.json();

      if (!json.success) {
        console.error("Failed to get presigned URL:", json.error);
        setUploadResult({
          finished: false,
          timeTook: performance.now() - startTime,
          error: json.error,
        });
        return;
      }

      try {
        await axios.put(json.presignedUrl, file, {
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.progress) {
              const progress = Math.round(progressEvent.progress * 100);
              setProgress(progress);
              setUploadResult({
                finished: false,
                timeTook: performance.now() - startTime,
                estimated: progressEvent.estimated,
                rate: progressEvent.rate,
              });
            }
          },
        });
        const finalTime = performance.now();
        setProgress(100);
        setUploadResult({
          finished: true,
          timeTook: finalTime - startTime,
          rate: file.size / ((finalTime - startTime) / 1000),
        });
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === "AbortError") {
            console.log("Upload cancelled by user");
            setUploadResult({
              finished: false,
              timeTook: performance.now() - startTime,
              error: "Upload cancelled",
            });
          } else {
            console.error("Upload failed:", error);
            setUploadResult({
              finished: false,
              timeTook: performance.now() - startTime,
              error: error.message,
            });
          }
        }
        setProgress(0);
      }
    } finally {
      abortControllerRef.current = null;
    }
  }, [file, bucket]);

  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setProgress(0);
  }, []);

  return (
    <div>
      <button
        type="button"
        onClick={startUpload}
        disabled={!file || !bucket || progress >= 100}
        className={`px-4 py-2 rounded-md text-sm text-white ${
          file && bucket && progress < 100
            ? "bg-blue-600 hover:bg-blue-700"
            : "bg-blue-300/60 cursor-not-allowed"
        }`}
      >
        Start Pre-Signed-Url test
      </button>
      <button
        type="button"
        onClick={cancelUpload}
        hidden={progress === 0 || progress >= 100}
        className={`px-4 py-2 rounded-md text-sm ${
          progress > 0 && progress < 100
            ? "bg-red-600 text-white hover:bg-red-700"
            : "bg-gray-200 text-gray-500 cursor-not-allowed"
        }`}
      >
        Cancel
      </button>
      <div className="mt-4 w-full">
        <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-3 overflow-hidden">
          <div
            className="bg-blue-500 h-3 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-red-500">
          {uploadResult?.error && uploadResult.error}
        </div>
        <div className="mt-2 text-xs text-gray-500">
          {progress !== 100 && progress + "%"}{" "}
          {uploadResult?.finished ? file?.name + " uploaded" : ""}
          <br />
          {uploadResult?.timeTook
            ? (uploadResult.timeTook / 1000).toFixed(2) + " seconds"
            : ""}
          <br />
          {uploadResult?.estimated
            ? "Estimated: " + uploadResult.estimated.toFixed(2) + " seconds"
            : ""}
          <br />
          {uploadResult?.rate
            ? "Rate: " +
              (uploadResult.rate / 1024 / 1024).toFixed(2) +
              " megabytes/second"
            : ""}
        </div>
      </div>
    </div>
  );
}
