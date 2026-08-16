import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStreamCheck } from "@/hooks/useStreamCheck";

const streamCheckProviderMock = vi.fn();
const resetCircuitBreakerMock = vi.fn();

vi.mock("@/lib/api/connectivity-check", () => ({
  streamCheckProvider: (...args: unknown[]) => streamCheckProviderMock(...args),
}));

vi.mock("@/lib/query/failover", () => ({
  useResetCircuitBreaker: () => ({ mutate: resetCircuitBreakerMock }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, options?: Record<string, unknown>) =>
      options?.defaultValue ?? _key,
  }),
}));

function result(status: "operational" | "degraded" | "failed") {
  return {
    status,
    success: status !== "failed",
    message: status,
    responseTimeMs: 123,
    testedAt: 1,
    retryCount: 0,
  };
}

describe("useStreamCheck", () => {
  beforeEach(() => {
    streamCheckProviderMock.mockReset();
    resetCircuitBreakerMock.mockReset();
  });

  it.each(["operational", "degraded"] as const)(
    "resets the provider circuit after a %s real probe",
    async (status) => {
      streamCheckProviderMock.mockResolvedValue(result(status));
      const { result: hook } = renderHook(() => useStreamCheck("claude"));

      await act(async () => {
        await hook.current.checkProvider("provider-1", "Provider 1");
      });

      expect(resetCircuitBreakerMock).toHaveBeenCalledWith({
        providerId: "provider-1",
        appType: "claude",
      });
    },
  );

  it("does not reset the circuit after a failed probe", async () => {
    streamCheckProviderMock.mockResolvedValue(result("failed"));
    const { result: hook } = renderHook(() => useStreamCheck("codex"));

    await act(async () => {
      await hook.current.checkProvider("provider-2", "Provider 2");
    });

    expect(resetCircuitBreakerMock).not.toHaveBeenCalled();
  });
});
