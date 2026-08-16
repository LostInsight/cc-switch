import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save, Loader2, Info, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  getStreamCheckConfig,
  saveStreamCheckConfig,
  type StreamCheckConfig,
} from "@/lib/api/connectivity-check";

export interface ConnectivityCheckConfigPanelHandle {
  save: () => Promise<boolean>;
}

export const ConnectivityCheckConfigPanel =
  forwardRef<ConnectivityCheckConfigPanelHandle>(
    function ConnectivityCheckConfigPanel(_props, ref) {
      const { t } = useTranslation();
      const [isLoading, setIsLoading] = useState(true);
      const [isSaving, setIsSaving] = useState(false);
      const [error, setError] = useState<string | null>(null);
      const [loadedConfig, setLoadedConfig] =
        useState<StreamCheckConfig | null>(null);
      const nextPromptId = useRef(0);
      const [promptRows, setPromptRows] = useState<
        Array<{ rowId: number; value: string }>
      >([]);
      // 使用字符串状态以支持完全清空数字输入框
      const [config, setConfig] = useState({
        timeoutSecs: "45",
        maxRetries: "2",
        degradedThresholdMs: "6000",
        claudeModel: "claude-haiku-4-5-20251001",
        codexModel: "gpt-5.5@low",
        geminiModel: "gemini-3.5-flash",
      });

      useEffect(() => {
        loadConfig();
      }, []);

      async function loadConfig() {
        try {
          setIsLoading(true);
          setError(null);
          const data = await getStreamCheckConfig();
          setLoadedConfig(data);
          setConfig({
            timeoutSecs: String(data.timeoutSecs),
            maxRetries: String(data.maxRetries),
            degradedThresholdMs: String(data.degradedThresholdMs),
            claudeModel: data.claudeModel ?? "claude-haiku-4-5-20251001",
            codexModel: data.codexModel ?? "gpt-5.5@low",
            geminiModel: data.geminiModel ?? "gemini-3.5-flash",
          });
          const savedPrompts = (data.testPrompts ?? []).filter(
            (prompt) => prompt.trim().length > 0,
          );
          const prompts =
            savedPrompts.length > 0
              ? savedPrompts
              : [data.testPrompt?.trim() || "Who are you?"];
          setPromptRows(
            prompts.map((value) => ({
              rowId: nextPromptId.current++,
              value,
            })),
          );
        } catch (e) {
          setError(String(e));
        } finally {
          setIsLoading(false);
        }
      }

      const handleSave = useCallback(async (): Promise<boolean> => {
        if (isLoading || !loadedConfig) {
          return false;
        }

        // 解析数字，空值使用默认值，0 是有效值
        const parseNum = (val: string, defaultVal: number) => {
          const n = parseInt(val);
          return isNaN(n) ? defaultVal : n;
        };
        try {
          setIsSaving(true);
          const testPrompts = promptRows
            .map((row) => row.value.trim())
            .filter((prompt) => prompt.length > 0);
          const parsed: StreamCheckConfig = {
            ...loadedConfig,
            timeoutSecs: parseNum(config.timeoutSecs, 45),
            maxRetries: parseNum(config.maxRetries, 2),
            degradedThresholdMs: parseNum(config.degradedThresholdMs, 6000),
            claudeModel: config.claudeModel,
            codexModel: config.codexModel,
            geminiModel: config.geminiModel,
            testPrompt: testPrompts[0] ?? "Who are you?",
            testPrompts,
          };
          await saveStreamCheckConfig(parsed);
          setLoadedConfig(parsed);
          toast.success(t("streamCheck.configSaved"), {
            closeButton: true,
          });
          return true;
        } catch (e) {
          toast.error(t("streamCheck.configSaveFailed") + ": " + String(e));
          return false;
        } finally {
          setIsSaving(false);
        }
      }, [config, isLoading, loadedConfig, promptRows, t]);

      useImperativeHandle(ref, () => ({ save: handleSave }), [handleSave]);

      if (isLoading) {
        return (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        );
      }

      return (
        <div className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* 真实模型探测语义说明 */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {t("streamCheck.connectivityNote", {
                defaultValue:
                  "连通检测会真实发送一次模型请求并等待首个响应片段，可发现鉴权、模型和协议配置错误。",
              })}
            </AlertDescription>
          </Alert>

          {/* 测试模型配置 */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">
              {t("streamCheck.testModels", { defaultValue: "测试模型" })}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="claudeModel">
                  {t("streamCheck.claudeModel", {
                    defaultValue: "Claude 测试模型",
                  })}
                </Label>
                <Input
                  id="claudeModel"
                  value={config.claudeModel}
                  onChange={(event) =>
                    setConfig({ ...config, claudeModel: event.target.value })
                  }
                  placeholder="claude-haiku-4-5-20251001"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="codexModel">
                  {t("streamCheck.codexModel", {
                    defaultValue: "Codex 测试模型",
                  })}
                </Label>
                <Input
                  id="codexModel"
                  value={config.codexModel}
                  onChange={(event) =>
                    setConfig({ ...config, codexModel: event.target.value })
                  }
                  placeholder="gpt-5.5@low"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="geminiModel">
                  {t("streamCheck.geminiModel", {
                    defaultValue: "Gemini 测试模型",
                  })}
                </Label>
                <Input
                  id="geminiModel"
                  value={config.geminiModel}
                  onChange={(event) =>
                    setConfig({ ...config, geminiModel: event.target.value })
                  }
                  placeholder="gemini-3.5-flash"
                />
              </div>
            </div>
          </div>

          {/* 检查参数配置 */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">
              {t("streamCheck.checkParams")}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="timeoutSecs">{t("streamCheck.timeout")}</Label>
                <Input
                  id="timeoutSecs"
                  type="number"
                  min={2}
                  max={60}
                  value={config.timeoutSecs}
                  onChange={(e) =>
                    setConfig({ ...config, timeoutSecs: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxRetries">
                  {t("streamCheck.maxRetries")}
                </Label>
                <Input
                  id="maxRetries"
                  type="number"
                  min={0}
                  max={5}
                  value={config.maxRetries}
                  onChange={(e) =>
                    setConfig({ ...config, maxRetries: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="degradedThresholdMs">
                  {t("streamCheck.degradedThreshold")}
                </Label>
                <Input
                  id="degradedThresholdMs"
                  type="number"
                  min={1000}
                  max={30000}
                  step={1000}
                  value={config.degradedThresholdMs}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      degradedThresholdMs: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </div>

          {/* 真实探测提示词 */}
          <div className="space-y-4">
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-muted-foreground">
                {t("streamCheck.promptTemplates", {
                  defaultValue: "连通性测试提示词",
                })}
              </h4>
              <p className="text-xs text-muted-foreground">
                {t("streamCheck.promptTemplatesHint", {
                  defaultValue:
                    "多套提示词会按连通性测试次数轮询。支持 {yyyyMMdd} 和 {random[1-100]}，随机范围包含两端。",
                })}
              </p>
            </div>

            <div className="space-y-3">
              {promptRows.map((row, index) => (
                <div key={row.rowId} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor={`stream-check-prompt-${row.rowId}`}>
                      {t("streamCheck.promptTemplate", {
                        index: index + 1,
                        defaultValue: `提示词 ${index + 1}`,
                      })}
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={promptRows.length === 1}
                      aria-label={t("streamCheck.removePrompt", {
                        index: index + 1,
                        defaultValue: `删除提示词 ${index + 1}`,
                      })}
                      onClick={() =>
                        setPromptRows((rows) =>
                          rows.filter((item) => item.rowId !== row.rowId),
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea
                    id={`stream-check-prompt-${row.rowId}`}
                    value={row.value}
                    onChange={(event) =>
                      setPromptRows((rows) =>
                        rows.map((item) =>
                          item.rowId === row.rowId
                            ? { ...item, value: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setPromptRows((rows) => [
                  ...rows,
                  { rowId: nextPromptId.current++, value: "" },
                ])
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("streamCheck.addPrompt", { defaultValue: "添加提示词" })}
            </Button>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("common.saving")}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {t("common.save")}
                </>
              )}
            </Button>
          </div>
        </div>
      );
    },
  );
