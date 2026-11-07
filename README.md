# dsh-plugin-chatgpt

Adds the ChatGPT provider and its installed Codex model catalog to the normal DeepSeek Harness model selector. Targets DSH Desktop 0.2.2-rc.1.

Open Settings → ChatGPT → Sign in with ChatGPT. Follow the verification link and code. Then choose a model from ChatGPT in the chat model selector. Your plan must include Codex access; plan limits apply.

Uses the shipped llm-pi-ai adapter and authorization/credentials services for streaming, tools, images, reasoning effort and credential refresh. Does not read or copy Codex CLI credentials. Sign out deletes only the Harness openai-codex credential.

The bundle configures the existing llm-pi-ai row. If you have customized that row in your own profile patch, merge openai-codex: { displayName: ChatGPT } into its providers dictionary; profile patches take precedence over bundles.

## Install

Requires DeepSeek Harness Desktop 0.2.2-rc.1 with the `dsh` command installed.

```sh
dsh plugin --profile desktop add github:jeremytenjo/dsh-plugin-chatgpt
```

Quit and reopen Harness, then open Settings → ChatGPT and sign in. The plugin includes its built browser client; installation does not require a build.

## Develop

```sh
npm install
npm run build
npm test
```

Native adapter integration check (point to an unpacked DSH adapter):

```sh
DSH_ADAPTER_MODULE=/absolute/path/to/dsh-llm-pi-ai/lib/index.js node test/native-efforts.mjs
```

## Reasoning effort

The bundle overrides each installed ChatGPT model's supported effort map. Minimal is not offered as an alias for Low. DSH's Off sends OpenAI `none` only for models that support it. GPT-6 Astra and GPT-6.1 Sol offer Low, Medium, High, Xhigh and Max. Default leaves effort unset. GPT-5.5 offers Off through Xhigh; GPT-5.6 models and GPT-6 Luna/Sol add Max.

Sources checked November 7, 2026: https://developers.openai.com/api/docs/guides/deployment-checklist and the GPT-5.5 / GPT-5.6 model pages.

## Sidebar usage

The ChatGPT sidebar button shows remaining quota and opens a panel with plan, usage windows, credits, and a Manage usage link. Hover over a usage row to see its reset time. It refreshes every minute, on window focus, and when opened. Missing buckets and network failures show as unavailable.

Requires a local Codex executable (the Codex Mac app, Homebrew Codex, or codex on PATH). Reads usage through Codex App Server using the ChatGPT account stored by Harness. The helper uses an isolated temporary home, transmits the access token over a private process pipe, and cleans up after reading. It does not read or overwrite the Codex app/CLI login, consume reset credits, or make model requests. Token refresh remains owned by Harness; if the stored access token expires while idle, resume model usage or renew sign-in.

The monochrome ChatGPT brand mark identifies the provider. ChatGPT and OpenAI marks belong to OpenAI; this is an independent community plugin.
