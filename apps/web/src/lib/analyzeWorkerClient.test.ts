import { test } from "node:test";
import assert from "node:assert/strict";
import type { EditableRuleLibrary } from "@word-auto/validator";
import { FriendlyAnalyzeError, getFriendlyAnalyzeErrorMessage } from "./analyze.js";
import {
  runAnalyzeWorkerRequest,
  type AnalyzeWorkerLike,
} from "./analyzeWorkerClient.js";
import {
  ANALYZE_WORKER_FAILURE,
  createAnalyzeWorkerFailure,
  createAnalyzeWorkerSuccess,
  isAnalyzeWorkerRequest,
} from "./analyzeWorkerProtocol.js";
import type { AnalyzeResult } from "./analyze.js";

type Listener = (event: MessageEvent<unknown>) => void;

const SAMPLE_RESULT = {
  model: { paragraphs: [{ text: "正文" }] },
  report: { issues: [] },
} as unknown as AnalyzeResult;

const SAMPLE_RULES = {
  id: "sample",
  name: "示例模板",
  version: "1.0.0",
  roles: [],
} satisfies EditableRuleLibrary;

class FakeWorker {
  terminated = false;
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(readonly onPost: (value: unknown, worker: FakeWorker) => void) {}

  addEventListener(type: string, listener: Listener): void {
    const listeners = this.listeners.get(type) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  postMessage(value: unknown): void {
    this.onPost(value, this);
  }

  terminate(): void {
    this.terminated = true;
  }

  emitMessage(data: unknown): void {
    for (const listener of this.listeners.get("message") ?? []) {
      listener({ data } as MessageEvent<unknown>);
    }
  }
}

test("runAnalyzeWorkerRequest：发送 ArrayBuffer 和规则库，接收检测结果", async () => {
  const buffer = new ArrayBuffer(8);
  let postedRequest: unknown;
  const worker = new FakeWorker((value, currentWorker) => {
    postedRequest = value;
    assert.ok(isAnalyzeWorkerRequest(value));
    currentWorker.emitMessage(createAnalyzeWorkerSuccess(value.id, SAMPLE_RESULT));
  });

  const result = await runAnalyzeWorkerRequest(
    buffer,
    SAMPLE_RULES,
    () => worker as unknown as AnalyzeWorkerLike,
  );

  assert.equal(result, SAMPLE_RESULT);
  assert.ok(isAnalyzeWorkerRequest(postedRequest));
  assert.equal(postedRequest.buffer, buffer);
  assert.equal(postedRequest.rules, SAMPLE_RULES);
  assert.equal(worker.terminated, true);
});

test("runAnalyzeWorkerRequest：失败响应透传已分流的中文错误", async () => {
  const worker = new FakeWorker((value, currentWorker) => {
    assert.ok(isAnalyzeWorkerRequest(value));
    currentWorker.emitMessage(createAnalyzeWorkerFailure(value.id, "文档文件已损坏"));
  });

  await assert.rejects(
    runAnalyzeWorkerRequest(
      new ArrayBuffer(0),
      SAMPLE_RULES,
      () => worker as unknown as AnalyzeWorkerLike,
    ),
    (error) =>
      error instanceof FriendlyAnalyzeError &&
      getFriendlyAnalyzeErrorMessage(error) === "文档文件已损坏",
  );
});

test("runAnalyzeWorkerRequest：忽略其他请求的 Worker 响应", async () => {
  const worker = new FakeWorker((value, currentWorker) => {
    assert.ok(isAnalyzeWorkerRequest(value));
    currentWorker.emitMessage({
      type: ANALYZE_WORKER_FAILURE,
      id: value.id + 1,
      errorMessage: "其他请求失败",
    });
    currentWorker.emitMessage(createAnalyzeWorkerSuccess(value.id, SAMPLE_RESULT));
  });

  const result = await runAnalyzeWorkerRequest(
    new ArrayBuffer(4),
    SAMPLE_RULES,
    () => worker as unknown as AnalyzeWorkerLike,
  );

  assert.equal(result, SAMPLE_RESULT);
});
