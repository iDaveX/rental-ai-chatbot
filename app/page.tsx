"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { LISTINGS } from "@/data/listings";

function badgeColor(badge?: string) {
  if (badge === "Топ") return "bg-[#FF6100]";
  if (badge === "Новинка") return "bg-[#0066FF]";
  if (badge === "Премиум") return "bg-[#8B00FF]";
  return "";
}

export default function Home() {
  const [roomFilter, setRoomFilter] = useState<number | null>(null);
  const [priceFilter, setPriceFilter] = useState<number | null>(null);

  const filtered = LISTINGS.filter((l) => {
    if (roomFilter !== null && l.rooms !== roomFilter) return false;
    if (priceFilter !== null && l.price > priceFilter) return false;
    return true;
  });

  return (
    <div className="min-h-[100dvh] bg-[#EFEFF4] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-20 h-14 border-b border-[#E5E5E5] bg-white px-4">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between">
          <span className="text-2xl font-extrabold text-[#00AAFF]">Авито</span>
          <Link
            href="/admin"
            className="rounded-full border border-[#0066FF] px-4 py-1.5 text-sm text-[#0066FF] transition-colors hover:bg-[#0066FF] hover:text-white"
          >
            Для арендодателей
          </Link>
        </div>
      </header>

      <div className="sticky top-14 z-10 border-b border-[#EEEEEE] bg-white px-4 py-2.5">
        <div className="mx-auto max-w-7xl">
          <div className="flex w-full items-center rounded-[10px] bg-[#F5F5F5] px-4 py-2.5">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#8C8C8C"
              strokeWidth="2"
              className="mr-3 shrink-0"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <span className="text-sm text-[#8C8C8C]">Квартиры в аренду · Москва</span>
          </div>

          <div className="mt-2 flex gap-2 overflow-x-auto scrollbar-hide">
            {[null, 0, 1, 2, 3].map((r) => (
              <button
                key={r ?? "any"}
                onClick={() => setRoomFilter(r)}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  roomFilter === r
                    ? "border-[#0066FF] bg-[#0066FF] text-white"
                    : "border-[#E0E0E0] bg-white text-[#262626]"
                }`}
              >
                {r === null ? "Любые комнаты" : r === 0 ? "Студия" : `${r}-комн.`}
              </button>
            ))}
            {[null, 50000, 70000, 100000].map((p) => (
              <button
                key={p ?? "any-price"}
                onClick={() => setPriceFilter(p)}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  priceFilter === p
                    ? "border-[#0066FF] bg-[#0066FF] text-white"
                    : "border-[#E0E0E0] bg-white text-[#262626]"
                }`}
              >
                {p === null ? "Любая цена" : `до ${(p / 1000).toFixed(0)} 000 ₽`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-24 pt-3">
        <div className="px-0 pb-4 text-sm text-[#8C8C8C]">Найдено {filtered.length} объявлений</div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-4">
          {filtered.length === 0 && (
            <div className="col-span-full flex flex-col items-center py-20 text-[#9CA3AF]">
              <div className="mb-3 text-4xl">🔍</div>
              <div className="text-sm font-medium text-[#262626]">Ничего не найдено</div>
              <div className="mt-1 text-xs">Попробуйте изменить фильтры</div>
              <button
                onClick={() => {
                  setRoomFilter(null);
                  setPriceFilter(null);
                }}
                className="mt-4 text-sm text-[#0066FF]"
              >
                Сбросить фильтры
              </button>
            </div>
          )}
          {filtered.map((listing) => (
            <Link
              key={listing.id}
              href={`/chat?listing=${listing.id}`}
              className="overflow-hidden rounded-2xl bg-white transition-shadow duration-150 hover:shadow-md"
            >
              <div className="relative h-40 bg-[#E8E8E8]">
                {listing.photo ? (
                  <div className="relative h-full w-full">
                    <Image
                      src={listing.photo}
                      alt={listing.title}
                      fill
                      sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#D5D5D5] to-[#C0C0C0]">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="#AAAAAA">
                      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                    </svg>
                  </div>
                )}
                {listing.badge && (
                  <span
                    className={`absolute left-0 top-0 rounded-br-lg px-2 py-0.5 text-xs font-semibold text-white ${badgeColor(listing.badge)}`}
                  >
                    {listing.badge}
                  </span>
                )}
              </div>

              <div className="p-3">
                <div className="text-[18px] font-bold text-[#262626]">
                  {listing.price.toLocaleString("ru-RU")} ₽
                  <span className="ml-1 text-sm font-normal text-[#8C8C8C]">/мес</span>
                </div>

                <div className="mt-1 text-sm text-[#262626]">{listing.title}</div>

                <div className="mt-1 truncate text-xs text-[#8C8C8C]">
                  {listing.district}, {listing.address}
                </div>

                <div className="mt-2 flex items-center gap-1">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: listing.metroColor }}
                  />
                  <span className="text-xs text-[#8C8C8C]">{listing.metro}</span>
                </div>

                <div className="mt-3 w-full rounded-[10px] bg-[#0066FF] px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-[#0052CC]">
                  Написать
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
