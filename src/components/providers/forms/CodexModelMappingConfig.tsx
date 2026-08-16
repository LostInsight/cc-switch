import { useEffect, useRef, useState } from "react";
import { ArrowRightLeft, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { ProviderMeta } from "@/types";

type Mapping = NonNullable<ProviderMeta["codexModelMapping"]>;
type MappingRow = { rowId: string; source: string; target: string };

const emptyMapping: Mapping = { enabled: false, modelMap: {}, effortMap: {} };
const reasoningEfforts = new Set([
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);
const effortTokenPattern = /^[A-Za-z0-9_-]+$/;

function invalidEffortSuffix(value: string): string | undefined {
  const separator = value.lastIndexOf("@");
  if (separator < 0) return undefined;
  const model = value.slice(0, separator).trim();
  const effort = value
    .slice(separator + 1)
    .trim()
    .toLowerCase();
  return model && effortTokenPattern.test(effort)
    ? undefined
    : effort || "(empty)";
}

function nonStandardEffortSuffix(value: string): string | undefined {
  const separator = value.lastIndexOf("@");
  if (separator < 0 || invalidEffortSuffix(value)) return undefined;
  const effort = value
    .slice(separator + 1)
    .trim()
    .toLowerCase();
  return reasoningEfforts.has(effort) ? undefined : effort;
}

export function findInvalidCodexModelMappingEffort(
  mapping?: Mapping,
): { effort: string; value: string } | undefined {
  if (!mapping?.enabled) return undefined;
  const entries = [
    ...Object.entries(mapping.modelMap),
    ...Object.entries(mapping.effortMap),
  ];
  for (const [source, target] of entries) {
    for (const value of [source, target]) {
      const effort = invalidEffortSuffix(value);
      if (effort) return { effort, value };
    }
  }
  return undefined;
}

export function findNonStandardCodexModelMappingEffort(
  mapping?: Mapping,
): { effort: string; value: string } | undefined {
  if (!mapping?.enabled) return undefined;
  const entries = [
    ...Object.entries(mapping.modelMap),
    ...Object.entries(mapping.effortMap),
  ];
  for (const [source, target] of entries) {
    for (const value of [source, target]) {
      const effort = nonStandardEffortSuffix(value);
      if (effort) return { effort, value };
    }
  }
  return undefined;
}

function createRows(mapping: Mapping): MappingRow[] {
  return [
    ...Object.entries(mapping.modelMap),
    ...Object.entries(mapping.effortMap),
  ].map(([source, target]) => ({
    rowId: crypto.randomUUID(),
    source,
    target,
  }));
}

function mapsEqual(
  left: Record<string, string>,
  right: Record<string, string>,
) {
  const leftEntries = Object.entries(left);
  return (
    leftEntries.length === Object.keys(right).length &&
    leftEntries.every(([source, target]) => right[source] === target)
  );
}

function mappingsEqual(left: Mapping, right: Mapping) {
  return (
    mapsEqual(left.modelMap, right.modelMap) &&
    mapsEqual(left.effortMap, right.effortMap)
  );
}

function isEffortRoute(source: string) {
  const separator = source.lastIndexOf("@");
  return separator > 0 && !invalidEffortSuffix(source);
}

interface Props {
  value?: Mapping;
  onChange: (value: Mapping | undefined) => void;
}

export function CodexModelMappingConfig({ value, onChange }: Props) {
  const { t } = useTranslation();
  const mapping = value ?? emptyMapping;
  const [rows, setRows] = useState(() => createRows(mapping));
  const lastSentMappingRef = useRef(mapping);

  useEffect(() => {
    if (mappingsEqual(mapping, lastSentMappingRef.current)) return;
    setRows(createRows(mapping));
    lastSentMappingRef.current = mapping;
  }, [mapping]);

  const syncRows = (nextRows: typeof rows) => {
    setRows(nextRows);
    const entries = nextRows
      .map(({ source, target }) => [source.trim(), target.trim()] as const)
      .filter(([source, target]) => source && target);
    const modelMap = Object.fromEntries(
      entries.filter(([source]) => !isEffortRoute(source)),
    );
    const effortMap = Object.fromEntries(
      entries.filter(([source]) => isEffortRoute(source)),
    );
    const nextMapping = { ...mapping, modelMap, effortMap, enabled: true };
    lastSentMappingRef.current = nextMapping;
    onChange(nextMapping);
  };

  return (
    <section className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          <Label>
            {t("codexConfig.modelRouteTitle", {
              defaultValue: "Codex 模型路由",
            })}
          </Label>
        </div>
        <Switch
          checked={mapping.enabled}
          onCheckedChange={(enabled) => onChange({ ...mapping, enabled })}
          aria-label={t("codexConfig.enableModelRoute", {
            defaultValue: "启用 Codex 模型路由",
          })}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {t("codexConfig.modelRouteHint", {
          defaultValue:
            "支持两种写法：普通路由 gpt-5.6-terra → gpt-5.6-sol，或深度路由 gpt-5.6-terra@max → gpt-5.6-sol@high。两种路由可以并存；同一模型匹配时深度路由优先，未命中时使用普通路由并保留用户深度。未知深度标签会提醒但仍允许保存。",
        })}
      </p>
      {rows.map((row, index) => (
        <div className="space-y-1" key={row.rowId}>
          <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
            <Input
              value={row.source}
              placeholder="gpt-5.6-terra 或 gpt-5.6-terra@max"
              aria-label={t("codexConfig.routeSource", {
                defaultValue: "显示模型",
              })}
              aria-invalid={Boolean(invalidEffortSuffix(row.source))}
              className={
                invalidEffortSuffix(row.source)
                  ? "border-destructive focus-visible:ring-destructive"
                  : nonStandardEffortSuffix(row.source)
                    ? "border-amber-500 focus-visible:ring-amber-500"
                    : undefined
              }
              onChange={(event) => {
                const next = rows.slice();
                next[index] = { ...row, source: event.target.value };
                syncRows(next);
              }}
            />
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
            <Input
              value={row.target}
              placeholder="gpt-5.6-sol 或 gpt-5.6-sol@high"
              aria-label={t("codexConfig.routeTarget", {
                defaultValue: "实际模型",
              })}
              aria-invalid={Boolean(invalidEffortSuffix(row.target))}
              className={
                invalidEffortSuffix(row.target)
                  ? "border-destructive focus-visible:ring-destructive"
                  : nonStandardEffortSuffix(row.target)
                    ? "border-amber-500 focus-visible:ring-amber-500"
                    : undefined
              }
              onChange={(event) => {
                const next = rows.slice();
                next[index] = { ...row, target: event.target.value };
                syncRows(next);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() =>
                syncRows(rows.filter((_, rowIndex) => rowIndex !== index))
              }
              aria-label={t("common.delete", { defaultValue: "删除" })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {(invalidEffortSuffix(row.source) ||
            invalidEffortSuffix(row.target)) && (
            <p className="text-xs text-destructive" role="alert">
              {t("codexConfig.modelRouteInvalidEffort", {
                defaultValue:
                  "路由格式无效：{{value}}。请使用 model 或 model@effort，且 effort 不能为空或包含空格。",
                effort:
                  invalidEffortSuffix(row.source) ??
                  invalidEffortSuffix(row.target),
                value: invalidEffortSuffix(row.source)
                  ? row.source
                  : row.target,
              })}
            </p>
          )}
          {!invalidEffortSuffix(row.source) &&
            !invalidEffortSuffix(row.target) &&
            (nonStandardEffortSuffix(row.source) ||
              nonStandardEffortSuffix(row.target)) && (
              <p
                className="text-xs text-amber-600 dark:text-amber-400"
                role="status"
              >
                {t("codexConfig.modelRouteUnknownEffort", {
                  defaultValue:
                    "“{{effort}}”不是当前已知的 Codex 深度标签；仍会按原样保存，并在调用时交由上游判断。",
                  effort:
                    nonStandardEffortSuffix(row.source) ??
                    nonStandardEffortSuffix(row.target),
                })}
              </p>
            )}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          setRows((current) => [
            ...current,
            { rowId: crypto.randomUUID(), source: "", target: "" },
          ])
        }
      >
        <Plus className="mr-1 h-4 w-4" />
        {t("common.add", { defaultValue: "添加路由" })}
      </Button>
    </section>
  );
}
