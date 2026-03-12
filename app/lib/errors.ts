export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(400, message, details);
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = "Missing or invalid credentials") {
    super(401, message);
    this.name = "AuthenticationError";
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = "Resource not found") {
    super(404, message);
    this.name = "NotFoundError";
  }
}

export class InternalServerError extends ApiError {
  constructor(message: string = "Internal server error", details?: unknown) {
    super(500, message, details);
    this.name = "InternalServerError";
  }
}

export function handleError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalServerError(error.message, {
      originalError: error.name,
    });
  }

  return new InternalServerError("An unexpected error occurred");
}

export function createErrorResponse(error: ApiError): Record<string, unknown> {
  const response: Record<string, unknown> = {
    success: false,
    error: error.message,
  };

  if (error.details) {
    response.details = error.details;
  }

  return response;
}

export function logError(context: string, error: unknown): void {
  const timestamp = new Date().toISOString();
  if (error instanceof Error) {
    console.error(`[${timestamp}] ${context}:`, error.message);
  } else {
    console.error(`[${timestamp}] ${context}:`, error);
  }
}
