import { useState, useCallback, useRef } from "react";
import { isValidBucket } from "../../utils";

export function Multipart({
  file,
  bucket,
}: {
  file: File | null;
  bucket: string;
}) {
  const [progress, setProgress] = useState<number>(0);
  const [etag, setEtag] = useState<string | null>(null);
  const [failedPart, setFailedPart] = useState<
    MULTIPART_API_UPLOAD_RESULT[] | null
  >(null);
  const [successPart, setSuccessPart] = useState<
    MULTIPART_COMPLETED_PART[] | null
  >(null);
  const [uploadResult, setUploadResult] = useState<UploadProgress | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const startUpload = useCallback(async () => {
    if (!file || !bucket) return;
    if (!isValidBucket(bucket)) return;

    // Reset state
    setProgress(0);
    setEtag(null);
    const startTime = performance.now();

    if (file.size > 4999 * 1024 * 1024) {
      console.error("File size is too large");
      setUploadResult({
        finished: false,
        timeTook: performance.now() - startTime,
        error: "File size is too large",
      });
      return;
    }
    // Create new abort controller
    abortControllerRef.current = new AbortController();

    const multipartGenerateResponse = await fetch(
      `/api/uploadUsingMultipart/${bucket}/${encodeURIComponent(file.name)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const multipartGenerateResponseData: MULTIPART_API_GENERATE_RESULT =
      await multipartGenerateResponse.json();
    setUploadResult({
      finished: false,
      timeTook: performance.now() - startTime,
      error: "it may takes long to upload, be patient",
    });
    if (!multipartGenerateResponseData.success) {
      console.error(multipartGenerateResponseData.error);
      setUploadResult({
        finished: false,
        timeTook: performance.now() - startTime,
        error: multipartGenerateResponseData.error,
      });
      return;
    }

    const chunkSize = 5 * 1024 * 1024;
    const chunks = Math.ceil(file.size / chunkSize);
    let completed = 0;

    try {
      const batchSize = 30;
      const batchResult: MULTIPART_API_UPLOAD_RESULT[] = [];

      for (let i = 0; i < chunks; i += batchSize) {
        const batchPromises: Promise<MULTIPART_API_UPLOAD_RESULT>[] = [];
        const end = Math.min(i + batchSize, chunks);

        for (let j = i; j < end; j++) {
          const start = j * chunkSize;
          const endPos = Math.min(start + chunkSize, file.size);
          const chunk = file.slice(start, endPos);

          const promise = fetch(
            `/api/uploadUsingMultipart/${bucket}/${encodeURIComponent(
              file.name
            )}/${multipartGenerateResponseData.uploadId}/${j + 1}`,
            {
              method: "PUT",
              headers: {
                "Content-Type": file.type || "application/octet-stream",
              },
              body: chunk,
              signal: abortControllerRef.current?.signal,
            }
          )
            .then((r) => {
              setUploadResult({
                finished: false,
                timeTook: performance.now() - startTime,
                rate:
                  (completed * chunkSize) /
                  ((performance.now() - startTime) / 1000),
              });
              return r.json<MULTIPART_API_UPLOAD_RESULT>();
            })
            .then((data: MULTIPART_API_UPLOAD_RESULT) => {
              if (data.success) {
                completed++;
                setProgress(Number(((completed / chunks) * 100).toFixed(2)));
                setUploadResult({
                  finished: false,
                  timeTook: performance.now() - startTime,
                  rate:
                    (completed * chunkSize) /
                    ((performance.now() - startTime) / 1000),
                });
              }
              return data;
            });
          batchPromises.push(promise);
        }

        const res = await Promise.all(batchPromises);
        batchResult.push(...res);
      }

      const failedData: MULTIPART_API_UPLOAD_RESULT[] = [];
      const successData: MULTIPART_COMPLETED_PART[] = [];
      batchResult.forEach((d) => {
        if (!d.success) {
          failedData.push(d);
          return;
        }
        successData.push(d.multiPart);
      });
      if (failedData.length > 0) {
        console.error(failedData);
        setUploadResult({
          finished: false,
          timeTook: performance.now() - startTime,
          error: "Upload failed",
        });
        setFailedPart(failedData);
        return;
      }
      setSuccessPart(successData);

      const mergeResult = await fetch(
        `/api/uploadUsingMultipart/${bucket}/${encodeURIComponent(file.name)}/${
          multipartGenerateResponseData.uploadId
        }`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            parts: successData,
          }),
        }
      );
      const mergeResultData: MULTIPART_API_MERGE_RESULT =
        await mergeResult.json();
      const finalTime = performance.now();
      if (!mergeResultData.success) {
        console.error(mergeResultData.error);
        setUploadResult({
          finished: false,
          timeTook: finalTime - startTime,
          error: "Upload failed",
        });
        return;
      }

      setEtag(mergeResultData.etag);
      setProgress(100);
      setUploadResult({
        finished: true,
        timeTook: finalTime - startTime,
        rate: file.size / ((finalTime - startTime) / 1000),
      });
      setSuccessPart(successData);
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
        disabled={!file || !bucket || progress >= 100 || progress > 0}
        className={`px-4 py-2 rounded-md text-sm text-white ${
          file && bucket && progress < 100
            ? "bg-blue-600 hover:bg-blue-700"
            : "bg-blue-300/60 cursor-not-allowed"
        }`}
      >
        Start Multipart test
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
        {etag && <div className="mt-2 text-xs text-gray-500">ETag: {etag}</div>}
      </div>
    </div>
  );
}
