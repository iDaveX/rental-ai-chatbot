import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeAssistantReply(text: string) {
  const trimmed = text.trim();

  if (!trimmed) {
    return trimmed;
  }

  const firstChar = trimmed.charAt(0);
  const upperFirstChar = firstChar.toLocaleUpperCase("ru-RU");

  if (firstChar === upperFirstChar) {
    return trimmed;
  }

  return `${upperFirstChar}${trimmed.slice(1)}`;
}
