import { NextRequest,NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const runtime="nodejs";
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function GET(request:NextRequest) {
 const token=request.nextUrl.searchParams.get("token")??"";
 if(!UUID_RE.test(token))return NextResponse.json({error:"کارت معتبر نیست یا انتشار آن لغو شده است."},{status:404});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)return NextResponse.json({error:"سرویس کارت قهرمانی در دسترس نیست."},{status:503});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const {data,error}=await db.rpc("sports_get_public_athlete_card",{p_token:token});
 if(error){console.error("[Sports OS] public athlete card lookup failed:",error);return NextResponse.json({error:"دریافت کارت قهرمانی ناموفق بود."},{status:503});}
 if(!data)return NextResponse.json({error:"کارت معتبر نیست یا انتشار آن لغو شده است."},{status:404});
 return NextResponse.json({card:data},{headers:{"Cache-Control":"no-store, max-age=0","X-Robots-Tag":"noindex, nofollow"}});
}
