import type { Span } from './types';

/**
 * The single span store (CLAUDE.md §5, §12: useReducer, no state library). EVERY view derives from
 * this one array; every action is a reversible status toggle on it (CLAUDE.md §4, §10). The reducer
 * is pure, so it is trivially testable and the UI stays logic-free.
 */
export type StoreState = { spans: Span[] };

export type Action =
  | { type: 'init'; spans: Span[] }
  | { type: 'decide'; groupKey: string; decision: 'hide' | 'keep' }
  | { type: 'reverseAuto'; groupKey: string };

export const initialState: StoreState = { spans: [] };

export function spanReducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case 'init':
      return { spans: action.spans };

    case 'decide': {
      // Apply the decision to the whole exact-match group, and toggle it off if it is already set —
      // so Hide and Keep visible are both instantly reversible.
      const target: Span['status'] = action.decision === 'hide' ? 'hidden_by_user' : 'kept_visible';
      const inGroup = (s: Span) => s.groupKey === action.groupKey && s.routedTo === 'review';
      const members = state.spans.filter(inGroup);
      const allAtTarget = members.length > 0 && members.every((s) => s.status === target);
      const next: Span['status'] = allAtTarget ? 'suggested' : target;
      return { spans: state.spans.map((s) => (inGroup(s) ? { ...s, status: next } : s)) };
    }

    case 'reverseAuto': {
      // Un-redact an auto-handled item (a human act). Toggle, so it can be re-applied.
      const inGroup = (s: Span) => s.groupKey === action.groupKey && s.routedTo === 'auto';
      const members = state.spans.filter(inGroup);
      const allReversed = members.length > 0 && members.every((s) => s.status === 'kept_visible');
      const next: Span['status'] = allReversed ? 'auto_redacted' : 'kept_visible';
      return { spans: state.spans.map((s) => (inGroup(s) ? { ...s, status: next } : s)) };
    }

    default:
      return state;
  }
}
