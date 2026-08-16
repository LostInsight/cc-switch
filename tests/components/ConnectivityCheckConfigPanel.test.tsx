import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectivityCheckConfigPanel } from "@/components/usage/ConnectivityCheckConfigPanel";

const getStreamCheckConfigMock = vi.fn();
const saveStreamCheckConfigMock = vi.fn();

vi.mock("@/lib/api/connectivity-check", () => ({
  getStreamCheckConfig: (...args: unknown[]) =>
    getStreamCheckConfigMock(...args),
  saveStreamCheckConfig: (...args: unknown[]) =>
    saveStreamCheckConfigMock(...args),
}));

describe("ConnectivityCheckConfigPanel", () => {
  beforeEach(() => {
    getStreamCheckConfigMock.mockReset();
    saveStreamCheckConfigMock.mockReset();
    getStreamCheckConfigMock.mockResolvedValue({
      timeoutSecs: 45,
      maxRetries: 2,
      degradedThresholdMs: 6000,
      claudeModel: "claude-test",
      codexModel: "codex-test",
      geminiModel: "gemini-test",
      testPrompt: "Legacy prompt",
      testPrompts: ["Check {yyyyMMdd}"],
    });
    saveStreamCheckConfigMock.mockResolvedValue(undefined);
  });

  it("loads, adds, and saves rotating prompt templates without dropping model settings", async () => {
    const user = userEvent.setup();
    render(<ConnectivityCheckConfigPanel />);

    expect(await screen.findByLabelText("提示词 1")).toHaveValue(
      "Check {yyyyMMdd}",
    );

    const claudeModel = screen.getByLabelText("Claude 测试模型");
    const codexModel = screen.getByLabelText("Codex 测试模型");
    const geminiModel = screen.getByLabelText("Gemini 测试模型");
    expect(claudeModel).toHaveValue("claude-test");
    expect(codexModel).toHaveValue("codex-test");
    expect(geminiModel).toHaveValue("gemini-test");

    await user.clear(claudeModel);
    await user.type(claudeModel, "claude-updated");
    await user.clear(codexModel);
    await user.type(codexModel, "codex-updated");
    await user.clear(geminiModel);
    await user.type(geminiModel, "gemini-updated");

    await user.click(screen.getByRole("button", { name: "添加提示词" }));
    fireEvent.change(screen.getByLabelText("提示词 2"), {
      target: { value: "Nonce {random[1-100]}" },
    });
    await user.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => {
      expect(saveStreamCheckConfigMock).toHaveBeenCalledWith({
        timeoutSecs: 45,
        maxRetries: 2,
        degradedThresholdMs: 6000,
        claudeModel: "claude-updated",
        codexModel: "codex-updated",
        geminiModel: "gemini-updated",
        testPrompt: "Check {yyyyMMdd}",
        testPrompts: ["Check {yyyyMMdd}", "Nonce {random[1-100]}"],
      });
    });
  });
});
