import { useState, useRef, useCallback } from "react";
import axios from "axios";
import { isValidBucket } from "~/utils";
import {
  calculateUploadRate,
  formatUploadRate,
  formatDuration,
  isAbortError,
} from "$lib/upload-utils";

export function PresignedComponent({ file, bucket }: PresignedProps) {
  const [progress, setProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<UploadProgress | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const startUpload = useCallback(async () => {
    if (!file || !bucket || !isValidBucket(bucket)) return;

    setIsUploading(true);
    setProgress(0);
    const startTime = performance.now();
    abortControllerRef.current = new AbortController();

    try {
      const payload: PRESIGNED_API_REQUEST = {
        fileName: file.name,
        bucket: bucket as BucketRegion,
        contentType: file.type || "application/octet-stream",
        contentLength: file.size,
      };

      const presignedResponse = await fetch("/api/getPreSignedUrl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: abortControllerRef.current.signal,
      });

      if (!presignedResponse.ok) {
        throw new Error(`HTTP ${presignedResponse.status}`);
      }

      const json: PRESIGNED_API_RESULT = await presignedResponse.json();

      if (!json.success) {
        setUploadResult({
          finished: false,
          timeTook: performance.now() - startTime,
          error: json.error,
        });
        return;
      }

      await axios.put(json.presignedUrl, file, {
        headers: { "Content-Type": file.type || "application/octet-stream" },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.progress !== undefined) {
            const currentProgress = parseFloat(
              (progressEvent.progress * 100).toFixed(2),
            );
            setProgress(currentProgress);
            setUploadResult({
              finished: false,
              timeTook: parseFloat((performance.now() - startTime).toFixed(2)),
              estimated: progressEvent.estimated
                ? Math.round(progressEvent.estimated)
                : undefined,
              rate: progressEvent.rate,
            });
          }
        },
      });

      const finalTime = performance.now();
      const timeTaken = finalTime - startTime;
      const rate = calculateUploadRate(file.size, timeTaken);

      setProgress(100);
      setUploadResult({
        finished: true,
        timeTook: timeTaken,
        rate,
      });
    } catch (error) {
      if (isAbortError(error)) {
        setUploadResult({
          finished: false,
          timeTook: performance.now() - startTime,
          error: "Upload cancelled",
        });
      } else {
        const errorMessage =
          error instanceof Error ? error.message : "Upload failed";
        setUploadResult({
          finished: false,
          timeTook: performance.now() - startTime,
          error: errorMessage,
        });
      }
      setProgress(0);
    } finally {
      setIsUploading(false);
      abortControllerRef.current = null;
    }
  }, [file, bucket]);

  const cancelUpload = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setProgress(0);
    setIsUploading(false);
  }, []);

  const isComplete = progress === 100;
  const canStart = Boolean(file && bucket && !isUploading);

  return (
    <div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={startUpload}
          disabled={!canStart}
          className={`px-4 py-2 rounded-md text-sm text-white ${
            canStart
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-blue-300/60 cursor-not-allowed"
          }`}
        >
          Start Pre-Signed-Url test
        </button>
        {isUploading && (
          <button
            type="button"
            onClick={cancelUpload}
            className="px-4 py-2 rounded-md text-sm bg-red-600 text-white hover:bg-red-700"
          >
            Cancel
          </button>
        )}
      </div>
      <div className="mt-4 w-full">
        <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-3 overflow-hidden">
          <div
            className="bg-blue-500 h-3 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        {uploadResult?.error && (
          <div className="mt-2 text-xs text-red-500">{uploadResult.error}</div>
        )}
        <div className="mt-2 flex flex-col gap-1 text-xs text-gray-500">
          <div className="flex justify-between font-medium text-gray-700 dark:text-gray-300">
            <span>
              {isComplete && uploadResult?.finished
                ? "Upload Complete"
                : isUploading
                  ? progress === 100
                    ? "Finalizing..."
                    : "Uploading..."
                  : progress > 0
                    ? "Cancelled / Failed"
                    : "Ready"}
            </span>
            {isUploading && <span>{progress.toFixed(2)}%</span>}
          </div>

          {uploadResult?.finished && file?.name && <div>File: {file.name}</div>}
          {uploadResult?.timeTook !== undefined && (
            <div>
              Time taken: {formatDuration(uploadResult.timeTook)} seconds
            </div>
          )}
          {uploadResult?.estimated !== undefined && isUploading && (
            <div>
              Estimated time remaining: {uploadResult.estimated} seconds
            </div>
          )}
          {uploadResult?.rate && (
            <div>Speed: {formatUploadRate(uploadResult.rate)}</div>
          )}
        </div>
      </div>
    </div>
  );
}
