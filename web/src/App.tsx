import { useEffect, useState } from 'react';

/**
 * App shell (Presentation layer — CLAUDE.md §5). Renders state; contains NO product logic.
 * For now it just proves the frontend ↔ backend wiring by calling /api/health. The real
 * surfaces — review lane, auto-handled tray, export gate — render here later, all derived
 * from a single span store.
 */
export default function App() {
  const [status, setStatus] = useState<string>('checking backend…');

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((data: { message?: string }) => setStatus(data.message ?? 'backend OK'))
      .catch(() => setStatus('backend unreachable — is `npm run dev` running?'));
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-8">
      <div className="max-w-xl w-full rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Conseal Review</h1>
        <p className="mt-2 text-slate-600">
          Local-first correction experience for redaction review. Scaffold is live — domain logic
          and UI surfaces come next.
        </p>
        <div className="mt-6 rounded-lg bg-slate-100 px-4 py-3 text-sm font-mono text-slate-700">
          {status}
        </div>
        <ul className="mt-6 space-y-1 text-sm text-slate-500">
          <li>• Review lane (ambiguous only) — TODO</li>
          <li>• Auto-handled tray (disclosed, collapsed) — TODO</li>
          <li>• Export gate (consequence preview) — TODO</li>
        </ul>
      </div>
    </main>
  );
}
