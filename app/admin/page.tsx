"use client";

import { LISTINGS } from "@/data/listings";
import { useEffect, useState, useCallback } from "react";

type Sentiment = "positive" | "neutral" | "concerned" | "negative";
type Stage =
  | "greeting"
  | "qualification"
  | "info_exchange"
  | "objection_handling"
  | "soft_nudge"
  | "appointment"
  | "closed";

interface Metrics {
  total_conversations: number;
  total_messages: number;
  avg_response_time_ms: number;
  appointments_booked: number;
  sentiment_distribution: Record<Sentiment, number>;
  funnel: Array<{ stage: Stage; count: number }>;
  sentimentByListing: Record<string, { positive: number; neutral: number; negative: number }>;
}

interface ConversationRow {
  id: string;
  session_id: string;
  listing_slug?: string;
  stage: Stage;
  sentiment: Sentiment;
  appointment_booked: boolean;
  started_at: string;
  last_message_at: string;
  message_count: number;
  last_user_message: string;
  activity_at?: string;
  suspicious_reason?: "prompt_injection" | "toxic" | null;
  is_legacy?: boolean;
}

interface ConversationsResponse {
  conversations: ConversationRow[];
  hidden: {
    suspicious: number;
    legacy: number;
  };
}

interface SummaryData {
  lead_quality: number;
  outcome: "Запись на просмотр" | "Интерес без записи" | "Отказ" | "В процессе";
  appointment: string | null;
  key_concern: string | null;
  summary: string;
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface GroupedConversationMessage {
  role: "user" | "assistant";
  items: ConversationMessage[];
}

type AgentTone = "friendly" | "formal" | "warm" | "business";

const toneDescriptions: Record<string, string> = {
  friendly:
    "Общается тепло и по-человечески, использует простые слова, иногда неформальные обороты. Создаёт ощущение живого разговора.",
  formal:
    "Придерживается делового стиля, обращается на «Вы», избегает сокращений. Точные формулировки, профессиональный тон.",
  business:
    "Конкретный и по делу. Минимум лирики, максимум фактов. Быстро подводит к следующему шагу.",
  warm:
    "Общается мягко и участливо, с домашним тоном. Помогает снять напряжение и сделать диалог более доверительным.",
};

const STAGE_LABELS: Record<Stage, string> = {
  greeting: "Знакомство",
  qualification: "Вопросы",
  info_exchange: "Интерес",
  objection_handling: "Сомнения",
  soft_nudge: "К просмотру",
  appointment: "Запись",
  closed: "Завершено",
};

const STAGE_COLORS: Record<Stage, string> = {
  greeting: "bg-[#F5F5F5] text-[#8F8F8F]",
  qualification: "bg-[#EEF4FF] text-[#2563EB]",
  info_exchange: "bg-[#E8F7F0] text-[#0F9F6E]",
  objection_handling: "bg-[#FFF4D6] text-[#C47A00]",
  soft_nudge: "bg-[#F3EEFF] text-[#7C3AED]",
  appointment: "bg-[#EAFBF1] text-[#159947]",
  closed: "bg-[#F5F5F5] text-[#8F8F8F]",
};

const SENTIMENT_COLORS: Record<Sentiment, string> = {
  positive: "bg-green-400",
  neutral: "bg-gray-400",
  concerned: "bg-orange-400",
  negative: "bg-red-400",
};

const SENTIMENT_LABELS: Record<Sentiment, string> = {
  positive: "Позитивный",
  neutral: "Нейтральный",
  concerned: "Обеспокоен",
  negative: "Негативный",
};

const LISTING_LABELS: Record<string, string> = {
  "usacheva-11": "2-комн · Хамовники",
  "mitino-studio": "Студия · Митино",
  "vykhino-1room": "1-комн · Выхино",
  "presnya-3room": "3-комн · Пресня",
  "lyublino-1room": "1-комн · Люблино",
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff} сек назад`;
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  return `${Math.floor(diff / 86400)} д назад`;
}

function formatMs(ms: number): string {
  return ms < 1000 ? `${ms}мс` : `${(ms / 1000).toFixed(1)}с`;
}

function outcomeBadge(outcome: SummaryData["outcome"]) {
  if (outcome === "Запись на просмотр") return "bg-green-100 text-green-700";
  if (outcome === "Интерес без записи") return "bg-blue-100 text-blue-700";
  if (outcome === "В процессе") return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

function funnelFillClass(stage: Stage) {
  if (stage === "closed") return "bg-green-500";
  if (stage === "appointment") return "bg-[#0066FF] opacity-80";
  if (stage === "soft_nudge") return "bg-[#0066FF] opacity-60";
  if (stage === "info_exchange") return "bg-[#0066FF] opacity-75";
  if (stage === "qualification") return "bg-[#0066FF] opacity-90";
  return "bg-[#0066FF]";
}

function groupConversationMessages(messages: ConversationMessage[]) {
  return messages.reduce<GroupedConversationMessage[]>((groups, message) => {
    const lastGroup = groups[groups.length - 1];

    if (lastGroup && lastGroup.role === message.role) {
      lastGroup.items.push(message);
      return groups;
    }

    groups.push({
      role: message.role,
      items: [message],
    });

    return groups;
  }, []);
}

export default function AdminPage() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [hiddenConversations, setHiddenConversations] = useState({ suspicious: 0, legacy: 0 });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [summaries, setSummaries] = useState<Record<string, SummaryData>>({});
  const [summaryLoading, setSummaryLoading] = useState<Record<string, boolean>>({});
  const [expandedConvId, setExpandedConvId] = useState<string | null>(null);
  const [convMessages, setConvMessages] = useState<Record<string, ConversationMessage[]>>({});
  const [expandedAllMessages, setExpandedAllMessages] = useState<Record<string, boolean>>({});
  const [agentTones, setAgentTones] = useState<Record<string, AgentTone>>(
    Object.fromEntries(LISTINGS.map((listing) => [listing.id, listing.tone])) as Record<
      string,
      AgentTone
    >,
  );
  const [toast, setToast] = useState<string | null>(null);
  const ADMIN_PIN = "1234";

  const handlePinSubmit = useCallback((event: React.FormEvent) => {
    event.preventDefault();

    if (pin === ADMIN_PIN) {
      setIsUnlocked(true);
      window.sessionStorage.setItem("admin-unlocked", "1");
      return;
    }

    setPinError(true);
    setPin("");
    window.setTimeout(() => setPinError(false), 2000);
  }, [pin]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const copyToClipboard = useCallback(
    async (text: string, successMessage: string) => {
      try {
        await navigator.clipboard.writeText(text);
        showToast(successMessage);
      } catch (error) {
        console.error("Clipboard write failed", error);
        showToast("Не удалось скопировать");
      }
    },
    [showToast],
  );

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const requestKey = Date.now();
      const [metricsRes, convsRes] = await Promise.all([
        fetch(`/api/admin/metrics?ts=${requestKey}`, { cache: "no-store" }),
        fetch(`/api/admin/conversations?ts=${requestKey}`, { cache: "no-store" }),
      ]);
      const [metricsData, convsData] = await Promise.all([
        metricsRes.json(),
        convsRes.json(),
      ]);
      setMetrics(metricsData);
      setConversations((convsData as ConversationsResponse).conversations ?? []);
      setHiddenConversations((convsData as ConversationsResponse).hidden ?? { suspicious: 0, legacy: 0 });
      setLastUpdated(new Date());
    } catch (e) {
      console.error("Failed to fetch admin data", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadSummary = useCallback(async (conversationId: string) => {
    if (summaryLoading[conversationId]) return;
    setSummaryLoading((prev) => ({ ...prev, [conversationId]: true }));

    try {
      const response = await fetch("/api/admin/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      const data = await response.json();
      if (response.ok) {
        setSummaries((prev) => ({ ...prev, [conversationId]: data }));
      }
    } catch (error) {
      console.error("Failed to load summary", error);
    } finally {
      setSummaryLoading((prev) => ({ ...prev, [conversationId]: false }));
    }
  }, [summaryLoading]);

  useEffect(() => {
    setIsUnlocked(window.sessionStorage.getItem("admin-unlocked") === "1");
  }, []);

  useEffect(() => {
    if (!isUnlocked) return;
    fetchData();
  }, [fetchData, isUnlocked]);

  useEffect(() => {
    if (!isUnlocked) return;
    fetch(`/api/admin/settings?ts=${Date.now()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        try {
          const parsed = JSON.parse(data.tone_preset ?? "{}") as Record<string, AgentTone>;
          setAgentTones((prev) => ({ ...prev, ...parsed }));
        } catch {
          setAgentTones((prev) => prev);
        }
      })
      .catch(() => setAgentTones((prev) => prev));
  }, [isUnlocked]);

  const maxFunnelCount = Math.max(...(metrics?.funnel.map((item) => item.count) ?? [0]), 0);

  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-[#f6f5f3] px-6 py-12">
        <div className="mx-auto mt-12 w-full max-w-sm rounded-[28px] border border-[#e6e6e6] bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF6100] text-white">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
              </svg>
            </div>
            <div>
              <div className="text-base font-semibold text-[#1A1A1A]">Панель управления</div>
              <div className="text-sm text-[#8F8F8F]">Введите PIN-код для входа</div>
            </div>
          </div>
          <form onSubmit={handlePinSubmit} className="space-y-3">
            <input
              type="password"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              placeholder="PIN-код"
              maxLength={8}
              autoFocus
              className={`w-full rounded-2xl border px-4 py-3 text-center text-sm tracking-[0.2em] text-[#1C1C1E] outline-none transition-colors ${
                pinError ? "border-red-400 bg-red-50" : "border-[#E5E5E5] focus:border-[#FF6100]"
              }`}
            />
            {pinError && <p className="text-center text-xs text-red-500">Неверный PIN-код</p>}
            <button
              type="submit"
              className="w-full rounded-2xl bg-[#FF6100] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#E55500]"
            >
              Войти
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f5f3] text-[#1a1a1a]">
      <header className="border-b border-[#ececec] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
          <div className="min-w-0 flex items-center gap-3">
            <a href="/" className="p-1 text-[#1A1A1A]">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </a>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF6100] text-white">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-[#1A1A1A]">Сообщения</h1>
              <p className="text-xs text-[#8F8F8F]">Мониторинг диалогов, лидов и качества ответов</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void fetchData()}
              className="rounded-full border border-[#E5E5E5] bg-white px-4 py-2 text-sm font-medium text-[#262626] transition-colors hover:bg-[#F7F7F7]"
            >
              Обновить
            </button>
            <a
              href="/chat?demo=true"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-[#FF6100] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#E55500]"
            >
              Тест как арендатор
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <section className="space-y-5">
          <div className="rounded-[28px] border border-[#e6e6e6] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="mb-5">
              <div>
                <h2 className="text-[34px] font-semibold leading-none">Сообщения</h2>
                <div className="mt-2 text-sm text-[#8f8f8f]">
                  Актуальные обращения по объявлению и сигналы арендаторов
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                {
                  label: "Обращений",
                  value: isLoading ? "—" : String(metrics?.total_conversations ?? 0),
                },
                {
                  label: "Ответов арендаторов",
                  value: isLoading ? "—" : String(metrics?.total_messages ?? 0),
                },
                {
                  label: "Ср. ответ",
                  value: isLoading ? "—" : formatMs(metrics?.avg_response_time_ms ?? 0),
                },
                {
                  label: "Записей",
                  value: isLoading ? "—" : String(metrics?.appointments_booked ?? 0),
                },
              ].map((card) => (
                <div key={card.label} className="rounded-2xl bg-[#f7f7f7] p-4">
                  <div className="text-2xl font-bold">{card.value}</div>
                  <div className="mt-1 text-xs text-[#8f8f8f]">{card.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-[#e6e6e6] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <h3 className="mb-3 text-sm font-semibold text-[#262626]">Воронка диалогов</h3>
            <div className="space-y-3">
              {(metrics?.funnel ?? []).map((item) => {
                const width =
                  item.count > 0 && maxFunnelCount > 0
                    ? Math.max(4, Math.round((item.count / maxFunnelCount) * 100))
                    : 0;

                return (
                  <div key={item.stage} className="flex items-center gap-3">
                    <div className="w-[90px] text-right text-sm text-[#6B7280]">
                      {STAGE_LABELS[item.stage]}
                    </div>
                    <div className="h-7 flex-1 rounded-md bg-[#F3F4F6]">
                      <div
                        className={`h-7 rounded-md transition-all duration-500 ${funnelFillClass(item.stage)}`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <div className="w-10 text-sm font-semibold text-[#262626]">{item.count}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="overflow-hidden rounded-[28px] border border-[#e6e6e6] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="border-b border-[#ececec] px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Разговоры</h3>
                    {(hiddenConversations.suspicious > 0 || hiddenConversations.legacy > 0) && (
                      <p className="mt-1 text-xs text-[#8F8F8F]">
                        Скрыто: {hiddenConversations.suspicious} подозрительных и {hiddenConversations.legacy} архивных диалогов
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {isLoading ? (
                <div className="p-8 text-center text-sm text-[#8f8f8f]">Загрузка...</div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-[#9CA3AF]">
                  <div className="text-sm">Пока нет разговоров</div>
                  <div className="mt-1 text-xs">Они появятся когда арендаторы начнут писать</div>
                </div>
              ) : (
                <div className="divide-y divide-[#f3f3f3]">
                  {conversations.map((conv) => {
                    const summary = summaries[conv.id];
                    const isSummaryLoading = summaryLoading[conv.id];
                    const groupedMessages = groupConversationMessages(convMessages[conv.id] ?? []);
                    const visibleGroups =
                      expandedAllMessages[conv.id] || groupedMessages.length <= 4
                        ? groupedMessages
                        : groupedMessages.slice(-4);

                    return (
                    <div
                      key={conv.id}
                      className="cursor-pointer px-5 py-4 transition-colors hover:bg-[#fcfcfc]"
                      onClick={async () => {
                        if (expandedConvId === conv.id) {
                          setExpandedConvId(null);
                          return;
                        }

                        setExpandedConvId(conv.id);
                        if (!convMessages[conv.id]) {
                          const res = await fetch(`/api/admin/messages?conversationId=${conv.id}`);
                          const msgs = await res.json();
                          setConvMessages((prev) => ({ ...prev, [conv.id]: msgs }));
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="mt-1 h-11 w-11 shrink-0 rounded-full bg-[#e7eefc]" />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-base font-semibold text-[#262626]">
                                Арендатор · {LISTING_LABELS[conv.listing_slug ?? ""] ?? "Квартира"}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[conv.stage]}`}
                              >
                                {STAGE_LABELS[conv.stage]}
                              </span>
                              {conv.appointment_booked && conv.stage !== "appointment" && (
                                <span className="rounded-full bg-[#ffe9d9] px-2 py-0.5 text-xs font-medium text-[#ff6100]">
                                  Запись
                                </span>
                              )}
                              <span className="text-xs text-[#9CA3AF]">
                                {expandedConvId === conv.id ? "▲" : "▼"}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-xs text-[#8f8f8f]">
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${SENTIMENT_COLORS[conv.sentiment]}`}
                              />
                              <span>{SENTIMENT_LABELS[conv.sentiment]}</span>
                              <span>•</span>
                              <span>{conv.message_count} сообщений</span>
                            </div>
                            {conv.last_user_message && (
                              <p className="mt-2 truncate text-sm text-[#444]">
                                {conv.last_user_message}
                              </p>
                            )}
                            <div className="mt-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  loadSummary(conv.id);
                                }}
                                disabled={isSummaryLoading}
                                className="rounded-lg border border-[#C7D7FF] bg-[#F0F4FF] px-[10px] py-1 text-xs text-[#0066FF] transition-colors hover:bg-[#E8F0FF] disabled:opacity-60"
                              >
                                {isSummaryLoading ? "Загрузка..." : "✦ Саммари"}
                              </button>
                            </div>
                          </div>
                        </div>
                        <span className="shrink-0 text-xs text-[#8f8f8f]">
                          {timeAgo(conv.last_message_at)}
                        </span>
                      </div>

                      {summary && (
                        <div className="mt-3 rounded-xl border border-[#E0EAFF] bg-[#F8FAFF] p-3">
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-[#262626]">Качество лида:</span>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#E0EAFF]">
                              <div
                                className="h-full rounded-full bg-[#0066FF]"
                                style={{ width: `${Math.max(0, Math.min(10, summary.lead_quality)) * 10}%` }}
                              />
                            </div>
                            <span className="text-sm font-semibold text-[#262626]">
                              {summary.lead_quality}/10
                            </span>
                          </div>

                          <div className="mt-3 flex items-center gap-2 text-sm text-[#262626]">
                            <span>Итог:</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${outcomeBadge(summary.outcome)}`}>
                              {summary.outcome}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void copyToClipboard(
                                  [
                                    `Качество лида: ${summary.lead_quality}/10`,
                                    `Итог: ${summary.outcome}`,
                                    summary.appointment ? `Просмотр: ${summary.appointment}` : null,
                                    summary.key_concern ? `Возражение: ${summary.key_concern}` : null,
                                    `Саммари: ${summary.summary}`,
                                  ]
                                    .filter(Boolean)
                                    .join("\n"),
                                  "Саммари скопировано",
                                );
                              }}
                              className="rounded-lg border border-[#D6E3FF] bg-white px-2 py-1 text-xs text-[#0066FF] transition-colors hover:bg-[#F3F7FF]"
                            >
                              Скопировать
                            </button>
                          </div>

                          {summary.appointment && (
                            <div className="mt-2 text-sm text-[#262626]">
                              Просмотр: {summary.appointment}
                            </div>
                          )}

                          {summary.key_concern && (
                            <div className="mt-1 text-sm text-[#6B7280]">
                              Возражение: {summary.key_concern}
                            </div>
                          )}

                          <p className="mt-2 text-[13px] italic text-[#374151]">{summary.summary}</p>
                        </div>
                      )}

                      {expandedConvId === conv.id && (
                        <div className="mt-3 max-h-[400px] space-y-2 overflow-y-auto border-t border-[#F0F0F0] bg-[#FAFAFA] px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2 pb-1">
                            <a
                              href={`/chat?listing=${conv.listing_slug ?? "usacheva-11"}&session=${conv.session_id}&demo=true`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="rounded-lg bg-[#0066FF] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0052CC]"
                            >
                              Открыть диалог
                            </a>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void copyToClipboard(
                                  `${window.location.origin}/chat?listing=${conv.listing_slug ?? "usacheva-11"}&session=${conv.session_id}&demo=true`,
                                  "Ссылка на диалог скопирована",
                                );
                              }}
                              className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#4B5563] transition-colors hover:bg-[#F9FAFB]"
                            >
                              Скопировать ссылку
                            </button>
                            {groupedMessages.length > 4 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedAllMessages((prev) => ({
                                    ...prev,
                                    [conv.id]: !prev[conv.id],
                                  }));
                                }}
                                className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#4B5563] transition-colors hover:bg-[#F9FAFB]"
                              >
                                {expandedAllMessages[conv.id] ? "Свернуть" : "Развернуть всё"}
                              </button>
                            )}
                          </div>
                          {visibleGroups.map((group, groupIndex) => (
                            <div
                              key={`${group.role}-${groupIndex}`}
                              className={`flex ${group.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                                  group.role === "user"
                                    ? "rounded-br-sm bg-[#0066FF] text-white"
                                    : "rounded-bl-sm border border-[#E5E5E5] bg-white text-[#262626]"
                                }`}
                              >
                                <div className="space-y-2">
                                  {group.items.map((item, itemIndex) => (
                                    <div
                                      key={`${item.created_at}-${itemIndex}`}
                                      className={itemIndex > 0 ? "border-t border-black/10 pt-2" : ""}
                                    >
                                      {item.content}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                          {!convMessages[conv.id] && (
                            <div className="py-4 text-center text-sm text-[#9CA3AF]">Загрузка...</div>
                          )}
                        </div>
                      )}
                    </div>
                  )})}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-[28px] border border-[#e6e6e6] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <h3 className="text-sm font-semibold">Активные агенты</h3>
                <div className="mt-4 space-y-4">
                  {LISTINGS.map((listing) => (
                    <div
                      key={listing.id}
                      className="rounded-2xl border border-[#e8e8e8] bg-white px-4 py-3 text-sm"
                    >
                      {(() => {
                        const stats = metrics?.sentimentByListing?.[listing.id] ?? {
                          positive: 0,
                          neutral: 0,
                          negative: 0,
                        };
                        const total = stats.positive + stats.neutral + stats.negative;
                        const score =
                          total === 0 ? 0.5 : (stats.positive * 1 + stats.neutral * 0.5) / total;
                        const pct = Math.round(score * 100);
                        const hue = Math.round(score * 120);

                        return (
                          <>
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-[#262626]">
                          {listing.agentName} · {listing.district}
                        </div>
                        <select
                          value={agentTones[listing.id] ?? listing.tone}
                          onChange={async (e) => {
                            const nextTone = e.target.value as AgentTone;
                            setAgentTones((prev) => ({ ...prev, [listing.id]: nextTone }));
                            await fetch("/api/admin/tone", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ slug: listing.id, tone: nextTone }),
                            });
                          }}
                          className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm text-gray-600"
                        >
                          <option value="friendly">Дружелюбный</option>
                          <option value="formal">Формальный</option>
                          <option value="business">Деловой</option>
                          <option value="warm">Тёплый</option>
                        </select>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">
                        {toneDescriptions[agentTones[listing.id]] ?? toneDescriptions.friendly}
                      </p>
                      <div className="mt-3">
                        <span className="text-xs text-gray-400">Настрой клиентов</span>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: `hsl(${hue}, 70%, 55%)`,
                            }}
                          />
                        </div>
                      </div>
                          </>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
      {toast && (
        <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#1f2937] px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
