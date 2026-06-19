import type {
  EditableRuleLibrary,
  LegacyRuleLibrary,
} from "@word-auto/validator";
import {
  analyze,
  FriendlyAnalyzeError,
  type AnalyzeResult,
} from "./analyze.js";
import {
  ANALYZE_WORKER_FAILURE,
  ANALYZE_WORKER_SUCCESS,
  createAnalyzeWorkerRequest,
  isAnalyzeWorkerResponse,
} from "./analyzeWorkerProtocol.js";

type AnalyzeRules = LegacyRuleLibrary | EditableRuleLibrary;

export type AnalyzeWorkerLike = Pick<
  Worker,
  "addEventListener" | "postMessage" | "removeEventListener" | "terminate"
>;

export type AnalyzeWorkerFactory = () => AnalyzeWorkerLike;

let nextRequestId = 1;

const createAnalyzeWorker: AnalyzeWorkerFactory = () =>
  new Worker(new URL("./analyze.worker.ts", import.meta.url), { type: "module" });

const canUseWorker = (factory: AnalyzeWorkerFactory | undefined): boolean =>
  factory != null || typeof Worker !== "undefined";

const getWorkerFactory = (
  factory: AnalyzeWorkerFactory | undefined,
): AnalyzeWorkerFactory => factory ?? createAnalyzeWorker;

export const runAnalyzeWorkerRequest = (
  buffer: ArrayBuffer,
  rules: AnalyzeRules,
  createWorker: AnalyzeWorkerFactory,
): Promise<AnalyzeResult> =>
  new Promise((resolve, reject) => {
    const id = nextRequestId++;
    const worker = createWorker();

    const cleanup = () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      worker.terminate();
    };

    const handleError = (event: ErrorEvent) => {
      cleanup();
      reject(new Error(`检测 Worker 异常：${event.message}`));
    };

    const handleMessage = (event: MessageEvent<unknown>) => {
      if (!isAnalyzeWorkerResponse(event.data) || event.data.id !== id) return;
      cleanup();

      if (event.data.type === ANALYZE_WORKER_SUCCESS) {
        resolve(event.data.result);
        return;
      }
      if (event.data.type === ANALYZE_WORKER_FAILURE) {
        reject(new FriendlyAnalyzeError(event.data.errorMessage));
      }
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    worker.postMessage(createAnalyzeWorkerRequest(id, buffer, rules));
  });

export const analyzeInWorker = async (
  buffer: ArrayBuffer,
  rules: AnalyzeRules,
  createWorker?: AnalyzeWorkerFactory,
): Promise<AnalyzeResult> => {
  if (!canUseWorker(createWorker)) {
    return analyze(buffer, rules);
  }
  return runAnalyzeWorkerRequest(buffer, rules, getWorkerFactory(createWorker));
};
