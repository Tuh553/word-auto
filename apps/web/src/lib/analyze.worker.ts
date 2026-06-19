import { analyze, getFriendlyAnalyzeErrorMessage } from "./analyze.js";
import {
  createAnalyzeWorkerFailure,
  createAnalyzeWorkerSuccess,
  isAnalyzeWorkerRequest,
} from "./analyzeWorkerProtocol.js";

type AnalyzeWorkerScope = {
  addEventListener: (
    type: "message",
    listener: (event: MessageEvent<unknown>) => void,
  ) => void;
  postMessage: (message: unknown) => void;
};

const workerScope = self as unknown as AnalyzeWorkerScope;

workerScope.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (!isAnalyzeWorkerRequest(event.data)) return;

  const { id, buffer, rules } = event.data;
  try {
    workerScope.postMessage(createAnalyzeWorkerSuccess(id, analyze(buffer, rules)));
  } catch (cause) {
    workerScope.postMessage(
      createAnalyzeWorkerFailure(id, getFriendlyAnalyzeErrorMessage(cause)),
    );
  }
});

export {};
