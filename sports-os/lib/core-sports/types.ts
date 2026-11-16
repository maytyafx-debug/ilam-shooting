export type CoreRole="admin"|"referee"|"member";
export interface CoreMember{id:string;profile_id:string|null;club_id:string|null;full_name:string;membership_number:string|null;phone:string|null;birth_date:string|null;sport_type:string|null;status:"active"|"inactive"|"suspended"}
export interface CoreEvent{id:string;club_id:string|null;title:string;sport_type:string;event_date:string;location:string|null;status:"scheduled"|"ongoing"|"completed"|"cancelled"}
export interface CreateMemberInput{full_name:string;club_id?:string|null;profile_id?:string|null;membership_number?:string|null;phone?:string|null;birth_date?:string|null;sport_type?:string|null}
export interface CreateEventInput{title:string;sport_type:string;event_date:string;club_id?:string|null;description?:string|null;location?:string|null}
export interface CreateResultInput{event_id:string;member_id:string;score?:number|null;rank?:number|null;notes?:string|null}
