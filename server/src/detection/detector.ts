import type { Span } from '../domain/types';

/**
 * The single detection interface (CLAUDE.md §5). Every detector — deterministic, semantic,
 * and the Mock — implements exactly this, so they are swappable and the domain never knows
 * which one ran.
 */
export interface Detector {
  /** The detector's name, for disclosure/debugging. */
  readonly name: string;
  /** Find candidate PII spans in `text`. Offsets are located in OUR code, not trusted from a model. */
  detect(text: string): Promise<Span[]>;
}
