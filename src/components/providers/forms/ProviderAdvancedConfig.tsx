import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  Coins,
  Globe,
  Plus,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import type {
  HttpFailoverAction,
  ProviderFailoverPolicy,
  ProviderProxyConfig,
  ProviderProxyMode,
} from "@/types";
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

export type HttpStatusOverrides = Record<string, HttpFailoverAction>;

const COMMON_HTTP_FAILOVER_STATUSES = [400, 405, 429, 502, 503, 504];

export function isValidHttpFailoverStatus(value: string | number): boolean {
  const normalized = String(value).trim();
  if (!/^\d{3}$/.test(normalized)) return false;
  const status = Number(normalized);
  return status >= 400 && status <= 599;
}

export function normalizeProviderFailoverPolicy(
  policy?: ProviderFailoverPolicy,
): HttpStatusOverrides {
  return Object.fromEntries(
    Object.entries(policy?.httpStatusOverrides ?? {})
      .filter(
        ([status, action]) =>
          isValidHttpFailoverStatus(status) &&
          (action === "failover" || action === "stop"),
      )
      .map(([status, action]) => [String(Number(status)), action]),
  );
}

export function providerFailoverPolicyForSave(
  overrides: HttpStatusOverrides,
): ProviderFailoverPolicy | undefined {
  const normalized = normalizeProviderFailoverPolicy({
    httpStatusOverrides: overrides,
  });
  return Object.keys(normalized).length > 0
    ? { httpStatusOverrides: normalized }
    : undefined;
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

interface ProviderFailoverPolicySectionProps {
  value: HttpStatusOverrides;
  onChange: (value: HttpStatusOverrides) => void;
}

export function ProviderFailoverPolicySection({
  value,
  onChange,
}: ProviderFailoverPolicySectionProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(Object.keys(value).length > 0);
  const [customStatus, setCustomStatus] = useState("");
  const [customAction, setCustomAction] =
    useState<HttpFailoverAction>("failover");
  const [customStatusError, setCustomStatusError] = useState<string>();

  useEffect(() => {
    if (Object.keys(value).length > 0) setIsOpen(true);
  }, [value]);

  const commonStatuses = new Set(COMMON_HTTP_FAILOVER_STATUSES);
  const customStatuses = Object.keys(value)
    .map(Number)
    .filter((status) => !commonStatuses.has(status))
    .sort((a, b) => a - b);
  const statuses = [...COMMON_HTTP_FAILOVER_STATUSES, ...customStatuses];

  const setStatusAction = (
    status: number,
    action: HttpFailoverAction | "inherit",
  ) => {
    const next = { ...value };
    if (action === "inherit") {
      delete next[String(status)];
    } else {
      next[String(status)] = action;
    }
    onChange(next);
  };

  const addCustomStatus = () => {
    const normalized = customStatus.trim();
    if (!isValidHttpFailoverStatus(normalized)) {
      setCustomStatusError(
        t("providerAdvanced.failoverStatusInvalid", {
          defaultValue: "HTTP 状态码必须是 400 到 599。",
        }),
      );
      return;
    }

    const status = Number(normalized);
    if (commonStatuses.has(status) || value[String(status)] !== undefined) {
      setCustomStatusError(
        t("providerAdvanced.failoverStatusExists", {
          defaultValue: "该状态码已在列表中。",
        }),
      );
      return;
    }

    onChange({ ...value, [String(status)]: customAction });
    setCustomStatus("");
    setCustomStatusError(undefined);
  };

  return (
    <div className="rounded-lg border border-border/50 bg-muted/20">
      <button
        type="button"
        className="flex w-full items-center justify-between p-4 hover:bg-muted/30 transition-colors"
        onClick={() => setIsOpen((open) => !open)}
      >
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {t("providerAdvanced.failoverPolicy", {
              defaultValue: "故障转移 HTTP 状态覆盖",
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
          isOpen ? "max-h-[1100px] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="border-t border-border/50 p-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("providerAdvanced.failoverPolicyDesc", {
              defaultValue:
                "仅控制上游 HTTP 错误是否继续到下一个故障转移供应商；继承保持当前默认行为。",
            })}
          </p>
          <div className="space-y-2">
            {statuses.map((status) => {
              const isCustom = !commonStatuses.has(status);
              return (
                <div
                  key={status}
                  className="grid min-h-10 grid-cols-[minmax(0,1fr)_150px_36px] items-center gap-2"
                >
                  <Label htmlFor={`http-failover-${status}`}>
                    HTTP {status}
                  </Label>
                  <Select
                    value={value[String(status)] ?? "inherit"}
                    onValueChange={(action) =>
                      setStatusAction(
                        status,
                        action as HttpFailoverAction | "inherit",
                      )
                    }
                  >
                    <SelectTrigger id={`http-failover-${status}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inherit">
                        {t("providerAdvanced.failoverActionInherit", {
                          defaultValue: "继承默认",
                        })}
                      </SelectItem>
                      <SelectItem value="failover">
                        {t("providerAdvanced.failoverActionContinue", {
                          defaultValue: "继续下一家",
                        })}
                      </SelectItem>
                      <SelectItem value="stop">
                        {t("providerAdvanced.failoverActionStop", {
                          defaultValue: "立即返回",
                        })}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {isCustom ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setStatusAction(status, "inherit")}
                      aria-label={t("providerAdvanced.removeFailoverStatus", {
                        status,
                        defaultValue: `移除 HTTP ${status}`,
                      })}
                      title={t("providerAdvanced.removeFailoverStatus", {
                        status,
                        defaultValue: `移除 HTTP ${status}`,
                      })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-http-failover-status">
              {t("providerAdvanced.customFailoverStatus", {
                defaultValue: "自定义 HTTP 状态",
              })}
            </Label>
            <div className="grid grid-cols-[minmax(0,1fr)_150px_40px] gap-2">
              <Input
                id="custom-http-failover-status"
                value={customStatus}
                onChange={(event) => {
                  setCustomStatus(event.target.value);
                  setCustomStatusError(undefined);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCustomStatus();
                  }
                }}
                inputMode="numeric"
                maxLength={3}
                placeholder="400-599"
              />
              <Select
                value={customAction}
                onValueChange={(action) =>
                  setCustomAction(action as HttpFailoverAction)
                }
              >
                <SelectTrigger
                  aria-label={t("providerAdvanced.customFailoverAction", {
                    defaultValue: "自定义状态动作",
                  })}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="failover">
                    {t("providerAdvanced.failoverActionContinue", {
                      defaultValue: "继续下一家",
                    })}
                  </SelectItem>
                  <SelectItem value="stop">
                    {t("providerAdvanced.failoverActionStop", {
                      defaultValue: "立即返回",
                    })}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="icon"
                className="h-10 w-10"
                onClick={addCustomStatus}
                aria-label={t("providerAdvanced.addFailoverStatus", {
                  defaultValue: "添加 HTTP 状态",
                })}
                title={t("providerAdvanced.addFailoverStatus", {
                  defaultValue: "添加 HTTP 状态",
                })}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {customStatusError && (
              <p className="text-xs text-destructive">{customStatusError}</p>
            )}
          </div>
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
