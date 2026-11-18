import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCoreRole } from "@/lib/core-sports/auth";
export const runtime = "nodejs";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
 const db=await createSupabaseServerClient();
 const auth=await requireCoreRole(db,["admin"],request.headers.get("x-tenant-id"));
 if(!auth.ok)return NextResponse.json({error:auth.error},{status:auth.status});
 const {data:members,error:memberError}=await db.from("sports_members").select("id,full_name,sport_type,status")
 .eq("tenant_id",auth.tenantId).order("full_name",{ascending:true}).limit(1000);
 if(memberError)return NextResponse.json({error:"دریافت ورزشکاران ناموفق بود."},{status:400});
 const ids=(members??[]).map(x=>x.id);
 const {data:profiles,error:profileError}=ids.length?await db.from("sports_athlete_profiles")
 .select("member_id,athlete_category,birth_date").eq("tenant_id",auth.tenantId).in("member_id",ids):{data:[],error:null};
 if(profileError)return NextResponse.json({error:"دریافت اطلاعات کارت‌ها ناموفق بود."},{status:400});
 const {data:cards,error:cardError}=await db.from("sports_athlete_public_cards")
 .select("member_id,public_token,published_at,revoked_at").eq("tenant_id",auth.tenantId);
 if(cardError)return NextResponse.json({error:"دریافت وضعیت کارت‌ها ناموفق بود."},{status:400});
 const pm=new Map((profiles??[]).map(x=>[x.member_id,x]));
 const cm=new Map((cards??[]).map(x=>[x.member_id,x]));
 return NextResponse.json({athletes:(members??[]).map(m=>({...m,
 athlete_category:pm.get(m.id)?.athlete_category??null,birth_date:pm.get(m.id)?.birth_date??null,
 card:cm.get(m.id)??null}))},{headers:{"Cache-Control":"private, no-store"}});
}

export async function POST(request:NextRequest) {
 const db=await createSupabaseServerClient();
 const auth=await requireCoreRole(db,["admin"],request.headers.get("x-tenant-id"));
 if(!auth.ok)return NextResponse.json({error:auth.error},{status:auth.status});
 let body:{member_id?:unknown};try{body=await request.json();}catch{return NextResponse.json({error:"درخواست JSON معتبر نیست."},{status:400});}
 if(!body||typeof body.member_id!=="string"||!UUID_RE.test(body.member_id))
  return NextResponse.json({error:"شناسه ورزشکار معتبر نیست."},{status:400});
 const {data,error}=await db.rpc("sports_publish_athlete_public_card",{p_tenant_id:auth.tenantId,p_member_id:body.member_id});
 if(error||!data)return NextResponse.json({error:error?.code==="42501"
  ?"انتشار مجاز نیست؛ برای ورزشکار زیر ۱۸ سال یا با سن نامشخص، رضایت معتبر سرپرست با محدوده رسانه لازم است."
  :"صدور کارت قهرمانی ناموفق بود."},{status:error?.code==="42501"?403:400});
 return NextResponse.json({success:true,public_token:data},{status:201,headers:{"Cache-Control":"private, no-store"}});
}

export async function DELETE(request:NextRequest) {
 const db=await createSupabaseServerClient();
 const auth=await requireCoreRole(db,["admin"],request.headers.get("x-tenant-id"));
 if(!auth.ok)return NextResponse.json({error:auth.error},{status:auth.status});
 const memberId=request.nextUrl.searchParams.get("member_id");
 if(!memberId||!UUID_RE.test(memberId))return NextResponse.json({error:"شناسه ورزشکار معتبر نیست."},{status:400});
 const {data,error}=await db.rpc("sports_revoke_athlete_public_card",{p_tenant_id:auth.tenantId,p_member_id:memberId});
 if(error)return NextResponse.json({error:"لغو انتشار کارت ناموفق بود."},{status:400});
 return NextResponse.json({success:Boolean(data)},{headers:{"Cache-Control":"private, no-store"}});
}
