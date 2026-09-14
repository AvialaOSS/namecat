/**
 * Structural path rules shared with VarCat (charset, group, camelCase slots).
 * Closed vocabulary / template axes stay in VarCat — NameCat only blocks
 * names that cannot be legal Figma Variable paths under the paradigm charset.
 */

export type StructureIssue = {
  code: 'empty' | 'illegalChar' | 'emptySegment' | 'missingGroup' | 'slotCase';
  message: string;
};

const LEGAL_PATH_PATTERN = /^[a-zA-Z0-9/-]+$/;
const SLOT_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

export const normalizeVariablePath = (raw: string): string =>
  String(raw)
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .join('/');

export const validateStructure = (path: string): StructureIssue[] => {
  const issues: StructureIssue[] = [];
  if (!path) {
    return [{ code: 'empty', message: '路径为空' }];
  }
  if (!LEGAL_PATH_PATTERN.test(path)) {
    const offenders = [...new Set(path.split('').filter((ch) => !/[a-zA-Z0-9/-]/.test(ch)))];
    issues.push({
      code: 'illegalChar',
      message: `非法字符 ${offenders.map((c) => JSON.stringify(c)).join(', ')}（仅允许 a-zA-Z0-9- 与 /）`
    });
  }
  const segments = path.split('/');
  if (segments.some((segment) => segment.length === 0)) {
    issues.push({ code: 'emptySegment', message: '路径含空段' });
  }
  if (segments.length < 2) {
    issues.push({ code: 'missingGroup', message: '必须包含分组（至少一层 /）' });
  }
  for (const segment of segments) {
    if (!segment) continue;
    for (const slot of segment.split('-')) {
      if (!slot) {
        issues.push({ code: 'emptySegment', message: '连字符两侧不能为空' });
        continue;
      }
      if (!SLOT_PATTERN.test(slot)) {
        issues.push({
          code: 'slotCase',
          message: `「${slot}」须以小写字母开头，段内用 camelCase`
        });
      }
    }
  }
  return issues;
};

export const isStructurallyValid = (path: string): boolean => validateStructure(path).length === 0;
