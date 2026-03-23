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
  qualification: "bg-[#FFE9D9] text-[#FF6100]",
  info_exchange: "bg-[#FFE9D9] text-[#FF6100]",
  objection_handling: "bg-[#FFF4D6] text-[#C47A00]",
  soft_nudge: "bg-[#E8F1FF] text-[#3175E0]",
  appointment: "bg-[#FFE9D9] text-[#FF6100]",
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

export default function AdminPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [summaries, setSummaries] = useState<Record<string, SummaryData>>({});
  const [summaryLoading, setSummaryLoading] = useState<Record<string, boolean>>({});
  const [expandedConvId, setExpandedConvId] = useState<string | null>(null);
  const [convMessages, setConvMessages] = useState<Record<string, ConversationMessage[]>>({});
  const ADMIN_PIN = "1234";

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === ADMIN_PIN) {
      setIsUnlocked(true);
    } else {
      setPinError(true);
      setPin("");
      setTimeout(() => setPinError(false), 2000);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      const [metricsRes, convsRes] = await Promise.all([
        fetch("/api/admin/metrics"),
        fetch("/api/admin/conversations"),
      ]);
      const [metricsData, convsData] = await Promise.all([
        metricsRes.json(),
        convsRes.json(),
      ]);
      setMetrics(metricsData);
      setConversations(convsData);
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
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const totalSentiments = metrics
    ? Object.values(metrics.sentiment_distribution).reduce((a, b) => a + b, 0)
    : 0;

  const positivePercent =
    totalSentiments > 0
      ? Math.round(((metrics?.sentiment_distribution.positive ?? 0) / totalSentiments) * 100)
      : 0;
  const maxFunnelCount = Math.max(...(metrics?.funnel.map((item) => item.count) ?? [0]), 0);

  if (!isUnlocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f5f3] px-6">
        <div className="w-full max-w-sm rounded-[28px] border border-[#e6e6e6] bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="mb-6 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF6100] text-white">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
              </svg>
            </div>
            <div>
              <div className="font-semibold text-[#1A1A1A]">Domclick Agent</div>
              <div className="text-xs text-[#8F8F8F]">Сообщения и аналитика</div>
            </div>
          </div>
          <h2 className="mb-1 text-lg font-semibold text-[#1A1A1A]">Панель управления</h2>
          <p className="mb-6 text-sm text-[#8F8F8F]">Введите PIN-код для входа</p>
          <form onSubmit={handlePinSubmit} className="space-y-3">
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="PIN-код"
              maxLength={8}
              autoFocus
              className={`w-full rounded-2xl border px-4 py-3 text-center text-sm tracking-[0.35em] text-[#1A1A1A] outline-none transition-colors ${
                pinError
                  ? "border-red-300 bg-red-50"
                  : "border-[#E8E8E8] bg-[#F7F7F7] focus:border-[#FF6100] focus:bg-white"
              }`}
            />
            {pinError && (
              <p className="text-center text-xs text-red-500">Неверный PIN-код</p>
            )}
            <button
              type="submit"
              className="w-full rounded-2xl bg-[#FF6100] py-3 text-sm font-medium text-white transition-colors hover:bg-[#E55500]"
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
              <p className="text-xs text-[#8F8F8F]">Аналитика и настройки агента</p>
            </div>
          </div>
          <a
            href="/chat?demo=true"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-[#FF6100] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#E55500]"
          >
            Тест как арендатор
          </a>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="rounded-[28px] border border-[#e6e6e6] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="mx-auto h-20 w-20 overflow-hidden rounded-full bg-[#d9d9d9]">
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#d8d8d8] to-[#c6c6c6] text-2xl font-semibold text-white">
                Д
              </div>
            </div>
            <div className="mt-4 text-center text-[30px] font-semibold leading-none">Давид</div>
            <div className="mt-2 text-center text-sm text-[#8f8f8f]">Профиль владельца</div>

            <div className="mt-6 space-y-2 text-sm">
              {[
                "Мои объявления",
                "Заказы",
                "Избранное",
                "Бонусы",
                "Сообщения",
                "Уведомления",
              ].map((item) => (
                <div
                  key={item}
                  className={`rounded-xl px-3 py-2 ${item === "Сообщения" ? "bg-[#f3f7ff] font-medium text-[#3175e0]" : "text-[#5f5f5f]"}`}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </aside>

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
                  label: "Сообщений",
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
                {
                  label: "Позитив",
                  value: isLoading ? "—" : `${positivePercent}%`,
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
                <h3 className="text-sm font-semibold">Разговоры</h3>
              </div>

              {isLoading ? (
                <div className="p-8 text-center text-sm text-[#8f8f8f]">Загрузка...</div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-[#9CA3AF]">
                  <div className="mb-3 text-4xl">💬</div>
                  <div className="text-sm">Пока нет разговоров</div>
                  <div className="mt-1 text-xs">Они появятся когда арендаторы начнут писать</div>
                </div>
              ) : (
                <div className="divide-y divide-[#f3f3f3]">
                  {conversations.map((conv) => {
                    const summary = summaries[conv.id];
                    const isSummaryLoading = summaryLoading[conv.id];

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
                              <span className="ml-auto text-xs text-[#9CA3AF]">
                                {expandedConvId === conv.id ? "▲" : "▼"}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[conv.stage]}`}
                              >
                                {STAGE_LABELS[conv.stage]}
                              </span>
                              {conv.appointment_booked && (
                                <span className="rounded-full bg-[#ffe9d9] px-2 py-0.5 text-xs font-medium text-[#ff6100]">
                                  Запись
                                </span>
                              )}
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
                          {(convMessages[conv.id] || []).map((msg, i) => (
                            <div
                              key={i}
                              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                                  msg.role === "user"
                                    ? "rounded-br-sm bg-[#0066FF] text-white"
                                    : "rounded-bl-sm border border-[#E5E5E5] bg-white text-[#262626]"
                                }`}
                              >
                                {msg.content}
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
                      <div className="font-medium text-[#262626]">
                        {listing.agentName} · {listing.district} · {listing.tone === "warm"
                          ? "Тёплый"
                          : listing.tone === "formal"
                            ? "Официальный"
                            : "Дружелюбный"}
                      </div>
                      <div className="mt-1 text-xs text-[#8f8f8f]">{listing.personality}</div>
                    </div>
                  ))}
                </div>
              </div>

              {metrics && totalSentiments > 0 && (
                <div className="rounded-[28px] border border-[#e6e6e6] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                  <h3 className="text-sm font-semibold">Эмоциональный тон</h3>
                  <div className="mt-4 space-y-3">
                    {(Object.keys(metrics.sentiment_distribution) as Sentiment[]).map((s) => {
                      const count = metrics.sentiment_distribution[s];
                      const pct =
                        totalSentiments > 0 ? Math.round((count / totalSentiments) * 100) : 0;
                      return (
                        <div key={s}>
                          <div className="mb-1 flex justify-between text-xs text-[#8f8f8f]">
                            <span>{SENTIMENT_LABELS[s]}</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-[#f3f3f3]">
                            <div
                              className={`h-full rounded-full transition-all ${SENTIMENT_COLORS[s]}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
