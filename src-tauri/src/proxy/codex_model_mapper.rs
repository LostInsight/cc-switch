//! Codex 请求模型的独立映射。

use crate::provider::{CodexModelMappingConfig, Provider};
use serde_json::Value;

pub fn config(provider: &Provider) -> CodexModelMappingConfig {
    provider
        .meta
        .as_ref()
        .and_then(|meta| meta.codex_model_mapping.clone())
        .unwrap_or_default()
}

pub fn has_mapping(provider: &Provider) -> bool {
    let value = config(provider);
    value.enabled && (!value.model_map.is_empty() || !value.effort_map.is_empty())
}

pub fn apply(mut body: Value, provider: &Provider) -> Value {
    let mapping = config(provider);
    if !mapping.enabled {
        return body;
    }

    let Some(original) = body
        .get("model")
        .and_then(Value::as_str)
        .map(ToString::to_string)
    else {
        return body;
    };

    // Effort-specific routes are more precise and therefore win over a plain route.
    let source_effort = body
        .get("reasoning")
        .and_then(|reasoning| reasoning.get("effort"))
        .and_then(Value::as_str)
        .or_else(|| body.get("reasoning_effort").and_then(Value::as_str));
    let effort_key = source_effort.map(|effort| format!("{original}@{effort}"));
    let effort_target = effort_key
        .as_deref()
        .and_then(|key| mapping.effort_map.get(key));
    let plain_target = mapping.model_map.get(&original);
    let target = effort_target
        .and_then(|target| parse_target(target).map(|parsed| (target, parsed)))
        .or_else(|| {
            plain_target.and_then(|target| parse_target(target).map(|parsed| (target, parsed)))
        });

    if let Some((_raw_target, (target_model, target_effort))) = target {
        if !target_model.is_empty() && (target_model != original || target_effort.is_some()) {
            log::debug!(
                "[CodexModelMapper] 模型映射: {original} -> {target_model}, effort: {:?} -> {:?}",
                source_effort,
                target_effort.or(source_effort)
            );
            body["model"] = Value::String(target_model.to_string());
            if let Some(target_effort) = target_effort {
                apply_target_effort(&mut body, target_effort);
            }
        }
    }
    body
}

fn parse_target(target: &str) -> Option<(&str, Option<&str>)> {
    let target = target.trim();
    if target.is_empty() {
        return None;
    }
    let Some((model, effort)) = target.rsplit_once('@') else {
        return Some((target, None));
    };
    let model = model.trim();
    let effort = effort.trim();
    if model.is_empty() || !is_valid_effort_token(effort) {
        return None;
    }
    Some((model, Some(effort)))
}

fn is_valid_effort_token(value: &str) -> bool {
    !value.is_empty()
        && value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '_' | '-'))
}

