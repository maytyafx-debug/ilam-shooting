import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateEventInput, CreateMemberInput, CreateResultInput } from "./types";

export class CoreSportsService {
  private readonly sports;

  constructor(private readonly db: SupabaseClient<any, any, any, any, any>) {
    this.sports = db.schema("sports_core");
  }

  private async currentTenantId(): Promise<string> {
    const { data, error } = await this.sports.rpc("sports_current_tenant_id");
    if (error || typeof data !== "string") {
      throw new Error("An authorized active tenant context is required.");
    }
    return data;
  }

  listMembers() {
    return this.sports
      .from("sports_members")
      .select("id,profile_id,club_id,full_name,membership_number,phone,birth_date,sport_type,status")
      .order("created_at", { ascending: false });
  }

  async createMember(input: CreateMemberInput) {
    const tenantId = await this.currentTenantId();
    return this.sports
      .from("sports_members")
      .insert({
        tenant_id: tenantId,
        full_name: input.full_name.trim(),
        club_id: input.club_id ?? null,
        profile_id: input.profile_id ?? null,
        membership_number: input.membership_number?.trim() || null,
        phone: input.phone?.trim() || null,
        birth_date: input.birth_date || null,
        sport_type: input.sport_type?.trim() || null,
      })
      .select()
      .single();
  }

  listEvents() {
    return this.sports
      .from("sports_events")
      .select("id,club_id,title,sport_type,event_date,location,status")
      .order("event_date", { ascending: true });
  }

  async createEvent(input: CreateEventInput, userId: string) {
    const tenantId = await this.currentTenantId();
    return this.sports
      .from("sports_events")
      .insert({
        tenant_id: tenantId,
        title: input.title.trim(),
        sport_type: input.sport_type.trim(),
        event_date: input.event_date,
        club_id: input.club_id ?? null,
        description: input.description?.trim() || null,
        location: input.location?.trim() || null,
        created_by: userId,
      })
      .select()
      .single();
  }

  async createResult(input: CreateResultInput, userId: string) {
    const tenantId = await this.currentTenantId();
    const { error } = await this.sports.from("sports_results").insert({
      tenant_id: tenantId,
      event_id: input.event_id,
      member_id: input.member_id,
      score: input.score ?? null,
      rank: input.rank ?? null,
      notes: input.notes?.trim() || null,
      recorded_by: userId,
    });
    return { error };
  }
}
