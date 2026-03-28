"use client";

import Image from "next/image";
import { useState, useEffect, useMemo, useRef } from "react";
import { LISTINGS } from "@/data/listings";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

type Stage =
  | "greeting"
  | "qualification"
  | "info_exchange"
  | "objection_handling"
  | "soft_nudge"
  | "appointment"
  | "closed";

const STAGE_LABELS: Record<Stage, string> = {
  greeting: "Знакомство",
  qualification: "Вопросы",
  info_exchange: "Интерес",
  objection_handling: "Сомнения",
  soft_nudge: "К просмотру",
  appointment: "Запись",
  closed: "Завершено",
};

const STAGE_ORDER: Stage[] = [
  "greeting",
  "qualification",
  "info_exchange",
  "soft_nudge",
  "appointment",
];

const SUGGESTED_QUESTIONS = [
  "Сколько стоит аренда?",
  "Можно посмотреть квартиру?",
  "Какой район и метро?",
];

function generateSessionId() {
  return crypto.randomUUID();
}

export default function ChatPage() {
  const [sessionId, setSessionId] = useState(() => generateSessionId());
  const [messages, setMessages] = useState<Message[]>([]);
  const [deliveredIds, setDeliveredIds] = useState<Set<string>>(new Set());
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [stage, setStage] = useState<Stage>("greeting");
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [listingId, setListingId] = useState("usacheva-11");
  const [historySessionId, setHistorySessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const listing = LISTINGS.find((l) => l.id === listingId) || LISTINGS[0];

  const initialMessage = useMemo<Message>(
    () => ({
      id: "init",
      role: "assistant",
      content: `Здравствуйте! Меня зовут ${listing.agentName}, помогаю с вопросами по квартире ${listing.address}. Чем могу помочь?`,
      timestamp: new Date(),
    }),
    [listing.address, listing.agentName],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("listing") || "usacheva-11";
    const sessionFromQuery = params.get("session");
    setListingId(id);
    setIsDemoMode(params.get("demo") === "true");
    setHistorySessionId(sessionFromQuery);
    setSessionId(sessionFromQuery || generateSessionId());
  }, []);

  useEffect(() => {
    setMessages([]);
    setDeliveredIds(new Set());
    setStage("greeting");
    setShowSuggestions(true);

    if (historySessionId) {
      void (async () => {
        try {
          const response = await fetch(
            `/api/chat/history?sessionId=${encodeURIComponent(historySessionId)}&ts=${Date.now()}`,
            { cache: "no-store" },
          );
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Failed to load chat history");
          }

          if (data.listingSlug) {
            setListingId(data.listingSlug);
          }
          if (data.stage) {
            setStage(data.stage as Stage);
          }

          const restoredMessages: Message[] = (data.messages ?? []).map(
            (message: { id?: string; role: "user" | "assistant"; content: string; created_at: string }) => ({
              id: message.id ?? crypto.randomUUID(),
              role: message.role,
              content: message.content,
              timestamp: new Date(message.created_at),
            }),
          );

          setMessages(restoredMessages.length > 0 ? restoredMessages : [initialMessage]);
          setShowSuggestions(restoredMessages.length === 0);
        } catch (error) {
          console.error("Failed to load chat history", error);
          setMessages([initialMessage]);
        }
      })();

      return;
    }

    const timer = setTimeout(() => {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setMessages([initialMessage]);
      }, 1200);
    }, 800);

    return () => clearTimeout(timer);
  }, [historySessionId, initialMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    setShowSuggestions(false);
    setIsLoading(true);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setTimeout(() => {
      setDeliveredIds((prev) => new Set(prev).add(userMessage.id));
    }, 600);
    setInput("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    const preDelay = Math.random() * 400 + 800;
    await new Promise((r) => setTimeout(r, preDelay));
    setIsTyping(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId, listingId }),
      });

      const data = await res.json();

      const minTypingTime = Math.random() * 600 + 400;
      await new Promise((r) => setTimeout(r, minTypingTime));

      setIsTyping(false);

      if (data.reply) {
        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.reply,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        if (data.stage) setStage(data.stage as Stage);
      }
    } catch {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Секунду, связь немного прервалась. Повторите, пожалуйста?",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    if (e.key === "Enter" && !e.shiftKey && !isMobile) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const currentStageIndex = STAGE_ORDER.indexOf(stage);
  const otherListings = LISTINGS.filter((l) => l.id !== listing.id);

  const chatSurface = (
    <>
      <div className="h-[60px] shrink-0 border-b border-[#E5E5E5] bg-white px-3">
        <div className="flex h-full items-center gap-3">
          <a
            href="/"
            className="-ml-1 flex h-10 w-10 flex-shrink-0 items-center justify-center text-[#262626] md:hidden"
          >
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
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#0066FF] text-sm font-semibold text-white">
            {listing.agentName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold text-[#262626]">
              {listing.agentName}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#8C8C8C]">
              <span className="h-2 w-2 rounded-full bg-[#4CAF50]" />
              <span>на сайте</span>
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-b border-[#E5E5E5] bg-white px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-[#F5F5F5]">
            {listing.photo ? (
              <Image
                src={listing.photo}
                alt={listing.title}
                fill
                sizes="48px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#BBBBBB">
                  <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                </svg>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="truncate text-sm font-semibold text-[#262626]">
              {listing.title.replace("квартира, ", "кв., ")}
            </div>
            <div className="truncate text-xs text-[#8C8C8C]">
              {listing.district} · {listing.address}
            </div>
          </div>
          <div className="text-right text-sm font-bold text-[#262626]">
            {listing.priceLabel}
          </div>
        </div>

        {isDemoMode && (
          <div className="mt-3 overflow-x-auto">
            <div className="flex min-w-max items-center gap-1 text-xs">
              {STAGE_ORDER.map((s, i) => (
                <div key={s} className="flex items-center gap-1">
                  <span
                    className={`whitespace-nowrap rounded-full px-2.5 py-1 transition-all ${
                      i === currentStageIndex
                        ? "bg-[#0066FF] font-medium text-white"
                        : i < currentStageIndex
                          ? "bg-[#E6EEFF] text-[#0066FF]"
                          : "bg-[#F0F0F0] text-[#8C8C8C]"
                    }`}
                  >
                    {STAGE_LABELS[s]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#EFEFF4] px-4 py-5">
        <div className="flex-1" />
        {messages.length > 0 && (
          <div className="my-3 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#E5E7EB]" />
            <span className="whitespace-nowrap text-[11px] text-[#9CA3AF]">Сегодня</span>
            <div className="h-px flex-1 bg-[#E5E7EB]" />
          </div>
        )}
        {messages.map((msg) => {
          return (
            <div
              key={msg.id}
              className={`flex items-end gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#0066FF] text-[11px] font-semibold text-white">
                  {listing.agentName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className={msg.role === "user" ? "max-w-[75%]" : "max-w-[75%]"}>
                <div
                  className={`px-[14px] py-[10px] text-sm leading-[1.45] shadow-[0_1px_1px_rgba(0,0,0,0.06)] ${
                    msg.role === "user"
                      ? "rounded-[18px_18px_4px_18px] bg-[#0066FF] text-white"
                      : "rounded-[18px_18px_18px_4px] bg-white text-[#262626]"
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="mt-0.5 flex justify-end pr-1">
                    <span className="text-[11px] text-[#93C5FD]">✓</span>
                    <span
                      className={`-ml-0.5 text-[11px] transition-opacity duration-300 ${
                        deliveredIds.has(msg.id) ? "text-[#93C5FD] opacity-100" : "opacity-0"
                      }`}
                    >
                      ✓
                    </span>
                  </div>
                )}
                <div
                  className={`mt-0.5 text-[10px] text-[#9CA3AF] ${
                    msg.role === "user" ? "pr-1 text-right" : "pl-1 text-left"
                  }`}
                >
                  {msg.timestamp.toLocaleTimeString("ru-RU", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex items-end gap-2 justify-start">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#0066FF] text-[11px] font-semibold text-white">
              {listing.agentName.charAt(0).toUpperCase()}
            </div>
            <div className="rounded-[18px_18px_18px_4px] bg-white px-4 py-3 shadow-[0_1px_1px_rgba(0,0,0,0.06)]">
              <div className="flex h-4 items-center gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-[#AAAAAA] [animation-delay:0ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-[#AAAAAA] [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-[#AAAAAA] [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {showSuggestions && messages.length > 0 && (
        <div className="flex flex-wrap gap-2 bg-[#EFEFF4] px-3 pb-2">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              className="rounded-[20px] border border-[#CCCCCC] bg-white px-[14px] py-[6px] text-[13px] text-[#0066FF] transition-colors hover:border-[#0066FF]"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <div
        className="shrink-0 border-t border-[#E5E5E5] bg-white px-3 py-2 pb-4"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={handleKeyDown}
            placeholder="Сообщение"
            disabled={isLoading}
            rows={1}
            style={{ fontSize: "16px", resize: "none", lineHeight: "1.4" }}
            className="max-h-[120px] flex-1 overflow-y-auto bg-transparent px-1 outline-none placeholder:text-[#9f9f9f] disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white transition-colors duration-150 ${
              input.trim() ? "bg-[#0066FF]" : "bg-[#DCDCDC]"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <span className="text-[18px] leading-none">↑</span>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div
      className="fixed inset-0 bg-[#EFEFF4] md:bg-[#F5F5F5]"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex h-full w-full flex-col overflow-hidden md:flex-row">
        <aside className="hidden w-[300px] flex-shrink-0 border-r border-[#E5E5E5] bg-white md:flex md:flex-col">
          <div className="p-4">
            <a href="/" className="text-sm text-[#0066FF]">
              ← Все объявления
            </a>
          </div>

          <div className="border-b border-[#EFEFEF]">
            <div className="relative h-40 overflow-hidden bg-gradient-to-br from-[#D5D5D5] to-[#C0C0C0]">
              {listing.photo ? (
                <Image
                  src={listing.photo}
                  alt={listing.title}
                  fill
                  sizes="300px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="#AAAAAA">
                    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                  </svg>
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="text-xl font-bold text-[#262626]">{listing.priceLabel}</div>
              <div className="mt-1 text-sm font-semibold text-[#262626]">{listing.title}</div>
              <div className="mt-1 text-xs text-[#8C8C8C]">
                {listing.district}, {listing.address}
              </div>
              <div className="mt-2 flex items-center gap-1">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: listing.metroColor }}
                />
                <span className="text-xs text-[#8C8C8C]">{listing.metro}</span>
              </div>
              <div className="mt-4 border-t border-[#EFEFEF] pt-3 text-xs text-[#555555]">
                <div>Залог: {listing.kb.listing.deposit}</div>
                <div>Комиссия: {listing.kb.listing.commission}</div>
                <div>Срок аренды: {listing.kb.conditions.lease_term}</div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-3 text-[11px] uppercase tracking-[0.08em] text-[#8C8C8C]">
              Другие объявления
            </div>
            {otherListings.map((l) => (
              <a
                key={l.id}
                href={`/chat?listing=${l.id}${isDemoMode ? "&demo=true" : ""}`}
                className="flex gap-2 px-3 py-3 transition-colors hover:bg-[#F5F5F5]"
              >
                <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-[#EEEEEE]">
                  {l.photo ? (
                    <Image
                      src={l.photo}
                      alt={l.title}
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#B5B5B5">
                        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-[#262626]">
                    {l.priceLabel}
                  </div>
                  <div className="truncate text-[11px] text-[#8C8C8C]">{l.title}</div>
                </div>
              </a>
            ))}
          </div>
        </aside>

        <div className="flex flex-1 flex-col overflow-hidden">{chatSurface}</div>
      </div>
    </div>
  );
}
