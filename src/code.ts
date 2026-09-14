import { applyRenames, collectBoundVariableIds, snapshotLocalVariables } from './figma/variables';
import type { MainToUiMessage, UiToMainMessage } from './protocol/messages';

declare const UI_HTML: string;

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

figma.showUI(UI_HTML, { width: 400, height: 560, themeColors: true });

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
        case 'resize':
          figma.ui.resize(
            Math.max(320, Math.min(720, raw.width || 400)),
            Math.max(360, Math.min(900, raw.height || 560))
          );
          break;
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
