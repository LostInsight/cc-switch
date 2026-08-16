import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Coins, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ProviderProxyConfig, ProviderProxyMode } from "@/types";
export type PricingModelSourceOption = "inherit" | "request" | "response";

interface ProviderPricingConfig {
  enabled: boolean;
  costMultiplier?: string;
  pricingModelSource: PricingModelSourceOption;
}

interface ProviderAdvancedConfigProps {
  pricingConfig: ProviderPricingConfig;
  onPricingConfigChange: (config: ProviderPricingConfig) => void;
}

const PROVIDER_PROXY_SCHEMES = new Set([
  "http:",
  "https:",
  "socks5:",
  "socks5h:",
]);

export function normalizeProviderProxyConfig(config?: ProviderProxyConfig): {
  mode: ProviderProxyMode;
  url: string;
} {
  if (config?.mode === "direct") return { mode: "direct", url: "" };
  if (config?.mode === "custom") {
    return { mode: "custom", url: config.url?.trim() ?? "" };
  }
  if (config?.mode === "inherit") return { mode: "inherit", url: "" };

  if (config?.enabled) {
    const scheme = config.proxyType ?? "http";
    const host = config.proxyHost?.trim();
    if (host) {
      const credentials =
        config.proxyUsername && config.proxyPassword
          ? `${encodeURIComponent(config.proxyUsername)}:${encodeURIComponent(config.proxyPassword)}@`
          : "";
      const port = config.proxyPort ? `:${config.proxyPort}` : "";
      return {
        mode: "custom",
        url: `${scheme}://${credentials}${host}${port}`,
      };
    }
  }
  return { mode: "inherit", url: "" };
}

export function isValidProviderProxyUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return (
      PROVIDER_PROXY_SCHEMES.has(parsed.protocol) && Boolean(parsed.hostname)
    );
  } catch {
    return false;
  }
}

export function providerProxyConfigForSave(value: {
  mode: ProviderProxyMode;
  url: string;
}): ProviderProxyConfig | undefined {
  if (value.mode === "inherit") return undefined;
  if (value.mode === "direct") return { mode: "direct" };
  return { mode: "custom", url: value.url.trim() };
}

interface ProviderProxyConfigSectionProps {
  value: { mode: ProviderProxyMode; url: string };
  onChange: (value: { mode: ProviderProxyMode; url: string }) => void;
}