fn apply_target_effort(body: &mut Value, target_effort: &str) {
    let has_nested_effort = body
        .get("reasoning")
        .and_then(Value::as_object)
        .map(|reasoning| reasoning.contains_key("effort"))
        .unwrap_or(false);
    let has_top_level_effort = body.get("reasoning_effort").is_some();

    if has_nested_effort || !has_top_level_effort {
        if !body.get("reasoning").is_some_and(Value::is_object) {
            body["reasoning"] = Value::Object(Default::default());
        }
        body["reasoning"]["effort"] = Value::String(target_effort.to_string());
    }
    if has_top_level_effort {
        body["reasoning_effort"] = Value::String(target_effort.to_string());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::provider::ProviderMeta;
    use serde_json::json;
    use std::collections::HashMap;

    fn provider(model_map: &[(&str, &str)]) -> Provider {
        Provider {
            id: "test".into(),
            name: "Test".into(),
            settings_config: json!({}),
            website_url: None,
            category: None,
            created_at: None,
            sort_index: None,
            notes: None,
            meta: Some(ProviderMeta {
                codex_model_mapping: Some(CodexModelMappingConfig {
                    enabled: true,
                    model_map: model_map
                        .iter()
                        .map(|(source, target)| ((*source).into(), (*target).into()))
                        .collect::<HashMap<_, _>>(),
                    effort_map: HashMap::new(),
                }),
                ..Default::default()
            }),
            icon: None,
            icon_color: None,
            in_failover_queue: false,
        }
    }

    #[test]
    fn maps_multiple_models_to_one_target_and_preserves_unknown_models() {
        let provider = provider(&[
            ("gpt-5.5", "gpt-5.6-sol"),
            ("codex-auto-review", "gpt-5.6-sol"),
        ]);
        assert_eq!(
            apply(json!({"model": "gpt-5.5"}), &provider)["model"],
            "gpt-5.6-sol"
        );
        assert_eq!(
            apply(json!({"model": "codex-auto-review"}), &provider)["model"],
            "gpt-5.6-sol"
        );
        assert_eq!(
            apply(json!({"model": "other-model"}), &provider)["model"],
            "other-model"
        );
    }

    #[test]
    fn effort_route_wins_over_plain_route() {
        let mut provider = provider(&[("gpt-5.5", "plain")]);
        provider
            .meta
            .as_mut()
            .unwrap()
            .codex_model_mapping
            .as_mut()
            .unwrap()
            .effort_map
            .insert("gpt-5.5@high".into(), "gpt-5.6-sol@low".into());
        let mapped = apply(
            json!({"model": "gpt-5.5", "reasoning": {"effort": "high"}}),
            &provider,
        );

        assert_eq!(mapped["model"], "gpt-5.6-sol");
        assert_eq!(mapped["reasoning"]["effort"], "low");
    }

    #[test]
    fn plain_model_route_preserves_user_reasoning_effort() {
        let provider = provider(&[("gpt-5.6-terra", "gpt-5.6-sol")]);
        let mapped = apply(
            json!({
                "model": "gpt-5.6-terra",
                "reasoning": {
                    "effort": "medium",
                    "summary": "auto",
                    "context": "all_turns"
                },
                "reasoning_effort": "medium"
            }),
            &provider,
        );

        assert_eq!(mapped["model"], "gpt-5.6-sol");
        assert_eq!(mapped["reasoning"]["effort"], "medium");
        assert_eq!(mapped["reasoning"]["summary"], "auto");
        assert_eq!(mapped["reasoning"]["context"], "all_turns");
        assert_eq!(mapped["reasoning_effort"], "medium");
    }

    #[test]
    fn unmapped_route_preserves_reasoning_effort() {
        let provider = provider(&[("gpt-5.6-terra", "gpt-5.6-sol")]);
        let untouched = apply(
            json!({
                "model": "other-model",
                "reasoning": {"effort": "medium"},
                "reasoning_effort": "medium"
            }),
            &provider,
        );

        assert_eq!(untouched["reasoning"]["effort"], "medium");
        assert_eq!(untouched["reasoning_effort"], "medium");
    }

    #[test]
    fn malformed_target_effort_is_never_sent_as_part_of_the_model_name() {
        let provider = provider(&[("gpt-5.6-terra", "gpt-5.6-sol@")]);
        let mapped = apply(
            json!({
                "model": "gpt-5.6-terra",
                "reasoning": {"effort": "max"}
            }),
            &provider,
        );

        assert_eq!(mapped["model"], "gpt-5.6-terra");
        assert_eq!(mapped["reasoning"]["effort"], "max");
    }

    #[test]
    fn malformed_effort_route_falls_back_to_the_plain_route() {
        let mut provider = provider(&[("gpt-5.6-terra", "gpt-5.6-sol")]);
        provider
            .meta
            .as_mut()
            .unwrap()
            .codex_model_mapping
            .as_mut()
            .unwrap()
            .effort_map
            .insert("gpt-5.6-terra@max".into(), "gpt-5.6-sol@".into());
        let mapped = apply(
            json!({
                "model": "gpt-5.6-terra",
                "reasoning": {"effort": "max"}
            }),
            &provider,
        );

        assert_eq!(mapped["model"], "gpt-5.6-sol");
        assert_eq!(mapped["reasoning"]["effort"], "max");
    }

    #[test]
    fn custom_effort_labels_are_forwarded_as_effort_not_as_model_text() {
        let mut provider = provider(&[]);
        provider
            .meta
            .as_mut()
            .unwrap()
            .codex_model_mapping
            .as_mut()
            .unwrap()
            .effort_map
            .insert("gpt-5.6-terra@terra".into(), "gpt-5.6-sol@custom".into());
        let mapped = apply(
            json!({
                "model": "gpt-5.6-terra",
                "reasoning": {"effort": "terra"}
            }),
            &provider,
        );

        assert_eq!(mapped["model"], "gpt-5.6-sol");
        assert_eq!(mapped["reasoning"]["effort"], "custom");
    }
}
