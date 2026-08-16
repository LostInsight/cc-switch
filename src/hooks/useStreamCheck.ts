import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  streamCheckProvider,
  type StreamCheckResult,
} from "@/lib/api/connectivity-check";
import type { AppId } from "@/lib/api";
import { useResetCircuitBreaker } from "@/lib/query/failover";

/**
 * 供应商连通性检查。
 *
 * 发送真实流式模型请求并等待首个响应片段；鉴权、模型和协议错误都会暴露。
 * 探测成功后重置故障转移熔断器，使已恢复的渠道重新参与路由。
 */
export function useStreamCheck(appId: AppId) {
  const { t } = useTranslation();
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const resetCircuitBreaker = useResetCircuitBreaker();

  const checkProvider = useCallback(
    async (
      providerId: string,
      providerName: string,
    ): Promise<StreamCheckResult | null> => {
      setCheckingIds((prev) => new Set(prev).add(providerId));

      try {
        const result = await streamCheckProvider(appId, providerId);

        if (result.status === "operational") {
          toast.success(
            t("streamCheck.reachable", {
              providerName: providerName,
              responseTimeMs: result.responseTimeMs,
              defaultValue: `${providerName} 连通正常 (${result.responseTimeMs}ms)`,
            }),
            { closeButton: true },
          );
          resetCircuitBreaker.mutate({ providerId, appType: appId });
        } else if (result.status === "degraded") {
          toast.warning(
            t("streamCheck.reachableSlow", {
              providerName: providerName,
              responseTimeMs: result.responseTimeMs,
              defaultValue: `${providerName} 连通但较慢 (${result.responseTimeMs}ms)`,
            }),
          );
          resetCircuitBreaker.mutate({ providerId, appType: appId });
        } else {
          // 仅当无法建立连接（DNS / 连接被拒 / TLS / 超时）才会到这里
          toast.error(
            t("streamCheck.unreachable", {
              providerName: providerName,
              message: result.message,
              defaultValue: `${providerName} 无法连通: ${result.message}`,
            }),
            {
              description: t("streamCheck.unreachableHint", {
                defaultValue:
                  "无法建立连接（DNS / 连接 / TLS / 超时）。请检查 base_url 与网络。",
              }),
              duration: 8000,
              closeButton: true,
            },
          );
        }

        return result;
      } catch (e) {
        toast.error(
          t("streamCheck.error", {
            providerName: providerName,
            error: String(e),
            defaultValue: `${providerName} 检查出错: ${String(e)}`,
          }),
        );
        return null;
      } finally {
        setCheckingIds((prev) => {
          const next = new Set(prev);
          next.delete(providerId);
          return next;
        });
      }
    },
    [appId, t, resetCircuitBreaker],
  );

  const isChecking = useCallback(
    (providerId: string) => checkingIds.has(providerId),
    [checkingIds],
  );

  return { checkProvider, isChecking };
}
