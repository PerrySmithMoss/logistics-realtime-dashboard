export interface ErrorDetails {
  field?: string;
  issue: string;
  message: string;
  meta?: Record<string, unknown>;
}
