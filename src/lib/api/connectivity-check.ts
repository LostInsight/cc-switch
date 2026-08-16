import { invoke } from "@tauri-apps/api/core";
import type { AppId } from "./types";

// ===== 连通性检查类型 =====
// 真实向供应商发送一次流式模型请求，并等待首个响应片段。

export type HealthStatus = "operational" | "degraded" | "failed";

export interface StreamCheckConfig {
  /** 单次真实模型请求超时（秒） */
  timeoutSecs: number;
  /** 超时类失败的最大重试次数 */
  maxRetries: number;
  /** 降级阈值（毫秒）：可达但 TTFB 超过该值判定为"较慢" */
  degradedThresholdMs: number;
  claudeModel?: string;
  codexModel?: string;
  geminiModel?: string;
  testPrompt?: string;
  testPrompts?: string[];
}

export interface StreamCheckResult {
  status: HealthStatus;
  success: boolean;
  message: string;
  responseTimeMs?: number;
  httpStatus?: number;
  testedAt: number;
  retryCount: number;
}

// ===== 真实模型探测 API =====

/**
 * 连通性检查（单个供应商）
 */
export async function streamCheckProvider(
  appType: AppId,
  providerId: string,
): Promise<StreamCheckResult> {
  return invoke("stream_check_provider", { appType, providerId });
}

/**
 * 批量连通性检查
 */
export async function streamCheckAllProviders(
  appType: AppId,
  proxyTargetsOnly: boolean = false,
): Promise<Array<[string, StreamCheckResult]>> {
  return invoke("stream_check_all_providers", { appType, proxyTargetsOnly });
}

/**
 * 获取连通性检查配置
 */
export async function getStreamCheckConfig(): Promise<StreamCheckConfig> {
  return invoke("get_stream_check_config");
}

/**
 * 保存连通性检查配置
 */
export async function saveStreamCheckConfig(
  config: StreamCheckConfig,
): Promise<void> {
  return invoke("save_stream_check_config", { config });
}
