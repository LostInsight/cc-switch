import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  CodexModelMappingConfig,
  findInvalidCodexModelMappingEffort,
  findNonStandardCodexModelMappingEffort,
} from "@/components/providers/forms/CodexModelMappingConfig";
import type { ProviderMeta } from "@/types";

type Mapping = NonNullable<ProviderMeta["codexModelMapping"]>;

function ControlledMappingConfig({ initialValue }: { initialValue?: Mapping }) {
  const [value, setValue] = useState<Mapping | undefined>(initialValue);

  return (
    <>
      <CodexModelMappingConfig value={value} onChange={setValue} />
      <output data-testid="model-map">
        {JSON.stringify(value?.modelMap ?? {})}
      </output>
      <output data-testid="effort-map">
        {JSON.stringify(value?.effortMap ?? {})}
      </output>
    </>
  );
}

describe("CodexModelMappingConfig", () => {
  it("keeps a new draft row mounted and focused while both model names are entered", async () => {
    const user = userEvent.setup();
    render(<ControlledMappingConfig />);

    await user.click(screen.getByRole("button", { name: "添加路由" }));

    const source = screen.getByRole("textbox", { name: "显示模型" });
    await user.type(source, "codex-auto-review");
    expect(source).toHaveValue("codex-auto-review");
    expect(source).toHaveFocus();

    const target = screen.getByRole("textbox", { name: "实际模型" });
    await user.type(target, "gpt-5.6-sol");
    expect(target).toHaveValue("gpt-5.6-sol");
    expect(target).toHaveFocus();
    expect(screen.getByTestId("model-map")).toHaveTextContent(
      '{"codex-auto-review":"gpt-5.6-sol"}',
    );
  });

  it("loads and saves effort-specific routes", async () => {
    const user = userEvent.setup();
    render(
      <ControlledMappingConfig
        initialValue={{
          enabled: true,
          modelMap: {},
          effortMap: { "gpt-5.6-terra@max": "gpt-5.6-sol@high" },
        }}
      />,
    );

    const source = screen.getByRole("textbox", { name: "显示模型" });
    const target = screen.getByRole("textbox", { name: "实际模型" });
    expect(source).toHaveValue("gpt-5.6-terra@max");
    expect(target).toHaveValue("gpt-5.6-sol@high");

    await user.clear(target);
    await user.type(target, "gpt-5.6-sol@xhigh");

    expect(screen.getByTestId("model-map")).toHaveTextContent("{}");
    expect(screen.getByTestId("effort-map")).toHaveTextContent(
      '{"gpt-5.6-terra@max":"gpt-5.6-sol@xhigh"}',
    );
  });

  it("allows a nonstandard effort suffix as a custom route with a warning", async () => {
    const user = userEvent.setup();
    render(<ControlledMappingConfig />);

    await user.click(screen.getByRole("button", { name: "添加路由" }));
    await user.type(
      screen.getByRole("textbox", { name: "显示模型" }),
      "gpt-5.6-terra@terra",
    );
    const target = screen.getByRole("textbox", { name: "实际模型" });
    await user.type(target, "gpt-5.6-sol@custom");

    expect(target).toHaveAttribute("aria-invalid", "false");
    expect(screen.getAllByRole("status")[0]).toHaveTextContent("terra");
    expect(screen.getByTestId("model-map")).toHaveTextContent("{}");
    expect(screen.getByTestId("effort-map")).toHaveTextContent(
      '{"gpt-5.6-terra@terra":"gpt-5.6-sol@custom"}',
    );
    expect(
      findInvalidCodexModelMappingEffort({
        enabled: true,
        modelMap: {},
        effortMap: { "gpt-5.6-terra@terra": "gpt-5.6-sol@custom" },
      }),
    ).toBeUndefined();
    expect(
      findNonStandardCodexModelMappingEffort({
        enabled: true,
        modelMap: {},
        effortMap: { "gpt-5.6-terra@terra": "gpt-5.6-sol@custom" },
      }),
    ).toEqual({ effort: "terra", value: "gpt-5.6-terra@terra" });
  });

  it("rejects a structurally incomplete effort suffix", () => {
    render(
      <ControlledMappingConfig
        initialValue={{
          enabled: true,
          modelMap: {},
          effortMap: { "gpt-5.6-terra@max": "gpt-5.6-sol@" },
        }}
      />,
    );

    const target = screen.getByRole("textbox", { name: "实际模型" });
    expect(target).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("路由格式无效");
    expect(
      findInvalidCodexModelMappingEffort({
        enabled: true,
        modelMap: {},
        effortMap: { "gpt-5.6-terra@max": "gpt-5.6-sol@" },
      }),
    ).toEqual({ effort: "(empty)", value: "gpt-5.6-sol@" });
  });
});
