import { useState, useRef, useEffect, useCallback } from 'react';
import AIRPORTS from '../data/airports';

const BY_ICAO = new Map(AIRPORTS.map((a) => [a.icao, a]));
const SUGGESTIONS = [
  'Which airfields with customs have a restaurant?',
  'Best rated restaurant near LFAT?',
  'IFR airfields with runways over 1500 m',
];

// Render assistant text with known ICAO codes as clickable map links.
function AnswerText({ text, onSelect }) {
  const parts = text.split(/\b([A-Z]{4})\b/);
  return (
    <>
      {parts.map((part, i) => {
        const airport = BY_ICAO.get(part);
        if (airport) {
          return (
            <button
              key={i}
              onClick={() => onSelect(airport)}
              className="font-mono font-semibold text-brand hover:underline"
            >
              {part}
            </button>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M12 2l1.9 5.7a2 2 0 0 0 1.3 1.3L21 11l-5.8 2a2 2 0 0 0-1.3 1.3L12 20l-1.9-5.7a2 2 0 0 0-1.3-1.3L3 11l5.8-2a2 2 0 0 0 1.3-1.3L12 2z" />
    </svg>
  );
}

export function AskWidget({ onSelect }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // { role, content }
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = useCallback(
    async (text) => {
      const q = text.trim();
      if (!q || busy) return;
      const history = [...messages, { role: 'user', content: q }];
      setMessages(history);
      setInput('');
      setBusy(true);
      try {
        const r = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history }),
        });
        const d = await r.json().catch(() => ({}));
        let reply;
        if (r.ok && d.reply) {
          reply = d.reply;
        } else if (d.error === 'not_configured') {
          reply = 'The assistant is not configured yet (missing API key on the server).';
        } else if (r.status === 429) {
          reply = 'Too many questions — please wait a minute and try again.';
        } else {
          reply = 'Sorry, something went wrong. Please try again.';
        }
        setMessages((m) => [...m, { role: 'assistant', content: reply }]);
      } catch {
        setMessages((m) => [...m, { role: 'assistant', content: 'Network error — please try again.' }]);
      } finally {
        setBusy(false);
      }
    },
    [messages, busy]
  );

  return (
    <div className="absolute bottom-4 left-4 z-[1100]">
      {open && (
        <div className="mb-2 w-[330px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-2.5 bg-brand text-white flex items-center justify-between">
            <span className="text-sm font-semibold flex items-center gap-1.5">
              <SparkIcon /> Ask about airfields
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-white/80 hover:text-white text-xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div className="h-72 overflow-y-auto px-3 py-3 space-y-2 text-sm bg-gray-50">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-gray-500 text-xs">
                  Ask anything about the airfields on the map — fuel, customs, runways, restaurants,
                  NOTAMs.
                </p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="block w-full text-left px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs text-gray-600 hover:border-brand hover:text-brand transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={
                    m.role === 'user'
                      ? 'max-w-[85%] px-3 py-1.5 rounded-2xl rounded-br-sm bg-brand text-white whitespace-pre-wrap'
                      : 'max-w-[85%] px-3 py-1.5 rounded-2xl rounded-bl-sm bg-white border border-gray-200 text-gray-800 whitespace-pre-wrap'
                  }
                >
                  {m.role === 'assistant' ? <AnswerText text={m.content} onSelect={onSelect} /> : m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="px-3 py-1.5 rounded-2xl rounded-bl-sm bg-white border border-gray-200 text-gray-400">
                  Thinking…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-gray-200 px-3 py-2 bg-white"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              maxLength={500}
              className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-gray-400"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="shrink-0 px-3 py-1 rounded-full bg-brand text-white text-xs font-medium disabled:opacity-40 hover:bg-brand-dark transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* Floating toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-12 h-12 rounded-full bg-brand text-white shadow-lg hover:bg-brand-dark transition-colors flex items-center justify-center"
        aria-label="Ask about airfields"
        title="Ask about airfields"
      >
        <SparkIcon />
      </button>
    </div>
  );
}
