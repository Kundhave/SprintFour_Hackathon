/** Domain layer barrel — the pure, I/O-free product core (CLAUDE.md §5). */
export * from './types';
export * from './policy';
export { locateSpans, type SemanticFinding } from './locate';
export { reconcile } from './reconciler';
export { route } from './router';
export { group } from './grouper';
export { buildExport, type ExportResult } from './exportBuilder';
