import type {SupabaseClient} from "@supabase/supabase-js";
import type {CreateEventInput,CreateMemberInput,CreateResultInput} from "../types";
export class CoreSportsService {
 constructor(private readonly db:SupabaseClient){}
 listMembers(){return this.db.from("members").select("id,profile_id,club_id,full_name,membership_number,phone,birth_date,sport_type,status").order("created_at",{ascending:false});}
 createMember(x:CreateMemberInput){return this.db.from("members").insert({
  full_name:x.full_name.trim(),club_id:x.club_id??null,profile_id:x.profile_id??null,
  membership_number:x.membership_number??null,phone:x.phone??null,birth_date:x.birth_date??null,sport_type:x.sport_type??null
 }).select().single();}
 listEvents(){return this.db.from("events").select("id,club_id,title,sport_type,event_date,location,status").order("event_date",{ascending:true});}
 createEvent(x:CreateEventInput,userId:string){return this.db.from("events").insert({
  title:x.title.trim(),sport_type:x.sport_type.trim(),event_date:x.event_date,club_id:x.club_id??null,
  description:x.description??null,location:x.location??null,created_by:userId
 }).select().single();}
 async createResult(x:CreateResultInput,userId:string){
  const {error}=await this.db.from("results").insert({...x,recorded_by:userId});
  return {error}; // No SELECT/RETURNING for referees: INSERT-only policy.
 }
}
