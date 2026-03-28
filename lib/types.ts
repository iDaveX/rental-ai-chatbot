export type Stage =
  | "greeting"
  | "qualification"
  | "info_exchange"
  | "objection_handling"
  | "soft_nudge"
  | "appointment"
  | "closed";

export type TonePreset = "friendly" | "formal" | "warm" | "business";

export type Sentiment = "positive" | "neutral" | "concerned" | "negative";

export interface Signals {
  intent: string;
  interest_level: number;
  has_objection: boolean;
  objection_type: string;
  urgency: "high" | "medium" | "low";
  readiness_to_view: number;
  sentiment: Sentiment;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  session_id: string;
  stage: Stage;
  signals: Signals;
  sentiment: Sentiment;
  appointment_booked: boolean;
  started_at: string;
  last_message_at: string;
}
