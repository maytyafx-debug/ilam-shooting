import { createClient, type SupabaseClient } from "@supabase/supabase-js";
export function createCoreSportsClient(accessToken:string):SupabaseClient {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key) throw new Error("Missing Supabase environment variables.");
 return createClient(url,key,{
  db:{schema:"sports_core"},
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{headers:{Authorization:`Bearer ${accessToken}`}}
 });
}
export function getBearerToken(request:Request):string|null {
 const header=request.headers.get("authorization");
 return header?.startsWith("Bearer ")?header.slice(7).trim()||null:null;
}
