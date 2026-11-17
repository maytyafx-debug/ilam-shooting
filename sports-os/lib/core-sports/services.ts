import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateEventInput, CreateMemberInput, CreateResultInput } from "./types";

export class CoreSportsService {
  constructor(
    private readonly db: SupabaseClient<any, any, any, any, any>,
    private readonly tenantId: string,
  ) {}

  listMembers() {
    return this.db
      .from("sports_members")
      .select("id,tenant_id,full_name,sport_type,phone,status,created_at")
      .eq("tenant_id", this.tenantId)
      .order("created_at", { ascending: false });
  }

  createMember(input: CreateMemberInput) {
    return this.db
      .from("sports_members")
      .insert({
        tenant_id: this.tenantId,
        full_name: input.full_name.trim(),
        sport_type: input.sport_type?.trim() || null,
        phone: input.phone?.trim() || null,
      })
      .select("id,tenant_id,full_name,sport_type,phone,status,created_at")
      .single();
  }

  listEvents() {
    return this.db
      .from("sports_events")
      .select("id,tenant_id,title,sport_type,event_date,location,status,created_at")
      .eq("tenant_id", this.tenantId)
      .order("event_date", { ascending: true });
  }

  createEvent(input: CreateEventInput) {
    return this.db
      .from("sports_events")
      .insert({
        tenant_id: this.tenantId,
        title: input.title.trim(),
        sport_type: input.sport_type.trim(),
        event_date: input.event_date,
        location: input.location?.trim() || null,
      })
      .select("id,tenant_id,title,sport_type,event_date,location,status,created_at")
      .single();
  }

  async createResult(input: CreateResultInput) {
    return this.db.from("sports_results").insert({
      tenant_id: this.tenantId,
      event_id: input.event_id,
      member_id: input.member_id,
      score: input.score ?? null,
      rank: input.rank ?? null,
      notes: input.notes?.trim() || null,
    });
  }
}
