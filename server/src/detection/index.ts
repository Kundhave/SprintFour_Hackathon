/** Detection layer barrel — two detectors behind one interface, plus a Mock (CLAUDE.md §5). */
export type { Detector } from './detector';
export { deterministicDetector } from './deterministic';
export { semanticDetector, OLLAMA_MODEL, OLLAMA_URL } from './semantic';
export { mockDetector } from './mock';
