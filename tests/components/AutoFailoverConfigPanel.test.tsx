import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AutoFailoverConfigPanel } from "@/components/proxy/AutoFailoverConfigPanel";

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  config: {
    appType: "codex",
    enabled: true,
    autoFailoverEnabled: true,
    maxRetries: 3,
    retryUntilSuccess: false,
    streamingFirstByteTimeout: 60,
    streamingIdleTimeout: 120,
    nonStreamingTimeout: 600,
    circuitFailureThreshold: 4,
    circuitSuccessThreshold: 2,
    circuitTimeoutSeconds: 60,
    circuitErrorRateThreshold: 0.6,
    circuitMinRequests: 10,
  },
}));

vi.mock("@/lib/query/proxy", () => ({
  useAppProxyConfig: () => ({
    data: mocks.config,
    isLoading: false,
    error: null,
  }),
  useUpdateAppProxyConfig: () => ({
    mutateAsync: mocks.mutateAsync,
    isPending: false,
  }),
}));

describe("AutoFailoverConfigPanel", () => {
  it("persists continuous retry and disables the finite retry count while enabled", async () => {
    const user = userEvent.setup();
    render(<AutoFailoverConfigPanel appType="codex" />);

    const continuousRetry = screen.getByRole("switch", {
      name: "持续尝试直到成功或取消",
    });
    const maxRetries = screen.getByLabelText("最大重试次数");

    expect(continuousRetry).not.toBeChecked();
    expect(maxRetries).toBeEnabled();

    // The finite count becomes irrelevant in continuous mode, even if the user
    // cleared it before enabling the switch.
    await user.clear(maxRetries);
    await user.click(continuousRetry);

    await waitFor(() => {
      expect(mocks.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          appType: "codex",
          retryUntilSuccess: true,
          maxRetries: 3,
        }),
      );
    });

    expect(continuousRetry).toBeChecked();
    expect(maxRetries).toBeDisabled();
    expect(
      screen.getByText("持续尝试已启用；最大重试次数在此模式下不生效。"),
    ).toBeVisible();

    expect(mocks.mutateAsync).toHaveBeenCalledTimes(1);
  });
});
