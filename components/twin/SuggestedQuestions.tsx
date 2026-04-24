'use client';

const SUGGESTED_QUESTIONS = [
  "What's my biggest health risk right now?",
  'What one change would help the most?',
  'Will I live past 80?',
  'What happens if I keep living like this?',
  'What if I quit smoking tomorrow?'
];

export function SuggestedQuestions({ onSelect }: { onSelect: (question: string) => void }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-2">
      <p className="mb-2 text-xs text-slate-600">Try asking</p>
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_QUESTIONS.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => onSelect(question)}
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-400 transition hover:border-twin/40 hover:text-twin"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}
