import { describe, expect, it } from "vitest";
import {
  isValidProviderProxyUrl,
  normalizeProviderProxyConfig,
  providerProxyConfigForSave,
} from "@/components/providers/forms/ProviderAdvancedConfig";

describe("provider outbound proxy helpers", () => {
  it("defaults to inherit and keeps explicit direct mode", () => {
    expect(normalizeProviderProxyConfig()).toEqual({
      mode: "inherit",
      url: "",
    });
    expect(normalizeProviderProxyConfig({ mode: "direct" })).toEqual({
      mode: "direct",
      url: "",
    });
  });

  it("restores legacy custom proxy metadata", () => {
    expect(
      normalizeProviderProxyConfig({
        enabled: true,
        proxyType: "socks5h",
        proxyHost: "127.0.0.1",
        proxyPort: 1080,
        proxyUsername: "user",
        proxyPassword: "pass",
      }),
    ).toEqual({
      mode: "custom",
      url: "socks5h://user:pass@127.0.0.1:1080",
    });
  });

  it("persists only non-inherited modes", () => {
    expect(
      providerProxyConfigForSave({ mode: "inherit", url: "" }),
    ).toBeUndefined();
    expect(
      providerProxyConfigForSave({ mode: "direct", url: "ignored" }),
    ).toEqual({
      mode: "direct",
    });
    expect(
      providerProxyConfigForSave({
        mode: "custom",
        url: "  http://127.0.0.1:7890  ",
      }),
    ).toEqual({ mode: "custom", url: "http://127.0.0.1:7890" });
  });

  it("accepts supported proxy schemes and rejects malformed URLs", () => {
    expect(isValidProviderProxyUrl("https://proxy.example.com:8443")).toBe(
      true,
    );
    expect(isValidProviderProxyUrl("socks5h://127.0.0.1:1080")).toBe(true);
    expect(isValidProviderProxyUrl("ftp://proxy.example.com")).toBe(false);
    expect(isValidProviderProxyUrl("not a url")).toBe(false);
  });
});
