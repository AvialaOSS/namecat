# NameCat

Figma plugin that **batch-renames Variables** with the same shape as Figma’s native
**Rename layers** dialog: Preview → Match (optional) → Rename to → chips
（当前名称 / 编号 ↑ / 编号 ↓）→ 起始编号 → 取消 / 重命名.

Title reads **重命名 N 个变量**. UI is Chinese and built with
[`@aviala-design/spiral`](https://github.com/AvialaOSS/developer-kit). Path structure
checks reuse VarCat’s charset / group / camelCase rules. NameCat **only renames** —
it does not create collections or write unbound values.

**Not [VarCat](https://github.com/AvialaOSS/varcat).** VarCat creates empty variable
shells from templates. NameCat renames existing ones.

## Install

`dist/` is gitignored. Build before importing the manifest.

```bash
npm install
npm run build          # writes dist/code.js + dist/ui.html
```

In **Figma desktop**:

1. **Plugins → Development → Import plugin from manifest…**
2. Pick `manifest.json` in this folder
3. Run **NameCat**

After code changes: `npm run build` (or `npm run watch`), then right-click the
plugin in Development → **Reload plugin**.

| Script | What it does |
|--------|--------------|
| `npm run build` | Bundles `dist/code.js` + `dist/ui.html` |
| `npm run watch` | Same, on save |
| `npm test` | Rename template expansion + structure checks |
| `npm run typecheck` | `tsc --noEmit` |

## Using the plugin

1. **选择变量** — tick local variables (filter by path/collection). **画板绑定**
   pre-selects variables bound to the current canvas selection.
2. **预览** — live before → after list.
3. **匹配（可选）** — if set, only names containing this substring are changed;
   each occurrence is replaced by the expanded **重命名为** template.
4. **重命名为** — plain text plus tokens from the chips:
   - **当前名称** → `{{current}}`
   - **编号 ↑** → `{{n}}` (start, start+1, …)
   - **编号 ↓** → `{{n-desc}}` (highest first)
5. **起始编号** — base for the number tokens.
6. **重命名** — applies `variable.name = …` only. Remote library variables are skipped.

Illegal paths (spaces, missing `/` group, non-camelCase slots) block Apply until fixed.

## Repository layout

```
namecat/
├── manifest.json
├── src/
│   ├── code.ts              plugin entry
│   ├── rename/expand.ts     pure Match / Rename-to expansion
│   ├── paradigm/structure.ts  VarCat-aligned path structure checks
│   ├── figma/variables.ts   snapshot + apply renames
│   ├── protocol/messages.ts
│   └── ui/                  Spiral React panel
├── scripts/build.mjs
└── tests/expand.test.ts
```
