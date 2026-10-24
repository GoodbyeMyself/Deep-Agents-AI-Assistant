export class ServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export const notFound = () => new ServiceError("NOT_FOUND", "Resource not found.", 404);
export const forbidden = () => new ServiceError("FORBIDDEN", "Access denied.", 403);
