export type CoreRole = "admin" | "referee" | "member";

export interface CoreMember {
  id: string;
  tenant_id: string;
  full_name: string;
  sport_type: string | null;
  phone: string | null;
  status: "active" | "inactive" | "suspended";
  created_at: string;
}

export interface CoreEvent {
  id: string;
  tenant_id: string;
  title: string;
  sport_type: string | null;
  event_date: string;
  location: string | null;
  status: "scheduled" | "ongoing" | "completed" | "cancelled";
  created_at: string;
}

export interface CreateMemberInput {
  full_name: string;
  phone?: string | null;
  sport_type?: string | null;
}

export interface CreateEventInput {
  title: string;
  sport_type: string;
  event_date: string;
  location?: string | null;
}

export interface CreateResultInput {
  event_id: string;
  member_id: string;
  score?: number | null;
  rank?: number | null;
  notes?: string | null;
}
