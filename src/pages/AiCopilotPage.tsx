import { useEffect, useState, useRef, useCallback } from 'react';
import { Bot, Send, User, Loader2, Sparkles, AlertCircle, RefreshCw, Copy, Check, BarChart3, Wrench, ShieldAlert } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/States';

interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  time?: string;
}

export function AiCopilotPage() {
  const { lang } = useApp();
  const { staff } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [warehouseContext, setWarehouseContext] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load warehouse context to give Gemini deep awareness
  const loadContext = useCallback(async () => {
    try {
      const [itemsRes, ordersRes, registersRes] = await Promise.all([
        supabase.from('erp_product_items').select('status, serial_number, model_id'),
        supabase.from('erp_orders').select('order_number, customer_name, status, debt_amount, total_rent_amount'),
        supabase.from('erp_cash_registers').select('name, current_balance'),
      ]);

      const items = itemsRes.data || [];
      const orders = ordersRes.data || [];
      const registers = registersRes.data || [];

      const active = orders.filter((o: any) => o.status === 'faol_ijarada');
      const overdue = orders.filter((o: any) => o.status === 'kechikkan');
      const totalCash = registers.reduce((s: number, r: any) => s + Number(r.current_balance || 0), 0);

      const ctxSummary = `
Ombordagi jami uskunalar: ${items.length} dona.
- Bo'sh turgan: ${items.filter((i: any) => i.status === 'omborda_bosh').length} dona
- Ijarada: ${items.filter((i: any) => i.status === 'ijarada').length} dona
- Ta'mirda: ${items.filter((i: any) => i.status === 'tamirda').length} dona
- Joylashtirish kutilmoqda: ${items.filter((i: any) => i.status === 'joylashtirish_kutilmoqda').length} dona

Buyurtmalar:
- Faol ijarada: ${active.length} ta
- Kechikkanlar: ${overdue.length} ta (Kechikkan mijozlar: ${overdue.map((o: any) => `${o.customer_name} (${o.debt_amount} so'm)`).join(', ') || 'yo\'q'})

Kassa qoldig'i: ${new Intl.NumberFormat('ru-RU').format(totalCash)} so'm.
Hozirgi foydalanuvchi: ${staff?.full_name || 'Xodim'} (Rol: ${staff?.role || 'admin'}).
`;
      setWarehouseContext(ctxSummary);
    } catch {
      // ignore
    }
  }, [staff]);

  useEffect(() => {
    loadContext();

    // Load initial greeting
    const greetingUz = `Assalomu alaykum, ${staff?.full_name || 'Hurmatli xodim'}! 
Men Arboss WMS ning sun'iy intellekt yordamchisiman. 
Men sizga quyidagi masalalarda ko'maklasha olaman:
• Ombordagi uskunalar zaxirasi va ijaradagi texnikalar tahlili
• Kechikkan buyurtmalar va qarzdorliklarni undirish bo'yicha takliflar
• Mijozlar uchun ijara va logistika smetasini hisoblash
• Telegram bildirishnomalari matnini tuzish`;

    const greetingRu = `Здравствуйте, ${staff?.full_name || 'Уважаемый сотрудник'}! 
Я AI-ассистент системы Arboss WMS. 
Чем могу помочь вам сегодня по складу, аренде оборудования или расчетам логистики?`;

    setMessages([
      {
        role: 'assistant',
        content: lang === 'ru' ? greetingRu : greetingUz,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setLoading(false);
  }, [lang, staff, loadContext]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const sendMessage = async (textToSend?: string) => {
    const messageText = (textToSend || input).trim();
    if (!messageText || sending) return;

    setInput('');
    setSending(true);
    setError('');

    const userMsg: ChatMessage = {
      role: 'user',
      content: messageText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          context: warehouseContext,
          history: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        throw new Error(`Server xatosi: ${res.status}`);
      }

      const data = await res.json();
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.reply || data.error || 'Javob olinmadi.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setError(err?.message || 'Xatolik yuz berdi');
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Kechirasiz, sun\'iy intellekt javob berishda texnik uzilish yuz berdi. Iltimos qaytadan urinib ko\'ring.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const copyToClipboard = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const quickPrompts = lang === 'uz' ? [
    { label: '📊 Kechikkan buyurtmalar tahlili', text: 'Kechikkan buyurtmalar va mijozlar qarzdorligi bo\'yicha batafsil hisobot ber va ularga qanday chora ko\'rish kerakligini ayt.' },
    { label: '⚡ Bo\'sh turgan uskunalar', text: 'Hozir omborda qaysi uskunalar bo\'sh turibdi va ularning ijarasini oshirish uchun qanday tavsiyalar berasan?' },
    { label: '💰 Kassa va tushumlar', text: 'Kassa qoldig\'i va oxirgi tushumlar tahlilini chiqarib ber.' },
    { label: '🚚 Sement va yuk ko\'tarish hisobi', text: 'Mijoz 4-qavatga lift yo\'q bo\'lsa 50 qop sement chiqarmoqchi. Narx va ishchilar sonini hisoblab ber.' },
  ] : [
    { label: '📊 Анализ просрочек', text: 'Сделай подробный отчет по просроченным заказам и долгам клиентов.' },
    { label: '⚡ Свободное оборудование', text: 'Какое оборудование сейчас простаивает на складе и как повысить загрузку?' },
    { label: '💰 Остатки по кассам', text: 'Сделай финансовый обзор текущих остатков в кассах.' },
    { label: '🚚 Расчет грузчиков', text: 'Клиент хочет поднять 50 мешков цемента на 4-й этаж без лифта. Рассчитай цену.' },
  ];

  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col space-y-3">
      <div className="flex items-center justify-between">
        <PageHeader
          title={lang === 'uz' ? 'AI Yordamchi (Gemini)' : 'AI Ассистент (Gemini)'}
          subtitle={lang === 'uz' ? 'Ombor tahlili, uskunalar hisob-kitobi va aqlli biznes maslahatchi' : 'Складская аналитика, арендные расчеты и умный советник'}
        />
        <button
          onClick={() => {
            loadContext();
            setMessages(prev => prev.slice(0, 1));
          }}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>{lang === 'uz' ? 'Chatni yangilash' : 'Очистить чат'}</span>
        </button>
      </div>

      {/* Quick Prompts Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-xs font-medium text-slate-400">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          {lang === 'uz' ? 'Tezkor savollar:' : 'Быстрые вопросы:'}
        </span>
        {quickPrompts.map((qp, idx) => (
          <button
            key={idx}
            onClick={() => sendMessage(qp.text)}
            disabled={sending}
            className="rounded-full border border-blue-200 bg-blue-50/70 px-3 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100 hover:border-blue-300 disabled:opacity-50 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/40"
          >
            {qp.label}
          </button>
        ))}
      </div>

      {/* Chat Messages Container */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-4">
          {messages.map((msg, i) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={i}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-sm">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`group relative max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    isUser
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-50 text-slate-800 border border-slate-100 dark:bg-slate-800/80 dark:border-slate-700/60 dark:text-slate-100'
                  }`}
                >
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>

                  <div className="mt-1 flex items-center justify-between gap-4 text-[10px] opacity-60">
                    <span>{msg.time}</span>
                    {!isUser && (
                      <button
                        onClick={() => copyToClipboard(msg.content, i)}
                        className="opacity-0 transition group-hover:opacity-100 hover:text-blue-500"
                        title="Nusxalash"
                      >
                        {copiedIndex === i ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {isUser && (
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })}

          {sending && (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span>{lang === 'uz' ? 'AI ombor ma\'lumotlarini tahlil qilmoqda...' : 'AI анализирует данные склада...'}</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={lang === 'uz' ? 'AI ga savol yozing (masalan: qaysi uskunalar ta\'mirda?)...' : 'Задайте вопрос AI (например: какое оборудование в ремонте?)...'}
          disabled={sending}
          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/30 transition hover:bg-blue-700 disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          <span className="hidden sm:inline">{lang === 'uz' ? 'Yuborish' : 'Отправить'}</span>
        </button>
      </form>
    </div>
  );
}
