import { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, MessageSquare, Loader2, Minimize2, Sparkles, User } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

export function FloatingAiChat() {
  const { lang } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: lang === 'uz'
        ? 'Assalomu alaykum! Men Arboss AI yordamchisiman. Asboblar, ijaralar yoki kassa bo\'yicha savolingiz bormi?'
        : 'Здравствуйте! Я AI-ассистент Arboss. Чем могу помочь по складу или заказам?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput('');

    const newMsgs = [...messages, { role: 'user' as const, content: text }];
    setMessages(newMsgs);
    setLoading(true);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: newMsgs }),
      });
      const data = await res.json();
      setMessages([...newMsgs, { role: 'assistant', content: data.reply || 'Javob olindi.' }]);
    } catch {
      setMessages([...newMsgs, { role: 'assistant', content: 'Kechirasiz, aloqada xatolik yuz berdi.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex h-13 w-13 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl shadow-blue-600/30 transition hover:scale-105 hover:bg-blue-700"
          title="AI bilan suhbat"
        >
          <Bot className="h-6 w-6" />
        </button>
      )}

      {/* Small Chat Window */}
      {isOpen && (
        <div className="flex h-[420px] w-80 sm:w-96 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Arboss AI Yordamchi</h4>
                <p className="text-[10px] text-emerald-600">● Onlayn</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto p-3 text-xs">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'assistant' && (
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <Bot className="h-3 w-3" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 leading-relaxed shadow-sm ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-800'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                <span>AI yozmoqda...</span>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input Box */}
          <div className="border-t border-slate-100 p-2.5">
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 focus-within:border-blue-500 focus-within:bg-white">
              <input
                type="text"
                placeholder={lang === 'uz' ? 'Savolingizni yozing...' : 'Задайте вопрос...'}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                className="flex-1 bg-transparent text-xs text-slate-900 focus:outline-none"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
