"use client";
import {useEffect,useState} from "react";
import type {CoreEvent,CoreMember} from "../types";
export default function ResultsDashboard({accessToken}:{accessToken:string}){
 const [members,setMembers]=useState<CoreMember[]>([]),[events,setEvents]=useState<CoreEvent[]>([]);
 const [memberId,setMemberId]=useState(""),[eventId,setEventId]=useState("");
 const [score,setScore]=useState(""),[rank,setRank]=useState(""),[notes,setNotes]=useState("");
 const [message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{const headers={Authorization:`Bearer ${accessToken}`};
 Promise.all([fetch("/api/core-sports/members",{headers,cache:"no-store"}),fetch("/api/core-sports/events",{headers,cache:"no-store"})])
 .then(async([m,e])=>{if(!m.ok||!e.ok)throw new Error("بارگذاری اطلاعات ناموفق بود.");
 const [md,ed]=await Promise.all([m.json(),e.json()]);setMembers(md.members??[]);setEvents(ed.events??[]);})
 .catch((e:Error)=>setMessage(e.message));},[accessToken]);
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setMessage("");
 try{const res=await fetch("/api/core-sports/results",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${accessToken}`},
 body:JSON.stringify({member_id:memberId,event_id:eventId,score:score===""?null:Number(score),rank:rank===""?null:Number(rank),notes:notes||null})});
 const data=await res.json();if(!res.ok)throw new Error(data.error??"ثبت نتیجه ناموفق بود.");
 setMessage("نتیجه ثبت شد.");setScore("");setRank("");setNotes("");
 }catch(err){setMessage(err instanceof Error?err.message:"خطای نامشخص");}finally{setBusy(false);}}
 return <section className="space-y-5 rounded-xl bg-white p-6 shadow">
 <h2 className="text-xl font-bold">ثبت نتایج ورزشی</h2>
 <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
 <label className="grid gap-1">عضو<select required value={memberId} onChange={e=>setMemberId(e.target.value)} className="rounded border p-2">
 <option value="">انتخاب عضو</option>{members.map(m=><option key={m.id} value={m.id}>{m.full_name}</option>)}</select></label>
 <label className="grid gap-1">رویداد<select required value={eventId} onChange={e=>setEventId(e.target.value)} className="rounded border p-2">
 <option value="">انتخاب رویداد</option>{events.map(v=><option key={v.id} value={v.id}>{v.title}</option>)}</select></label>
 <label className="grid gap-1">امتیاز<input type="number" step="0.001" value={score} onChange={e=>setScore(e.target.value)} className="rounded border p-2"/></label>
 <label className="grid gap-1">رتبه<input type="number" min="1" step="1" value={rank} onChange={e=>setRank(e.target.value)} className="rounded border p-2"/></label>
 <label className="grid gap-1 md:col-span-2">توضیحات<textarea maxLength={2000} value={notes} onChange={e=>setNotes(e.target.value)} className="rounded border p-2"/></label>
 <button disabled={busy} className="rounded bg-slate-900 p-3 text-white disabled:opacity-50 md:col-span-2">{busy?"در حال ثبت...":"ثبت نتیجه"}</button>
 </form>{message&&<p role="status" aria-live="polite">{message}</p>}</section>;
}
