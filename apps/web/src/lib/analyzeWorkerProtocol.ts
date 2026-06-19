import type {
  EditableRuleLibrary,
  LegacyRuleLibrary,
} from "@word-auto/validator";
import type { AnalyzeResult } from "./analyze.js";

const ANALYZE_WORKER_REQUEST = "word-auto/analyze/request";
export const ANALYZE_WORKER_SUCCESS = "word-auto/analyze/success";
export const ANALYZE_WORKER_FAILURE = "word-auto/analyze/failure";

export type AnalyzeWorkerRequest = {
  type: typeof ANALYZE_WORKER_REQUEST;
  id: number;
  buffer: ArrayBuffer;
  rules: LegacyRuleLibrary | EditableRuleLibrary;
};

export type AnalyzeWorkerSuccess = {
  type: typeof ANALYZE_WORKER_SUCCESS;
  id: number;
  result: AnalyzeResult;
};

export type AnalyzeWorkerFailure = {
  type: typeof ANALYZE_WORKER_FAILURE;
  id: number;
  errorMessage: string;
};

export type AnalyzeWorkerResponse = AnalyzeWorkerSuccess | AnalyzeWorkerFailure;

export const createAnalyzeWorkerRequest = (
  id: number,
  buffer: ArrayBuffer,
  rules: LegacyRuleLibrary | EditableRuleLibrary,
): AnalyzeWorkerRequest => ({
  type: ANALYZE_WORKER_REQUEST,
  id,
  buffer,
  rules,
});

export const createAnalyzeWorkerSuccess = (
  id: number,
  result: AnalyzeResult,
): AnalyzeWorkerSuccess => ({
  type: ANALYZE_WORKER_SUCCESS,
  id,
  result,
});

export const createAnalyzeWorkerFailure = (
  id: number,
  errorMessage: string,
): AnalyzeWorkerFailure => ({
  type: ANALYZE_WORKER_FAILURE,
  id,
  errorMessage,
});

export const isAnalyzeWorkerRequest = (
  value: unknown,
): value is AnalyzeWorkerRequest =>
  typeof value === "object" &&
  value !== null &&
  "type" in value &&
  value.type === ANALYZE_WORKER_REQUEST;

export const isAnalyzeWorkerResponse = (
  value: unknown,
): value is AnalyzeWorkerResponse =>
  typeof value === "object" &&
  value !== null &&
  "type" in value &&
  (value.type === ANALYZE_WORKER_SUCCESS ||
    value.type === ANALYZE_WORKER_FAILURE);
