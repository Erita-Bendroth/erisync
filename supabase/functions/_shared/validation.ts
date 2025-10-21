// Shared validation utilities for edge functions
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Email validation schema
export const emailSchema = z.string().email().max(254);

// Password validation schema (matches frontend requirements)
export const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password too long")
  .regex(/[A-Z]/, "Must contain uppercase letter")
  .regex(/[a-z]/, "Must contain lowercase letter")
  .regex(/\d/, "Must contain number")
  .regex(/[!@#$%^&*(),.?":{}|<>]/, "Must contain special character");

// Text field schemas
export const shortTextSchema = z.string().trim().min(1).max(100);
export const mediumTextSchema = z.string().trim().min(1).max(500);
export const longTextSchema = z.string().trim().max(2000);
export const initialsSchema = z.string().trim().min(1).max(10);

// UUID validation
export const uuidSchema = z.string().uuid();

// Role validation
export const roleSchema = z.enum(['admin', 'planner', 'manager', 'teammember']);

// Country code validation
export const countryCodeSchema = z.string().length(2).toUpperCase();

// Year validation
export const yearSchema = z.number().int().min(1900).max(2100);

// Generic error sanitizer
export function sanitizeError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return "Invalid input: " + error.errors.map(e => e.message).join(", ");
  }
  
  // Don't expose internal error details
  console.error("Internal error:", error);
  return "Operation failed. Please try again.";
}

// Safe error response helper
export function errorResponse(message: string, status: number = 400, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Success response helper
export function successResponse(data: unknown, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify(data),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
