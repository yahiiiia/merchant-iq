import { AuthApiError } from "@supabase/supabase-js";

export function errorMessage(error: unknown): string {
  if (error instanceof AuthApiError) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return "The request could not be completed. Please try again.";
}
