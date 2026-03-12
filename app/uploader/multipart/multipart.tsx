import { useState, useCallback, useRef, useEffect } from "react";
import axios from "axios";
import { isValidBucket } from "~/utils";
import {
  calculateUploadRate,
  formatUploadRate,
  formatDuration,
  isAbortError,
} from "$lib/upload-utils";

export function MultipartComponent({ file, bucket }: MultipartProps) {
  const [progress, setProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [etag, setEtag] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadProgress | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const chunkProgressRef = useRef<number[]>([]);
  const chunkSize = config?.multipartChunkSize ?? 8 * 1024 * 1024;
  const [totalChunks, setTotalChunks] = useState<number | null>(null);
  const [totalBytes, setTotalBytes] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/config", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        const response = data as ConfigResponse;
        if (response.success) {
          setConfig(response.config);
        } else {
          setConfigError(response.error);
        }
      })
      .catch(() => {
        setConfigError("Failed to load configuration");
      });
  }, []);

  const startUpload = useCallback(async () => {
    if (!file || !bucket || !isValidBucket(bucket) || !config) return;

    setIsUploading(true);
    setProgress(0);
    setEtag(null);
    setTotalChunks(0);
    const startTime = performance.now();

    if (file.size > config.maxFileSizeMultipart) {
      setUploadResult({
        finished: false,
        timeTook: performance.now() - startTime,
        error: `File size exceeds ${(config.maxFileSizeMultipart / 1024 / 1024).toFixed(0)}MB limit`,
      });
      return;
    }

    abortControllerRef.current = new AbortController();

    const multipartGenerateResponse = await fetch(
      `/api/uploadUsingMultipart/${bucket}/${encodeURIComponent(file.name)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const multipartGenerateResponseData: MULTIPART_API_GENERATE_RESULT =
      await multipartGenerateResponse.json();
    setUploadResult({
      finished: false,
      timeTook: performance.now() - startTime,
    });
    if (!multipartGenerateResponseData.success) {
      console.error(multipartGenerateResponseData.error);
      setUploadResult({
        finished: false,
        timeTook: performance.now() - startTime,
      });
      return;
    }

    const chunks = Math.ceil(file.size / chunkSize);
    const totalBytes = file.size;
    let completed = 0;
    chunkProgressRef.current = new Array(chunks).fill(0);
    setTotalChunks(chunks);
    setTotalBytes(totalBytes);

    try {
      const batchResult: MULTIPART_API_UPLOAD_RESULT[] = [];

      for (let i = 0; i < chunks; i += config.multipartBatchSize) {
        const batchPromises: Promise<MULTIPART_API_UPLOAD_RESULT>[] = [];
        const end = Math.min(i + config.multipartBatchSize, chunks);

        for (let j = i; j < end; j++) {
          const start = j * chunkSize;
          const endPos = Math.min(start + chunkSize, file.size);
          const chunk = file.slice(start, endPos);

          const promise = axios
            .put<MULTIPART_API_UPLOAD_RESULT>(
              `/api/uploadUsingMultipart/${bucket}/${encodeURIComponent(
                file.name,
              )}/${multipartGenerateResponseData.uploadId}/${j + 1}`,
              chunk,
              {
                headers: {
                  "Content-Type": file.type || "application/octet-stream",
                },
                signal: abortControllerRef.current?.signal,
                onUploadProgress: (progressEvent) => {
                  if (progressEvent.loaded !== undefined) {
                    chunkProgressRef.current[j] = progressEvent.loaded;
                    const totalLoaded = chunkProgressRef.current.reduce(
                      (a, b) => a + b,
                      0,
                    );
                    const timeTaken = performance.now() - startTime;
                    const rate = calculateUploadRate(totalLoaded, timeTaken);
                    const currentProgress = Number(
                      ((totalLoaded / file.size) * 100).toFixed(2),
                    );

                    const remainingBytes = file.size - totalLoaded;
                    const estimated =
                      rate > 0 ? Math.round(remainingBytes / rate) : undefined;

                    if (abortControllerRef.current !== null) {
                      setProgress(currentProgress);
                      setUploadResult({
                        finished: false,
                        timeTook: timeTaken,
                        rate,
                        estimated,
                      });
                      setTotalChunks(totalChunks);
                    }
                  }
                },
              },
            )
            .then((res) => {
              if (res.data.success) {
                completed++;
              }
              return res.data;
            });
          batchPromises.push(promise);
        }

        const res = await Promise.all(batchPromises);
        batchResult.push(...res);
      }

      const failedData: MULTIPART_API_UPLOAD_RESULT[] = [];
      const successData: R2UploadedPart[] = [];

      batchResult.forEach((d) => {
        if (!d.success) {
          failedData.push(d);
        } else {
          successData.push(d.multiPart);
        }
      });

      if (failedData.length > 0) {
        setUploadResult({
          finished: false,
          timeTook: performance.now() - startTime,
          error: `${failedData.length} part(s) failed to upload`,
        });
        return;
      }

      const mergeResult = await axios.post<MULTIPART_API_MERGE_RESULT>(
        `/api/uploadUsingMultipart/${bucket}/${encodeURIComponent(file.name)}/${
          multipartGenerateResponseData.uploadId
        }`,
        successData,
        {
          headers: { "Content-Type": "application/json" },
        },
      );

      const mergeResultData: MULTIPART_API_MERGE_RESULT = mergeResult.data;
      const finalTime = performance.now();

      if (!mergeResultData.success) {
        setUploadResult({
          finished: false,
          timeTook: finalTime - startTime,
          error: "Failed to finalize upload",
        });
        return;
      }

      const timeTaken = finalTime - startTime;
      const rate = calculateUploadRate(file.size, timeTaken);

      setEtag(mergeResultData.etag);
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
  const canStart = Boolean(
    file && bucket && !isUploading && config && !configError,
  );

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
          Start Multipart test
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
          {totalBytes !== null && (
            <div>
              Total bytes: {Math.ceil(totalBytes / 1024 / 1024)} megabytes
            </div>
          )}
          {
            <div>
              Chunk size: {Math.ceil(chunkSize / 1024 / 1024)} megabytes
            </div>
          }
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
        {etag && <div className="mt-2 text-xs text-gray-500">ETag: {etag}</div>}
      </div>
    </div>
  );
}
