import { useEffect, useState, useRef, useCallback } from 'react';
import { Bot, Send, User, Loader2, TrendingUp, AlertTriangle, Package } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { LoadingSpinner, PageHeader } from '@/components/ui/States';
import type { AiConversation } from '@/types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function AiCopilotPage() {
  const { t, lang } = useApp();
  const { session } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sessionId = session?.user?.id || 'default';

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('erp_ai_conversations')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(50);

      if (data && data.length > 0) {
        setMessages(data.map((c: AiConversation) => ({ role: c.role, content: c.content })));
      } else {
        setMessages([{ role: 'assistant', content: t('aiGreeting') }]);
      }
    } catch {
      setMessages([{ role: 'assistant', content: t('aiGreeting') }]);
    } finally {
      setLoading(false);
    }
  }, [sessionId, t]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const messageText = (text || input).trim();
    if (!messageText || sending) return;

    setInput('');
    setSending(true);
    setError('');

    const userMsg: ChatMessage = { role: 'user', content: messageText };
    setMessages(prev => [...prev, userMsg]);

    try {
      await supabase.from('erp_ai_conversations').insert({
        session_id: sessionId,
        role: 'user',
        content: messageText,
      });

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-copilot`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageText,
          sessionId,
          lang,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || `Request failed (${response.status})`);
      }
      if (!data || typeof data.response !== 'string') {
        throw new Error('Invalid response from AI');
      }

      const assistantMsg: ChatMessage = { role: 'assistant', content: data.response };
      setMessages(prev => [...prev, assistantMsg]);

      await supabase.from('erp_ai_conversations').insert({
        session_id: sessionId,
        role: 'assistant',
        content: data.response,
        metadata: data.metadata || {},
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'AI error';
      setError(errorMsg);
      setMessages(prev => [...prev, { role: 'assistant', content: `Xato: ${errorMsg}` }]);
    } finally {
      setSending(false);
    }
  };

  const quickQuestions = [
    { icon: TrendingUp, label: t('howMuchCash'), text: lang === 'uz' ? 'Hozir kassada jami qancha pul bor?' : 'Сколько сейчас всего денег в кассе?' },
    { icon: AlertTriangle, label: t('anyOverdue'), text: lang === 'uz' ? 'Kechikkan buyurtmalar bormi? Hammasini ro\'yxatlab ber.' : 'Есть просроченные заказы? Перечисли все.' },
    { icon: Package, label: t('whatsInStock'), text: lang === 'uz' ? 'Omborda hozir qaysi uskunalar bo\'sh holatda turibdi?' : 'Какая техника сейчас свободна на складе?' },
  ];

  if (loading) return <LoadingSpinner text={t('loading')} />;

  return (
    <div className="flex flex-col space-y-4" style={{ height: 'calc(100vh - 8rem)' }}>
      <PageHeader title={t('aiAssistant')} subtitle={t('aiGreeting')} />

      <div className="card flex flex-1 flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {messages.map((msg, i) => (
            <div key={i} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                msg.role === 'user'
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
              }`}>
                {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-2xl bg-slate-100 px-4 py-3 dark:bg-slate-800">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick questions */}
        {messages.length <= 1 && (
          <div className="border-t border-slate-100 p-4 dark:border-slate-800">
            <p className="mb-2 text-xs font-medium text-slate-400">{t('quickQuestions')}</p>
            <div className="flex flex-wrap gap-2">
              {quickQuestions.map((q, i) => {
                const Icon = q.icon;
                return (
                  <button
                    key={i}
                    onClick={() => sendMessage(q.text)}
                    disabled={sending}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition-all hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-700 dark:hover:bg-blue-900/10"
                  >
                    <Icon className="h-4 w-4 text-blue-500" />
                    {q.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-slate-100 p-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={t('askAnything')}
              disabled={sending}
              className="input-field flex-1"
            />
            <button
              onClick={() => sendMessage()}
              disabled={sending || !input.trim()}
              className="btn-primary"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="hidden sm:inline">{t('send')}</span>
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        </div>
      </div>
    </div>
  );
}
