import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  ProviderFailoverPolicySection,
  type HttpStatusOverrides,
} from "@/components/providers/forms/ProviderAdvancedConfig";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

function PolicyHarness() {
  const [value, setValue] = useState<HttpStatusOverrides>({});
  return <ProviderFailoverPolicySection value={value} onChange={setValue} />;
}

describe("ProviderFailoverPolicySection", () => {
  it("edits common statuses and adds custom 400-599 statuses", async () => {
    const user = userEvent.setup();
    render(<PolicyHarness />);

    await user.click(
      screen.getByRole("button", { name: "故障转移 HTTP 状态覆盖" }),
    );
    const status400 = screen.getByLabelText("HTTP 400");
    await user.click(status400);
    await user.click(screen.getByRole("option", { name: "继续下一家" }));
    expect(status400).toHaveTextContent("继续下一家");

    await user.type(screen.getByLabelText("自定义 HTTP 状态"), "529");
    await user.click(screen.getByRole("button", { name: "添加 HTTP 状态" }));
    expect(screen.getByLabelText("HTTP 529")).toHaveTextContent("继续下一家");
  });

  it("rejects custom statuses outside the HTTP error range", async () => {
    const user = userEvent.setup();
    render(<PolicyHarness />);

    await user.click(
      screen.getByRole("button", { name: "故障转移 HTTP 状态覆盖" }),
    );
    await user.type(screen.getByLabelText("自定义 HTTP 状态"), "399");
    await user.click(screen.getByRole("button", { name: "添加 HTTP 状态" }));

    expect(screen.getByText("HTTP 状态码必须是 400 到 599。")).toBeVisible();
    expect(screen.queryByLabelText("HTTP 399")).toBeNull();
  });
});
