import { useState } from 'react';
import { kinsApi } from '../api';

export default function KinGateModal({
  onResolved,
  onCancel,
}: {
  onResolved: (code: string) => void;
  onCancel?: () => void;
}) {
  const [mode, setMode] = useState<'choose' | 'enter' | 'created'>('choose');
  const [codeInput, setCodeInput] = useState('');
  const [newCode, setNewCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const submitCode = async () => {
    const code = codeInput.trim();
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit kin code');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const ok = await kinsApi.exists(code);
      if (!ok) {
        setError("That code doesn't match any kin");
        return;
      }
      onResolved(code);
    } catch {
      setError('Failed to reach the server');
    } finally {
      setBusy(false);
    }
  };

  const createKin = async () => {
    setBusy(true);
    setError(null);
    try {
      const { code } = await kinsApi.create();
      setNewCode(code);
      setMode('created');
    } catch {
      setError('Failed to reach the server');
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(newCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard access denied — the code is still visible on screen to copy manually
    }
  };

  const card = (
    <div
      className="w-full max-w-sm rounded-2xl bg-paper p-6 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🌳</span>
          <h1 className="font-display text-xl font-semibold text-ink">KinTree</h1>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft hover:bg-paper-dim"
          >
            ✕
          </button>
        )}
      </div>

      {mode === 'choose' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-soft">
            {onCancel ? 'Switch to a different kin, or create a new one.' : 'Enter your kin code to open your chart, or create a new one.'}
          </p>
          <button
            onClick={() => setMode('enter')}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Enter a kin code
          </button>
          <button
            onClick={createKin}
            disabled={busy}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-paper-dim disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create a new kin'}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      {mode === 'enter' && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink-soft">Kin code</span>
            <input
              autoFocus
              inputMode="numeric"
              maxLength={6}
              className="rounded-lg border border-line bg-white px-3 py-2 tracking-widest outline-none focus:border-accent"
              placeholder="123456"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => e.key === 'Enter' && submitCode()}
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setMode('choose');
                setError(null);
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium text-ink-soft hover:bg-paper-dim"
            >
              Back
            </button>
            <button
              onClick={submitCode}
              disabled={busy}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Checking…' : 'Open'}
            </button>
          </div>
        </div>
      )}

      {mode === 'created' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-soft">
            Your kin code is ready. Save it — you'll need it to come back, and to share this chart with anyone else.
          </p>
          <button
            onClick={copyCode}
            className="rounded-lg border-2 border-dashed border-accent bg-paper-dim px-4 py-3 text-center font-display text-2xl font-semibold tracking-[0.3em] text-ink"
            title="Click to copy"
          >
            {newCode}
          </button>
          {copied && <p className="text-center text-xs text-ink-soft">Copied</p>}
          <button
            onClick={() => onResolved(newCode)}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );

  if (onCancel) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
        onClick={onCancel}
      >
        {card}
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-[radial-gradient(circle_at_center,_var(--color-paper-dim),_var(--color-paper))] p-4">
      {card}
    </div>
  );
}
