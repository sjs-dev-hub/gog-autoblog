# Phase 1 article prototype

Nothing under `_prototype/` or `_drafts/` is published by the production GitHub Pages build.

Generate the three deterministic review drafts:

```sh
node scripts/prototype/generate.js --fixtures
```

Generate fresh model-backed drafts from the evidence briefs:

```sh
OPENAI_API_KEY=... OPENAI_MODEL=gpt-5.6-terra node scripts/prototype/generate.js
```

The generator always writes to `_drafts/prototypes/`. It never writes to `_posts/` and it does not commit or push.

Run the quality tests:

```sh
node --test scripts/prototype/quality.test.js
```
