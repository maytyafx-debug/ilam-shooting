import {NextRequest,NextResponse} from "next/server";
import {createCoreSportsClient,getBearerToken} from "../../../../core-sports/supabase";
import {requireCoreRole} from "../../../../core-sports/auth";
import {CoreSportsService} from "../../../../core-sports/services";
import type {CreateEventInput} from "../../../../core-sports/types";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 const token=getBearerToken(req);if(!token)return NextResponse.json({error:"Missing bearer token"},{status:401});
 const db=createCoreSportsClient(token),auth=await requireCoreRole(db,token,["admin","referee"]);
 if(!auth.ok)return NextResponse.json({error:auth.error},{status:auth.status});
 const {data,error}=await new CoreSportsService(db).listEvents();
 if(error)return NextResponse.json({error:"Unable to list events"},{status:400});
 return NextResponse.json({events:data});
}
export async function POST(req:NextRequest){
 const token=getBearerToken(req);if(!token)return NextResponse.json({error:"Missing bearer token"},{status:401});
 const db=createCoreSportsClient(token),auth=await requireCoreRole(db,token,["admin"]);
 if(!auth.ok)return NextResponse.json({error:auth.error},{status:auth.status});
 let body:CreateEventInput;try{body=await req.json();}catch{return NextResponse.json({error:"Invalid JSON"},{status:400});}
 if(typeof body.title!=="string"||!body.title.trim()||body.title.length>200||
 typeof body.sport_type!=="string"||!body.sport_type.trim()||
 typeof body.event_date!=="string"||!Number.isFinite(Date.parse(body.event_date)))
 return NextResponse.json({error:"Invalid event data"},{status:400});
 const {data,error}=await new CoreSportsService(db).createEvent(body,auth.user.id);
 if(error)return NextResponse.json({error:"Unable to create event"},{status:400});
 return NextResponse.json({event:data},{status:201});
}
