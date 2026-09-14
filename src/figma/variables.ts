import type {
  RenameFailure,
  RenameRequest,
  RenameSuccess,
  VariableInfo,
  VariableResolvedType
} from '../protocol/messages';

const toInfo = (
  variable: Variable,
  collectionName: string,
  boundIds: Set<string>
): VariableInfo => ({
  id: variable.id,
  name: variable.name,
  resolvedType: variable.resolvedType as VariableResolvedType,
  collectionId: variable.variableCollectionId,
  collectionName,
  isRemote: variable.remote,
  boundToSelection: boundIds.has(variable.id)
});

/** Collect variable ids bound on the current selection (including nested). */
export const collectBoundVariableIds = (nodes: readonly SceneNode[]): Set<string> => {
  const ids = new Set<string>();

  const visit = (node: SceneNode) => {
    const bound = 'boundVariables' in node ? node.boundVariables : null;
    if (bound) {
      for (const value of Object.values(bound)) {
        const refs = Array.isArray(value) ? value : value ? [value] : [];
        for (const ref of refs) {
          if (ref && typeof ref === 'object' && 'id' in ref && typeof ref.id === 'string') {
            ids.add(ref.id);
          }
        }
      }
    }
    if ('children' in node) {
      for (const child of node.children) visit(child);
    }
  };

  for (const node of nodes) visit(node);
  return ids;
};

export const snapshotLocalVariables = async (
  boundIds: Set<string>
): Promise<VariableInfo[]> => {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const names = new Map(collections.map((c) => [c.id, c.name]));
  const variables = await figma.variables.getLocalVariablesAsync();
  return variables
    .map((variable) => toInfo(variable, names.get(variable.variableCollectionId) ?? '', boundIds))
    .sort((a, b) => {
      const byCollection = a.collectionName.localeCompare(b.collectionName);
      if (byCollection !== 0) return byCollection;
      return a.name.localeCompare(b.name);
    });
};

export type ApplyRenamesResult = {
  renamed: RenameSuccess[];
  failed: RenameFailure[];
};

/**
 * Rename only. Never creates collections or writes values.
 * Remote (library) variables are skipped with a per-item error.
 */
export const applyRenames = async (
  renames: readonly RenameRequest[]
): Promise<ApplyRenamesResult> => {
  const renamed: RenameSuccess[] = [];
  const failed: RenameFailure[] = [];
  const variables = await figma.variables.getLocalVariablesAsync();
  const byId = new Map(variables.map((variable) => [variable.id, variable]));

  for (const { variableId, newName } of renames) {
    const variable = byId.get(variableId);
    if (!variable) {
      failed.push({
        variableId,
        oldName: '',
        newName,
        error: '变量已不存在'
      });
      continue;
    }
    const oldName = variable.name;
    if (variable.remote) {
      failed.push({
        variableId,
        oldName,
        newName,
        error: '无法重命名团队库中的远程变量'
      });
      continue;
    }
    if (newName === oldName) continue;
    try {
      variable.name = newName;
      renamed.push({ variableId, oldName, newName });
    } catch (error) {
      failed.push({
        variableId,
        oldName,
        newName,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return { renamed, failed };
};
