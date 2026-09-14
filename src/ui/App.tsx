/**
 * NameCat panel — Figma Rename layers layout, Chinese copy, Spiral chrome.
 * Preview | Match (optional) | Rename to | chips | Start ascending from | Cancel / Rename
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  CheckboxInput,
  Input,
  Pagehead,
  Scroll,
  Stack,
  Typography
} from '@aviala-design/spiral';
import { isStructurallyValid, validateStructure } from '../paradigm/structure';
import type { MainToUiMessage, VariableInfo } from '../protocol/messages';
import {
  TOKEN_CURRENT,
  TOKEN_NUMBER_ASC,
  TOKEN_NUMBER_DESC,
  buildRenamePlan
} from '../rename/expand';

const post = (message: unknown) => parent.postMessage({ pluginMessage: message }, '*');

const insertAtCursor = (
  value: string,
  token: string,
  input: HTMLInputElement | null
): string => {
  if (!input) return `${value}${token}`;
  const start = input.selectionStart ?? value.length;
  const end = input.selectionEnd ?? value.length;
  return value.slice(0, start) + token + value.slice(end);
};

export const App = () => {
  const [variables, setVariables] = useState<VariableInfo[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [match, setMatch] = useState('');
  const [renameTo, setRenameTo] = useState(TOKEN_CURRENT);
  const [start, setStart] = useState(1);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const seededRef = useRef(false);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const message = event.data?.pluginMessage as MainToUiMessage | undefined;
      if (!message) return;
      if (message.type === 'ready') {
        setVariables(message.variables);
        setError(null);
        if (!seededRef.current) {
          seededRef.current = true;
          const bound = message.variables.filter((v) => v.boundToSelection && !v.isRemote);
          if (bound.length > 0) {
            setSelectedIds(new Set(bound.map((v) => v.id)));
          } else {
            // No canvas binding — pre-select nothing; user picks from the list.
            setSelectedIds(new Set());
          }
        } else {
          // Keep ticks that still exist; drop gone ids.
          setSelectedIds((prev) => {
            const alive = new Set(message.variables.map((v) => v.id));
            return new Set([...prev].filter((id) => alive.has(id)));
          });
        }
      } else if (message.type === 'applied') {
        setBusy(false);
        const ok = message.renamed.length;
        const bad = message.failed.length;
        setStatus(
          bad > 0
            ? `已重命名 ${ok} 个，失败 ${bad} 个${
                message.failed[0] ? `：${message.failed[0].error}` : ''
              }`
            : `已重命名 ${ok} 个变量`
        );
      } else if (message.type === 'error') {
        setBusy(false);
        setError(message.message);
      }
    };
    window.addEventListener('message', onMessage);
    post({ type: 'init' });
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const selected = useMemo(
    () => variables.filter((v) => selectedIds.has(v.id)),
    [variables, selectedIds]
  );

  const plan = useMemo(
    () =>
      buildRenamePlan({
        items: selected.map((v) => ({ id: v.id, name: v.name })),
        match,
        renameTo,
        start
      }),
    [selected, match, renameTo, start]
  );

  const actionable = plan.filter((row) => !row.skipped && !row.unchanged);
  const invalid = actionable.filter((row) => !isStructurallyValid(row.newName));
  const canRename = actionable.length > 0 && invalid.length === 0 && !busy;

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return variables;
    return variables.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.collectionName.toLowerCase().includes(q)
    );
  }, [variables, filter]);

  const toggle = (id: string, on: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectBound = () => {
    setSelectedIds(
      new Set(variables.filter((v) => v.boundToSelection && !v.isRemote).map((v) => v.id))
    );
  };

  const selectVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const v of filtered) {
        if (!v.isRemote) next.add(v.id);
      }
      return next;
    });
  };

  const clearSelected = () => setSelectedIds(new Set());

  const insertToken = (token: string) => {
    setRenameTo((value) => insertAtCursor(value, token, renameInputRef.current));
    requestAnimationFrame(() => renameInputRef.current?.focus());
  };

  const onRename = () => {
    if (!canRename) return;
    setBusy(true);
    setStatus(null);
    setError(null);
    post({
      type: 'apply',
      renames: actionable.map((row) => ({ variableId: row.id, newName: row.newName }))
    });
  };

  const title =
    selected.length > 0 ? `重命名 ${selected.length} 个变量` : '重命名变量';

  return (
    <div className="nc-shell">
      <Pagehead
        title={title}
        description="按 Figma「重命名图层」方式批量改 Variables 路径。只改名，不建集合、不写值。"
      />

      <Scroll className="nc-body">
        <div className="nc-body-inner">
          {error ? (
            <Alert
              type="error"
              appearance="light"
              size="small"
              title="出错了"
              description={error}
            />
          ) : null}
          {status ? (
            <Alert
              type="success"
              appearance="light"
              size="small"
              title="完成"
              description={status}
            />
          ) : null}

          <div className="nc-field">
            <Typography level="caption">选择变量</Typography>
            <div className="nc-row nc-row--tight">
              <Input
                className="nc-grow"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="筛选路径或集合"
              />
              <Button mode="outline" size="small" onClick={selectBound}>
                画板绑定
              </Button>
              <Button mode="outline" size="small" onClick={selectVisible}>
                全选可见
              </Button>
              <Button mode="noBackground" size="small" onClick={clearSelected}>
                清空
              </Button>
            </div>
            <div className="nc-pick">
              {filtered.length === 0 ? (
                <div className="nc-pick-row">
                  <Typography level="caption">没有本地变量</Typography>
                </div>
              ) : (
                filtered.map((variable) => (
                  <div key={variable.id} className="nc-pick-row">
                    <CheckboxInput
                      title={variable.name}
                      description={`${variable.collectionName}${
                        variable.boundToSelection ? ' · 画板绑定' : ''
                      }${variable.isRemote ? ' · 远程' : ''}`}
                      checked={selectedIds.has(variable.id)}
                      disabled={variable.isRemote}
                      onCheckedChange={(value) => toggle(variable.id, value === true)}
                    />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="nc-field">
            <Typography level="caption">预览</Typography>
            <div className="nc-preview">
              {plan.length === 0 ? (
                <div className="nc-preview-row">
                  <span className="nc-preview-old">勾选变量后在此预览</span>
                </div>
              ) : (
                plan.map((row) => {
                  const bad =
                    !row.skipped && !row.unchanged && !isStructurallyValid(row.newName);
                  return (
                    <div
                      key={row.id}
                      className="nc-preview-row"
                      data-skip={row.skipped || row.unchanged ? 'true' : 'false'}
                      data-bad={bad ? 'true' : 'false'}
                      title={
                        bad
                          ? validateStructure(row.newName)
                              .map((issue) => issue.message)
                              .join('；')
                          : undefined
                      }
                    >
                      <span className="nc-preview-old">{row.oldName}</span>
                      <span className="nc-preview-arrow">→</span>
                      <span className="nc-preview-new">
                        {row.skipped ? '（无匹配，跳过）' : row.newName || '（空）'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="nc-field">
            <label htmlFor="nc-match">匹配（可选）</label>
            <Input
              id="nc-match"
              value={match}
              onChange={(event) => setMatch(event.target.value)}
              placeholder="仅替换名称中的这段文字"
            />
          </div>

          <div className="nc-field">
            <label htmlFor="nc-rename-to">重命名为</label>
            <Input
              id="nc-rename-to"
              ref={renameInputRef}
              value={renameTo}
              onChange={(event) => setRenameTo(event.target.value)}
              placeholder="可插入下方标记"
            />
            <div className="nc-chips">
              <Button mode="outline" size="small" type="button" onClick={() => insertToken(TOKEN_CURRENT)}>
                当前名称
              </Button>
              <Button mode="outline" size="small" type="button" onClick={() => insertToken(TOKEN_NUMBER_ASC)}>
                编号 ↑
              </Button>
              <Button mode="outline" size="small" type="button" onClick={() => insertToken(TOKEN_NUMBER_DESC)}>
                编号 ↓
              </Button>
            </div>
          </div>

          <div className="nc-field">
            <label htmlFor="nc-start">起始编号</label>
            <Input
              id="nc-start"
              type="number"
              value={String(start)}
              onChange={(event) => {
                const next = Number(event.target.value);
                setStart(Number.isFinite(next) ? Math.trunc(next) : 1);
              }}
            />
          </div>

          {invalid.length > 0 ? (
            <p className="nc-warn">
              {invalid.length} 个新路径不符合 VarCat 结构规则（charset / 分组 / camelCase），请调整后再重命名。
            </p>
          ) : null}
        </div>
      </Scroll>

      <div className="nc-foot">
        <Stack direction="row" gap="inside" className="nc-row">
          <Button mode="outline" size="regular" onClick={() => post({ type: 'close' })}>
            取消
          </Button>
          <span className="nc-push" />
          <Button
            mode="primary"
            size="regular"
            disabled={!canRename}
            onClick={onRename}
          >
            {busy ? '重命名中…' : '重命名'}
          </Button>
        </Stack>
      </div>
    </div>
  );
};
