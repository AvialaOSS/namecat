/**
 * NameCat panel — Figma Rename layers layout, Chinese copy, Spiral chrome.
 * Preview | Match (optional) | Rename to | chips | Start ascending from | Cancel / Rename
 */
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import {
  Alert,
  Button,
  CheckboxInput,
  Input,
  Pagehead,
  Scroll,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Stack,
  Switch,
  Typography
} from '@aviala-design/spiral';
import {
  TYPE_OPTIONS,
  filterCandidates,
  listCollections,
  type CandidateScope
} from '../filter/candidates';
import { isStructurallyValid, validateStructure } from '../paradigm/structure';
import type { MainToUiMessage, VariableInfo, VariableResolvedType } from '../protocol/messages';
import {
  TOKEN_CURRENT,
  TOKEN_NUMBER_ASC,
  TOKEN_NUMBER_DESC,
  buildRenamePlan
} from '../rename/expand';

const post = (message: unknown) => parent.postMessage({ pluginMessage: message }, '*');

const MIN_WIDTH = 320;
const MAX_WIDTH = 960;
const MIN_HEIGHT = 360;
const MAX_HEIGHT = 960;
const DEFAULT_LIST_HEIGHT = 160;
const MIN_LIST_HEIGHT = 80;
const MAX_LIST_HEIGHT = 420;

const clampWidth = (width: number) =>
  Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.floor(width)));

const clampHeight = (height: number) =>
  Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.floor(height)));

const clampListHeight = (height: number) =>
  Math.max(MIN_LIST_HEIGHT, Math.min(MAX_LIST_HEIGHT, Math.floor(height)));

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

type ResizeAxis = 'x' | 'y' | 'xy';

type DragState = {
  axis: ResizeAxis;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
};

const emitResize = (width: number, height: number, persist: boolean) => {
  post({
    type: 'resize',
    width: clampWidth(width),
    height: clampHeight(height),
    persist
  });
};

const sizeFromDrag = (drag: DragState, event: PointerEvent) => {
  const width =
    drag.axis === 'y' ? drag.startWidth : drag.startWidth + (event.clientX - drag.startX);
  const height =
    drag.axis === 'x' ? drag.startHeight : drag.startHeight + (event.clientY - drag.startY);
  return { width, height };
};

/** Right / bottom / corner handles → figma.ui.resize(w, h). */
const PanelResizeHandles = () => {
  const [dragging, setDragging] = useState<ResizeAxis | null>(null);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const next = sizeFromDrag(drag, event);
      emitResize(next.width, next.height, false);
    };

    const onUp = (event: PointerEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      setDragging(null);
      if (!drag) return;
      const next = sizeFromDrag(drag, event);
      emitResize(next.width, next.height, true);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging]);

  const startDrag = (axis: ResizeAxis, event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragRef.current = {
      axis,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: window.innerWidth,
      startHeight: window.innerHeight
    };
    setDragging(axis);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  return (
    <>
      <div
        className="nc-resize nc-resize--e"
        data-dragging={dragging === 'x' ? 'true' : 'false'}
        role="separator"
        aria-orientation="vertical"
        aria-label="拖拽调整插件宽度"
        title="拖拽调整宽度"
        onPointerDown={(event) => startDrag('x', event)}
      />
      <div
        className="nc-resize nc-resize--s"
        data-dragging={dragging === 'y' ? 'true' : 'false'}
        role="separator"
        aria-orientation="horizontal"
        aria-label="拖拽调整插件高度"
        title="拖拽调整高度"
        onPointerDown={(event) => startDrag('y', event)}
      />
      <div
        className="nc-resize nc-resize--se"
        data-dragging={dragging === 'xy' ? 'true' : 'false'}
        role="separator"
        aria-label="拖拽调整插件宽高"
        title="拖拽调整宽高"
        onPointerDown={(event) => startDrag('xy', event)}
      />
    </>
  );
};

type ListPaneProps = {
  height: number;
  onHeightChange: (height: number, persist: boolean) => void;
  children: ReactNode;
};

