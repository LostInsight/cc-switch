import { describe, expect, it } from "vitest";
import {
  isValidHttpFailoverStatus,
  isValidProviderProxyUrl,
  normalizeProviderFailoverPolicy,
  normalizeProviderProxyConfig,
  providerFailoverPolicyForSave,
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

describe("provider HTTP failover policy helpers", () => {
  it("uses empty overrides for inherit and omits the policy on save", () => {
    expect(normalizeProviderFailoverPolicy()).toEqual({});
    expect(providerFailoverPolicyForSave({})).toBeUndefined();
  });

  it("round-trips explicit common and custom status overrides", () => {
    const overrides = normalizeProviderFailoverPolicy({
      httpStatusOverrides: {
        "400": "failover",
        "405": "failover",
        "429": "stop",
        "502": "failover",
        "529": "stop",
      },
    });

    expect(providerFailoverPolicyForSave(overrides)).toEqual({
      httpStatusOverrides: {
        "400": "failover",
        "405": "failover",
        "429": "stop",
        "502": "failover",
        "529": "stop",
      },
    });
  });

  it("accepts only 400-599 custom status codes", () => {
    expect(isValidHttpFailoverStatus("400")).toBe(true);
    expect(isValidHttpFailoverStatus(599)).toBe(true);
    expect(isValidHttpFailoverStatus("399")).toBe(false);
    expect(isValidHttpFailoverStatus("600")).toBe(false);
    expect(isValidHttpFailoverStatus("40x")).toBe(false);
  });
});
