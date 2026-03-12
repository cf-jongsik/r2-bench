export interface UploadMetrics {
  startTime: number;
  progress: number;
  error?: string;
  finished: boolean;
  timeTaken?: number;
  uploadRate?: number;
}

export function calculateUploadRate(fileSize: number, timeTakenMs: number): number {
  if (timeTakenMs === 0) return 0;
  return fileSize / (timeTakenMs / 1000);
}

export function formatUploadRate(bytesPerSecond: number): string {
  const mbPerSecond = bytesPerSecond / 1024 / 1024;
  return `${mbPerSecond.toFixed(2)} MB/s`;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatDuration(milliseconds: number): string {
  return (milliseconds / 1000).toFixed(2);
}

export function createAbortController(): AbortController {
  return new AbortController();
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export async function fetchJson<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}
