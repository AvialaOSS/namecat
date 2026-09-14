import { applyRenames, collectBoundVariableIds, snapshotLocalVariables } from './figma/variables';
import type { MainToUiMessage, UiToMainMessage } from './protocol/messages';

declare const UI_HTML: string;

const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 560;
const DEFAULT_LIST_HEIGHT = 160;
const DEFAULT_FOLLOW_VARCAT = true;
const MIN_WIDTH = 320;
const MAX_WIDTH = 960;
const MIN_HEIGHT = 360;
const MAX_HEIGHT = 960;
const MIN_LIST_HEIGHT = 80;
const MAX_LIST_HEIGHT = 420;
const SIZE_KEY = 'namecat.ui.size';

type StoredPrefs = {
  w: number;
  h: number;
  listHeight: number;
  followVarcatStructure: boolean;
};

const clampWidth = (width: number) =>
  Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.floor(width)));

const clampHeight = (height: number) =>
  Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.floor(height)));

const clampListHeight = (height: number) =>
  Math.max(MIN_LIST_HEIGHT, Math.min(MAX_LIST_HEIGHT, Math.floor(height)));

const post = (message: MainToUiMessage) => {
  figma.ui.postMessage(message);
};

let prefs: StoredPrefs = {
  w: DEFAULT_WIDTH,
  h: DEFAULT_HEIGHT,
  listHeight: DEFAULT_LIST_HEIGHT,
  followVarcatStructure: DEFAULT_FOLLOW_VARCAT
};

const readStoredPrefs = async (): Promise<StoredPrefs> => {
  const stored = await figma.clientStorage.getAsync(SIZE_KEY);
  const next: StoredPrefs = {
    w: DEFAULT_WIDTH,
    h: DEFAULT_HEIGHT,
    listHeight: DEFAULT_LIST_HEIGHT,
    followVarcatStructure: DEFAULT_FOLLOW_VARCAT
  };
  if (typeof stored === 'number' && Number.isFinite(stored)) {
    next.w = clampWidth(stored);
    return next;
  }
  if (stored && typeof stored === 'object') {
    const row = stored as {
      w?: unknown;
      h?: unknown;
      listHeight?: unknown;
      followVarcatStructure?: unknown;
    };
    if (typeof row.w === 'number' && Number.isFinite(row.w)) next.w = clampWidth(row.w);
    if (typeof row.h === 'number' && Number.isFinite(row.h)) next.h = clampHeight(row.h);
    if (typeof row.listHeight === 'number' && Number.isFinite(row.listHeight)) {
      next.listHeight = clampListHeight(row.listHeight);
    }
    if (typeof row.followVarcatStructure === 'boolean') {
      next.followVarcatStructure = row.followVarcatStructure;
    }
  }
  return next;
};

const writeStoredPrefs = async (patch: Partial<StoredPrefs>) => {
  prefs = {
    w: patch.w !== undefined ? clampWidth(patch.w) : prefs.w,
    h: patch.h !== undefined ? clampHeight(patch.h) : prefs.h,
    listHeight:
      patch.listHeight !== undefined ? clampListHeight(patch.listHeight) : prefs.listHeight,
    followVarcatStructure:
      patch.followVarcatStructure !== undefined
        ? patch.followVarcatStructure
        : prefs.followVarcatStructure
  };
  await figma.clientStorage.setAsync(SIZE_KEY, prefs);
};

const pushSnapshot = async () => {
  const boundIds = collectBoundVariableIds(figma.currentPage.selection);
  const variables = await snapshotLocalVariables(boundIds);
  post({
    type: 'ready',
    variables,
    selectionBoundCount: [...boundIds].filter((id) => variables.some((v) => v.id === id)).length,
    prefs: {
      listHeight: prefs.listHeight,
      followVarcatStructure: prefs.followVarcatStructure
    }
  });
};

const main = async () => {
  prefs = await readStoredPrefs();
  figma.showUI(UI_HTML, { width: prefs.w, height: prefs.h, themeColors: true });

  figma.on('selectionchange', () => {
    void pushSnapshot().catch((error) => {
      post({
        type: 'error',
        message: error instanceof Error ? error.message : String(error)
      });
    });
  });

  figma.ui.onmessage = (raw: UiToMainMessage) => {
    void (async () => {
      try {
        switch (raw.type) {
          case 'init':
          case 'refresh':
            await pushSnapshot();
            break;
          case 'apply': {
            const result = await applyRenames(raw.renames ?? []);
            post({ type: 'applied', ...result });
            const ok = result.renamed.length;
            const bad = result.failed.length;
            if (ok > 0 && bad === 0) {
              figma.notify(`已重命名 ${ok} 个变量`);
            } else if (ok > 0) {
              figma.notify(`已重命名 ${ok} 个，失败 ${bad} 个`);
            } else if (bad > 0) {
              figma.notify(`重命名失败 ${bad} 个`, { error: true });
            } else {
              figma.notify('没有需要重命名的变量');
            }
            await pushSnapshot();
            break;
          }
          case 'resize': {
            const width = clampWidth(raw.width || DEFAULT_WIDTH);
            const height = clampHeight(raw.height || DEFAULT_HEIGHT);
            figma.ui.resize(width, height);
            if (raw.persist !== false) {
              await writeStoredPrefs({ w: width, h: height });
            } else {
              prefs = { ...prefs, w: width, h: height };
            }
            break;
          }
          case 'prefs': {
            const patch: Partial<StoredPrefs> = {};
            if (typeof raw.listHeight === 'number') patch.listHeight = raw.listHeight;
            if (typeof raw.followVarcatStructure === 'boolean') {
              patch.followVarcatStructure = raw.followVarcatStructure;
            }
            if (raw.persist !== false) {
              await writeStoredPrefs(patch);
            } else {
              prefs = {
                ...prefs,
                ...(patch.listHeight !== undefined
                  ? { listHeight: clampListHeight(patch.listHeight) }
                  : {}),
                ...(patch.followVarcatStructure !== undefined
                  ? { followVarcatStructure: patch.followVarcatStructure }
                  : {})
              };
            }
            break;
          }
          case 'close':
            figma.closePlugin();
            break;
          default:
            break;
        }
      } catch (error) {
        post({
          type: 'error',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    })();
  };
};

void main();
