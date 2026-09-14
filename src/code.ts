import { applyRenames, collectBoundVariableIds, snapshotLocalVariables } from './figma/variables';
import type { MainToUiMessage, UiToMainMessage } from './protocol/messages';

declare const UI_HTML: string;

const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 560;
const MIN_WIDTH = 320;
const MAX_WIDTH = 960;
const SIZE_KEY = 'namecat.ui.size';

const clampWidth = (width: number) =>
  Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.floor(width)));

const post = (message: MainToUiMessage) => {
  figma.ui.postMessage(message);
};

const pushSnapshot = async () => {
  const boundIds = collectBoundVariableIds(figma.currentPage.selection);
  const variables = await snapshotLocalVariables(boundIds);
  post({
    type: 'ready',
    variables,
    selectionBoundCount: [...boundIds].filter((id) => variables.some((v) => v.id === id)).length
  });
};

const readStoredWidth = async (): Promise<number | null> => {
  const stored = await figma.clientStorage.getAsync(SIZE_KEY);
  if (typeof stored === 'number' && Number.isFinite(stored)) return clampWidth(stored);
  if (
    stored &&
    typeof stored === 'object' &&
    'w' in stored &&
    typeof (stored as { w?: unknown }).w === 'number' &&
    Number.isFinite((stored as { w: number }).w)
  ) {
    return clampWidth((stored as { w: number }).w);
  }
  return null;
};

const main = async () => {
  figma.showUI(UI_HTML, { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT, themeColors: true });

  const storedWidth = await readStoredWidth();
  if (storedWidth !== null) {
    figma.ui.resize(storedWidth, DEFAULT_HEIGHT);
  }

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
            const height = DEFAULT_HEIGHT;
            figma.ui.resize(width, height);
            if (raw.persist !== false) {
              await figma.clientStorage.setAsync(SIZE_KEY, { w: width, h: height });
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
