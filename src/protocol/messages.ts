/**
 * postMessage contract — no `figma` or DOM types so both sides can import it.
 */

export type VariableResolvedType = 'FLOAT' | 'STRING' | 'BOOLEAN' | 'COLOR';

export type VariableInfo = {
  id: string;
  name: string;
  resolvedType: VariableResolvedType;
  collectionId: string;
  collectionName: string;
  isRemote: boolean;
  /** True when this variable is bound to the current canvas selection. */
  boundToSelection: boolean;
};

export type UiPrefs = {
  listHeight: number;
};

export type RenameRequest = { variableId: string; newName: string };

export type RenameSuccess = {
  variableId: string;
  oldName: string;
  newName: string;
};

export type RenameFailure = {
  variableId: string;
  oldName: string;
  newName: string;
  error: string;
};

export type UiToMainMessage =
  | { type: 'init' }
  | { type: 'refresh' }
  | { type: 'apply'; renames: RenameRequest[] }
  | { type: 'resize'; width: number; height: number; persist?: boolean }
  | { type: 'prefs'; listHeight: number; persist?: boolean }
  | { type: 'close' };

export type MainToUiMessage =
  | {
      type: 'ready';
      variables: VariableInfo[];
      selectionBoundCount: number;
      prefs: UiPrefs;
    }
  | {
      type: 'applied';
      renamed: RenameSuccess[];
      failed: RenameFailure[];
    }
  | { type: 'error'; message: string };
