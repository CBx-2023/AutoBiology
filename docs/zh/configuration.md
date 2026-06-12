---
layout: default
title: 配置说明
lang: zh-CN
---

# 配置说明

AutoBiology 使用 JSON 配置文件。LLM 配置不再读取环境变量。

## 配置文件位置

全局配置：

```text
~/.autob/config.json
```

项目配置：

```text
./.autob.json
```

全局配置保存基础设置和 API key。项目配置只覆盖当前仓库需要调整的非敏感字段。

## 全局配置示例

```json
{
  "llm": {
    "provider": "deepseek",
    "baseUrl": "https://api.deepseek.com/v1",
    "apiKey": "<your-api-key>",
    "model": "deepseek-chat",
    "timeoutMs": 30000
  }
}
```

## 项目配置示例

```json
{
  "llm": {
    "provider": "custom",
    "baseUrl": "https://llm.example/v1",
    "model": "project-model",
    "timeoutMs": 12000
  }
}
```

项目配置不能包含 `llm.apiKey`。请只把 API key 放在 `~/.autob/config.json`。

## 合并规则

AutoBiology 会浅合并 `llm` 对象：

- 项目配置中的 `provider`、`baseUrl`、`model` 和 `timeoutMs` 覆盖全局值。
- 全局配置中的 `apiKey` 会保留。
- 配置文件不存在时按空配置处理。
- 配置格式错误时会快速失败，并给出可操作的错误信息。

## 查看当前配置

```bash
autob config show
```

输出会显示合并后的配置，并标注字段来源是 `Global`、`Project` 还是 `Unset`。API key 会被脱敏显示。

只有合并后 `apiKey`、`baseUrl` 和 `model` 都已设置时，LLM 推理才可用。运行后的实际证据可查看 `run-meta.json`、`06-clarifications.json`，以及 `04-requirements.json` 中的 LLM candidate 记录。
