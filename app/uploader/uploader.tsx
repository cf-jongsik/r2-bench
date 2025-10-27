import { useCallback, useRef, useState } from "react";
import { Presigned } from "./presigned/presigned";
import { Binding } from "./binding/binding";
import { Multipart } from "./multipart/multipart";

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function Uploader() {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [bucket, setBucket] = useState<string>("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleSelectedFile = useCallback((f?: File | null): void => {
    if (!f) return;
    setFile(f);
  }, []);

  const onSelectClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0] ?? null;
      handleSelectedFile(f);
    },
    [handleSelectedFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const f = e.dataTransfer.files?.[0] ?? null;
      handleSelectedFile(f);
    },
    [handleSelectedFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  return (
    <div className="max-w-xl mx-auto p-6 bg-white/80 dark:bg-gray-900/60 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Upload file
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
        Select or drag & drop a file to prepare it for upload.
      </p>
      <div className="mt-4">
        <select
          className="w-full p-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={bucket}
          onChange={(e) => setBucket(e.target.value)}
        >
          <option value="">Select a bucket</option>
          <option value="eeur">Eastern EU Bucket</option>
          <option value="weur">Western EU Bucket</option>
          <option value="wnam">Western NA Bucket</option>
          <option value="apac">APAC Bucket</option>
        </select>
      </div>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`mt-4 flex items-center justify-center border-2 border-dashed rounded-md p-6 cursor-pointer transition-colors ${
          dragActive
            ? "border-blue-400 bg-blue-50/40"
            : "border-gray-200 dark:border-gray-700 bg-transparent"
        }`}
        role="button"
        tabIndex={0}
        onClick={onSelectClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onSelectClick();
        }}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={handleChange}
          aria-hidden="true"
        />

        <div className="text-center">
          <svg
            className="mx-auto h-10 w-10 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16v-4a4 4 0 014-4h2a4 4 0 014 4v4m-6-8v8m0 0l-3-3m3 3 3-3"
            />
          </svg>
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            {file ? (
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {file.name}
                </div>
                <div className="text-xs text-gray-500">
                  {formatFileSize(file.size)}
                </div>
              </div>
            ) : (
              <div>
                <div className="font-medium">Click to select</div>
                <div className="text-xs">or drag and drop here</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-3 flex-col">
        <Presigned file={file} bucket={bucket} />
        <Binding file={file} bucket={bucket} />
        <Multipart file={file} bucket={bucket} />
      </div>

      <div className="mt-3 text-xs text-indigo-700">
        This test result is demo purpose only
      </div>
    </div>
  );
}