export function ProviderProxyConfigSection({
  value,
  onChange,
}: ProviderProxyConfigSectionProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(value.mode !== "inherit");

  useEffect(() => {
    setIsOpen(value.mode !== "inherit");
  }, [value.mode]);

  return (
    <div className="rounded-lg border border-border/50 bg-muted/20">
      <button
        type="button"
        className="flex w-full items-center justify-between p-4 hover:bg-muted/30 transition-colors"
        onClick={() => setIsOpen((open) => !open)}
      >
        <div className="flex items-center gap-3">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {t("providerAdvanced.proxyConfig", {
              defaultValue: "出站代理",
            })}
          </span>
        </div>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="border-t border-border/50 p-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("providerAdvanced.proxyConfigDesc", {
              defaultValue:
                "默认跟随全局出站代理，也可以为此供应商单独指定代理或直连。",
            })}
          </p>
          <div className="space-y-2">
            <Label htmlFor="provider-proxy-mode">
              {t("providerAdvanced.proxyMode", { defaultValue: "代理模式" })}
            </Label>
            <Select
              value={value.mode}
              onValueChange={(mode) => {
                const nextMode = mode as ProviderProxyMode;
                onChange({
                  mode: nextMode,
                  url: nextMode === "custom" ? value.url : "",
                });
                if (nextMode !== "inherit") setIsOpen(true);
              }}
            >
              <SelectTrigger id="provider-proxy-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inherit">
                  {t("providerAdvanced.proxyModeInherit", {
                    defaultValue: "跟随全局代理",
                  })}
                </SelectItem>
                <SelectItem value="custom">
                  {t("providerAdvanced.proxyModeCustom", {
                    defaultValue: "使用特定代理",
                  })}
                </SelectItem>
                <SelectItem value="direct">
                  {t("providerAdvanced.proxyModeDirect", {
                    defaultValue: "不使用代理（直连）",
                  })}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {value.mode === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="provider-proxy-url">
                {t("providerAdvanced.proxyUrl", { defaultValue: "代理 URL" })}
              </Label>
              <Input
                id="provider-proxy-url"
                value={value.url}
                onChange={(event) =>
                  onChange({ ...value, url: event.target.value })
                }
                placeholder={t("providerAdvanced.proxyUrlHint", {
                  defaultValue:
                    "http://127.0.0.1:7890 / socks5h://127.0.0.1:1080",
                })}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                {t("providerAdvanced.proxyUrlCredentialHint", {
                  defaultValue: "支持在 URL 中写入用户名和密码。",
                })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProviderAdvancedConfig({
  pricingConfig,
  onPricingConfigChange,
}: ProviderAdvancedConfigProps) {
  const { t } = useTranslation();
  const [isPricingConfigOpen, setIsPricingConfigOpen] = useState(
    pricingConfig.enabled,
  );

  useEffect(() => {
    setIsPricingConfigOpen(pricingConfig.enabled);
  }, [pricingConfig.enabled]);

  return (
    <div className="space-y-4">
      {/* 计费配置 */}
      <div className="rounded-lg border border-border/50 bg-muted/20">
        <button
          type="button"
          className="flex w-full items-center justify-between p-4 hover:bg-muted/30 transition-colors"
          onClick={() => setIsPricingConfigOpen(!isPricingConfigOpen)}
        >
          <div className="flex items-center gap-3">
            <Coins className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              {t("providerAdvanced.pricingConfig", {
                defaultValue: "计费配置",
              })}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <Label
                htmlFor="pricing-config-enabled"
                className="text-sm text-muted-foreground"
              >
                {t("providerAdvanced.useCustomPricing", {
                  defaultValue: "使用单独配置",
                })}
              </Label>
              <Switch
                id="pricing-config-enabled"
                checked={pricingConfig.enabled}
                onCheckedChange={(checked) => {
                  onPricingConfigChange({ ...pricingConfig, enabled: checked });
                  if (checked) setIsPricingConfigOpen(true);
                }}
              />
            </div>
            {isPricingConfigOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>
        <div
          className={cn(
            "overflow-hidden transition-all duration-200",
            isPricingConfigOpen
              ? "max-h-[500px] opacity-100"
              : "max-h-0 opacity-0",
          )}
        >
          <div className="border-t border-border/50 p-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("providerAdvanced.pricingConfigDesc", {
                defaultValue:
                  "为此供应商配置单独的计费参数，不启用时使用全局默认配置。",
              })}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost-multiplier">
                  {t("providerAdvanced.costMultiplier", {
                    defaultValue: "成本倍率",
                  })}
                </Label>
                <Input
                  id="cost-multiplier"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={pricingConfig.costMultiplier || ""}
                  onChange={(e) =>
                    onPricingConfigChange({
                      ...pricingConfig,
                      costMultiplier: e.target.value || undefined,
                    })
                  }
                  placeholder={t("providerAdvanced.costMultiplierPlaceholder", {
                    defaultValue: "留空使用全局默认（1）",
                  })}
                  disabled={!pricingConfig.enabled}
                />
                <p className="text-xs text-muted-foreground">
                  {t("providerAdvanced.costMultiplierHint", {
                    defaultValue: "实际成本 = 基础成本 × 倍率，支持小数如 1.5",
                  })}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pricing-model-source">
                  {t("providerAdvanced.pricingModelSourceLabel", {
                    defaultValue: "计费模式",
                  })}
                </Label>
                <Select
                  value={pricingConfig.pricingModelSource}
                  onValueChange={(value) =>
                    onPricingConfigChange({
                      ...pricingConfig,
                      pricingModelSource: value as PricingModelSourceOption,
                    })
                  }
                  disabled={!pricingConfig.enabled}
                >
                  <SelectTrigger id="pricing-model-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inherit">
                      {t("providerAdvanced.pricingModelSourceInherit", {
                        defaultValue: "继承全局默认",
                      })}
                    </SelectItem>
                    <SelectItem value="request">
                      {t("providerAdvanced.pricingModelSourceRequest", {
                        defaultValue: "请求模型",
                      })}
                    </SelectItem>
                    <SelectItem value="response">
                      {t("providerAdvanced.pricingModelSourceResponse", {
                        defaultValue: "返回模型",
                      })}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t("providerAdvanced.pricingModelSourceHint", {
                    defaultValue: "选择按请求模型还是返回模型进行定价匹配",
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
