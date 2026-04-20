/**
 * shiftService — Single canonical entry point for shift definition logic.
 *
 * This is a thin façade over the existing modules:
 *   - shiftResolver       (pure, definition-array based resolver)
 *   - shiftTimeUtils      (DB-backed resolution + legacy fallback)
 *   - shiftInstance       (concrete UTC instances with TZ/DST awareness)
 *   - shiftValidation     (weekend / holiday rule checks)
 *
 * New code should import from `@/lib/shiftService` instead of the underlying
 * modules. Existing call sites are intentionally left unchanged for now;
 * migrate incrementally when touching the surrounding code.
 *
 * See ./README.md for the boundary rationale.
 */
import {
  resolveShiftDefinition,
  type ShiftDefinitionRow,
  type ResolveInput,
  type ResolveResult,
  type ShiftTypeName,
  type MatchedTier,
} from "./shiftResolver";
import {
  resolveShiftDefinitionStrict,
  getApplicableShiftTimes,
  getShiftTypeColor,
  getShiftTypeCode,
  type ShiftTimeDefinition,
  type ApplicableShiftTime,
} from "./shiftTimeUtils";
import { buildShiftInstance, type ShiftInstance } from "./shiftInstance";
import { validateWeekendShift, isDateWeekend } from "./shiftValidation";

export const shiftService = {
  /** Pure resolver against a pre-fetched definition array. */
  resolve: resolveShiftDefinition,
  /** DB-backed strict resolver (returns ResolveResult). */
  resolveStrict: resolveShiftDefinitionStrict,
  /** Legacy DB-backed resolver with fallback defaults — UI display path. */
  getTimes: getApplicableShiftTimes,
  /** Build a concrete UTC instance from a definition + date + timezone. */
  expand: buildShiftInstance,
  /** Validate a weekend-typed shift against date + holiday rules. */
  validate: validateWeekendShift,
  /** Synchronous weekday/weekend test for UI filtering. */
  isWeekend: isDateWeekend,
  /** Display helpers. */
  color: getShiftTypeColor,
  code: getShiftTypeCode,
};

export type {
  ShiftDefinitionRow,
  ResolveInput,
  ResolveResult,
  ShiftTypeName,
  MatchedTier,
  ShiftTimeDefinition,
  ApplicableShiftTime,
  ShiftInstance,
};