/** Independent height for the 待选列表 pane. */
const ResizableCandidateList = ({ height, onHeightChange, children }: ListPaneProps) => {
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      onHeightChange(clampListHeight(drag.startHeight + (event.clientY - drag.startY)), false);
    };
    const onUp = (event: PointerEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      setDragging(false);
      if (!drag) return;
      onHeightChange(clampListHeight(drag.startHeight + (event.clientY - drag.startY)), true);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, onHeightChange]);

  return (
    <div className="nc-pick-shell">
      <div className="nc-pick" style={{ height }}>
        {children}
      </div>
      <div
        className="nc-pick-split"
        data-dragging={dragging ? 'true' : 'false'}
        role="separator"
        aria-orientation="horizontal"
        aria-label="拖拽调整待选列表高度"
        title="拖拽调整待选列表高度"
        onPointerDown={(event) => {
          event.preventDefault();
          dragRef.current = { startY: event.clientY, startHeight: height };
          setDragging(true);
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
      />
    </div>
  );
};

export const App = () => {
  const [variables, setVariables] = useState<VariableInfo[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [match, setMatch] = useState('');
  const [renameTo, setRenameTo] = useState(TOKEN_CURRENT);
  const [start, setStart] = useState(1);
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [scope, setScope] = useState<CandidateScope>('all');
  const [collectionId, setCollectionId] = useState('all');
  const [resolvedType, setResolvedType] = useState<VariableResolvedType | 'all'>('all');
  const [segment, setSegment] = useState('');
  const [requireSlash, setRequireSlash] = useState(false);
  const [listHeight, setListHeight] = useState(DEFAULT_LIST_HEIGHT);
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
        if (message.prefs?.listHeight) {
          setListHeight(clampListHeight(message.prefs.listHeight));
        }
        setError(null);
        if (!seededRef.current) {
          seededRef.current = true;
          const bound = message.variables.filter((v) => v.boundToSelection && !v.isRemote);
          if (bound.length > 0) {
            setSelectedIds(new Set(bound.map((v) => v.id)));
            setScope('bound');
          } else {
            setSelectedIds(new Set());
          }
        } else {
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

  const collections = useMemo(() => listCollections(variables), [variables]);

  const { items: filtered, regexError } = useMemo(
    () =>
      filterCandidates(variables, {
        query,
        caseSensitive,
        useRegex,
        scope,
        collectionId,
        resolvedType,
        segment,
        requireSlash
      }),
    [variables, query, caseSensitive, useRegex, scope, collectionId, resolvedType, segment, requireSlash]
  );

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

  const toggle = (id: string, on: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const v of filtered) next.add(v.id);
      return next;
    });
  };

  const clearSelected = () => setSelectedIds(new Set());

  const onListHeightChange = useCallback((height: number, persist: boolean) => {
    const next = clampListHeight(height);
    setListHeight(next);
    post({ type: 'prefs', listHeight: next, persist });
  }, []);

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
      <PanelResizeHandles />
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
            <Typography level="caption">待选变量</Typography>

            <div className="nc-row nc-row--tight">
              <Button
                mode={scope === 'all' ? 'primary' : 'outline'}
                size="small"
                type="button"
                onClick={() => setScope('all')}
              >
                全部本地
              </Button>
              <Button
                mode={scope === 'bound' ? 'primary' : 'outline'}
                size="small"
                type="button"
                onClick={() => setScope('bound')}
              >
                画板绑定
              </Button>
              <Select
                value={collectionId}
                onValueChange={(value) => setCollectionId(value)}
              >
                <SelectTrigger className="nc-grow" aria-label="集合筛选" size="regular">
                  <SelectValue placeholder="全部集合" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部集合</SelectItem>
                  {collections.map((collection) => (
                    <SelectItem key={collection.id} value={collection.id}>
                      {collection.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={resolvedType}
                onValueChange={(value) =>
                  setResolvedType(value as VariableResolvedType | 'all')
                }
              >
                <SelectTrigger aria-label="类型筛选" size="regular">
                  <SelectValue placeholder="全部类型" />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="nc-row nc-row--tight">
              <Input
                className="nc-grow"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={useRegex ? '名称正则，如 button/.+-rest' : '名称包含…'}
              />
              <label className="nc-switch">
                <Switch
                  size="small"
                  checked={caseSensitive}
                  onCheckedChange={setCaseSensitive}
                />
                <Typography level="caption">区分大小写</Typography>
              </label>
              <label className="nc-switch">
                <Switch size="small" checked={useRegex} onCheckedChange={setUseRegex} />
                <Typography level="caption">正则</Typography>
              </label>
            </div>

            <div className="nc-row nc-row--tight">
              <Input
                className="nc-grow"
                value={segment}
                onChange={(event) => setSegment(event.target.value)}
                placeholder="路径段包含…（如 primary）"
              />
              <label className="nc-switch">
                <Switch
                  size="small"
                  checked={requireSlash}
                  onCheckedChange={setRequireSlash}
                />
                <Typography level="caption">须含 /</Typography>
              </label>
            </div>

            {regexError ? (
              <p className="nc-warn">正则无效：{regexError}</p>
            ) : null}

            <div className="nc-row nc-row--tight">
              <Typography level="caption">
                待选列表 · {filtered.length} / {variables.filter((v) => !v.isRemote).length}
              </Typography>
              <span className="nc-push" />
              <Button mode="outline" size="small" type="button" onClick={selectVisible}>
                全选可见
              </Button>
              <Button mode="noBackground" size="small" type="button" onClick={clearSelected}>
                清空勾选
              </Button>
            </div>

            <ResizableCandidateList height={listHeight} onHeightChange={onListHeightChange}>
              {filtered.length === 0 ? (
                <div className="nc-pick-row">
                  <Typography level="caption">没有符合筛选的变量</Typography>
                </div>
              ) : (
                filtered.map((variable) => (
                  <div key={variable.id} className="nc-pick-row">
                    <CheckboxInput
                      title={variable.name}
                      description={`${variable.collectionName} · ${variable.resolvedType}${
                        variable.boundToSelection ? ' · 画板绑定' : ''
                      }`}
                      checked={selectedIds.has(variable.id)}
                      onCheckedChange={(value) => toggle(variable.id, value === true)}
                    />
                  </div>
                ))
              )}
            </ResizableCandidateList>
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
              <Button
                mode="outline"
                size="small"
                type="button"
                onClick={() => insertToken(TOKEN_CURRENT)}
              >
                当前名称
              </Button>
              <Button
                mode="outline"
                size="small"
                type="button"
                onClick={() => insertToken(TOKEN_NUMBER_ASC)}
              >
                编号 ↑
              </Button>
              <Button
                mode="outline"
                size="small"
                type="button"
                onClick={() => insertToken(TOKEN_NUMBER_DESC)}
              >
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
              {invalid.length}{' '}
              个新路径不符合 VarCat 结构规则（charset / 分组 / camelCase），请调整后再重命名。
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
          <Button mode="primary" size="regular" disabled={!canRename} onClick={onRename}>
            {busy ? '重命名中…' : '重命名'}
          </Button>
        </Stack>
      </div>
    </div>
  );
};
