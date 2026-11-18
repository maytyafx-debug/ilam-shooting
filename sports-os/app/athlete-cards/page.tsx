"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {QRCodeSVG} from "qrcode.react";
import {createSupabaseBrowserClient} from "@/lib/supabase/client";
type Athlete={id:string;full_name:string;sport_type:string|null;athlete_category:string|null;birth_date:string|null;status:"active"|"inactive"|"suspended";card:{member_id:string;public_token:string;published_at:string|null;revoked_at:string|null}|null};
type Tenant={id:string;name:string;role:string};
const TENANT_KEY="metatya-sports-os-active-tenant";
export default function AthleteCardsPage(){
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false);
 const [tenantId,setTenantId]=useState(""),[tenantName,setTenantName]=useState("");
 const [tenants,setTenants]=useState<Tenant[]>([]),[athletes,setAthletes]=useState<Athlete[]>([]);
 const [search,setSearch]=useState(""),[selected,setSelected]=useState<Athlete|null>(null);
 const [message,setMessage]=useState(""),[error,setError]=useState("");
 const load=useCallback(async(id:string)=>{const r=await fetch("/api/core-sports/athlete-cards",{cache:"no-store",headers:{"x-tenant-id":id}});const p=await r.json();if(!r.ok)throw new Error(p.error||"دریافت فهرست کارت‌ها ناموفق بود.");setAthletes(p.athletes??[]);},[]);
 useEffect(()=>{let active=true;async function init(){try{const db=createSupabaseBrowserClient();const {data}=await db.auth.getUser();if(!data.user){window.location.assign("/login");return;}
 const r=await fetch("/api/core-sports/tenant",{cache:"no-store"}),p=await r.json();if(!r.ok)throw new Error(p.error||"سازمان فعالی پیدا نشد.");
 const options=(p.tenants??[]) as Tenant[];if(!active)return;setTenants(options);
 const stored=window.sessionStorage.getItem(TENANT_KEY)??"",chosen=options.length===1?options[0]:options.find(x=>x.id===stored);
 if(!chosen){setMessage("برای ادامه، سازمان فعال را انتخاب کنید.");return;}
 if(chosen.role!=="owner"&&chosen.role!=="admin"){setError("دسترسی این بخش فقط برای مدیر سازمان مجاز است.");return;}
 setTenantId(chosen.id);setTenantName(chosen.name);window.sessionStorage.setItem(TENANT_KEY,chosen.id);await load(chosen.id);
 }catch(e){if(active)setError(e instanceof Error?e.message:"بارگذاری ناموفق بود.");}finally{if(active)setReady(true);}}
 void init();return()=>{active=false;};},[load]);
 const filtered=useMemo(()=>{const q=search.trim().toLocaleLowerCase();return athletes.filter(a=>!q||a.full_name.toLocaleLowerCase().includes(q)||(a.sport_type??"").toLocaleLowerCase().includes(q));},[athletes,search]);
 async function changeTenant(id:string){const chosen=tenants.find(x=>x.id===id);if(!chosen)return;setBusy(true);setTenantId("");setSelected(null);setAthletes([]);setMessage("");setError("");
 if(chosen.role!=="owner"&&chosen.role!=="admin"){setError("دسترسی این بخش فقط برای مدیر سازمان مجاز است.");setBusy(false);return;}
 try{window.sessionStorage.setItem(TENANT_KEY,id);setTenantId(id);setTenantName(chosen.name);await load(id);}catch(e){setError(e instanceof Error?e.message:"بارگذاری ناموفق بود.");}finally{setBusy(false);}}
 async function issueCard(a:Athlete){if(!tenantId)return;setBusy(true);setError("");setMessage("");try{const r=await fetch("/api/core-sports/athlete-cards",{method:"POST",headers:{"Content-Type":"application/json","x-tenant-id":tenantId},body:JSON.stringify({member_id:a.id})});const p=await r.json();if(!r.ok)throw new Error(p.error||"صدور کارت ناموفق بود.");const next={...a,card:{member_id:a.id,public_token:p.public_token,published_at:new Date().toISOString(),revoked_at:null}};await load(tenantId);setSelected(next);setMessage("کارت قهرمانی صادر شد؛ QR اختصاصی آماده اسکن و چاپ است.");}catch(e){setError(e instanceof Error?e.message:"صدور کارت ناموفق بود.");}finally{setBusy(false);}}
 async function revokeCard(a:Athlete){if(!tenantId||!window.confirm("انتشار کارت لغو شود؟ QR قبلی بلافاصله از اعتبار خارج می‌شود."))return;setBusy(true);setError("");setMessage("");try{const r=await fetch("/api/core-sports/athlete-cards?member_id="+encodeURIComponent(a.id),{method:"DELETE",headers:{"x-tenant-id":tenantId}});const p=await r.json();if(!r.ok)throw new Error(p.error||"لغو انتشار ناموفق بود.");await load(tenantId);setSelected(null);setMessage("انتشار کارت لغو شد و QR قبلی دیگر معتبر نیست.");}catch(e){setError(e instanceof Error?e.message:"لغو انتشار ناموفق بود.");}finally{setBusy(false);}}
 const activeCard=selected?.card&&!selected.card.revoked_at&&selected.card.published_at?selected.card:null;
 const publicUrl=activeCard&&typeof window!=="undefined"?window.location.origin+"/athlete/"+activeCard.public_token:"";
 if(!ready)return <main className="shell"><p>در حال بارگذاری کارت‌های قهرمانی...</p></main>;
 return <><header className="topbar"><div className="shell topbar-inner"><div><div className="brand">METATYA Sports OS</div><small>کارت هوشمند قهرمانان{tenantName?" — "+tenantName:""}</small><nav className="top-nav"><Link href="/">داشبورد</Link><Link href="/members">پرونده ورزشکاران</Link></nav></div>
 <div className="topbar-actions">{tenants.length>1&&<div className="tenant-switcher"><label htmlFor="card-tenant">سازمان فعال</label><select id="card-tenant" value={tenantId} disabled={busy} onChange={e=>void changeTenant(e.target.value)}><option value="">انتخاب سازمان</option>{tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div>}<span className="role-chip">مدیر سازمان</span><Link className="btn secondary" href="/">بازگشت</Link></div></div></header>
 <main className="shell grid"><section className="page-intro"><div><h1 className="page-heading">کارت دیجیتال افتخار</h1><p className="muted">QR یکتا برای پروفایل عمومی مجاز و افتخارات تأییدشده</p></div><button className="btn secondary" disabled={busy||!tenantId} onClick={()=>tenantId&&void load(tenantId)}>به‌روزرسانی</button></section>
 {message&&<p className="status" role="status">{message}</p>}{error&&<p className="status error" role="alert">{error}</p>}
 {!tenantId&&tenants.length>1&&<section className="panel empty-state"><p>ابتدا سازمان فعال را انتخاب کنید.</p></section>}
 {tenantId&&<section className="panel"><div className="section-heading-row"><h2 className="section-title">فهرست ورزشکاران</h2><span className="muted">{filtered.length.toLocaleString("fa-IR")} پرونده</span></div>
 <input className="filter-input" aria-label="جستجوی ورزشکار" placeholder="جستجو بر اساس نام یا رشته..." value={search} onChange={e=>setSearch(e.target.value)}/>
 <div className="table-wrap"><table className="results-table"><thead><tr><th>ورزشکار</th><th>رشته / رده</th><th>وضعیت کارت</th><th>عملیات</th></tr></thead><tbody>{filtered.map(a=>{const published=Boolean(a.card?.published_at&&!a.card.revoked_at);return <tr key={a.id}><td>{a.full_name}</td><td>{[a.sport_type,a.athlete_category].filter(Boolean).join(" / ")||"—"}</td><td>{published?"منتشرشده":"بدون کارت فعال"}</td><td><div className="topbar-actions"><button className="btn secondary" disabled={busy||a.status!=="active"} onClick={()=>published?setSelected(a):void issueCard(a)}>{published?"نمایش QR":"صدور کارت"}</button>{published&&<button className="btn secondary" disabled={busy} onClick={()=>void revokeCard(a)}>لغو انتشار</button>}</div></td></tr>;})}</tbody></table></div>
 <p className="muted">برای ورزشکار زیر ۱۸ سال یا با تاریخ تولد نامشخص، رضایت معتبر سرپرست با محدوده رسانه الزامی است.</p></section>}
 {activeCard&&selected&&<section className="champion-card-wrap"><article className="champion-card" dir="rtl"><div className="champion-card-top"><span>METATYA SPORTS OS</span><span>HONOUR PROFILE</span></div><div className="champion-card-body"><div><div className="champion-kicker">کارت هوشمند قهرمان</div><h2>{selected.full_name}</h2><p>{selected.sport_type||"رشته ورزشی ثبت نشده"}{selected.athlete_category?" · "+selected.athlete_category:""}</p><small>پروفایل عمومی مجاز سازمان</small></div><div className="champion-qr"><QRCodeSVG value={publicUrl} size={164} level="H" includeMargin/></div></div><div className="champion-card-foot"><span>اسکن کنید و افتخارات تأییدشده را ببینید</span><span>UNIQUE VERIFIED QR</span></div></article>
 <div className="topbar-actions print-hide"><button className="btn" onClick={()=>window.print()}>چاپ کارت</button><button className="btn secondary" onClick={()=>{void navigator.clipboard.writeText(publicUrl);setMessage("پیوند کارت کپی شد.");}}>کپی پیوند</button><button className="btn secondary" onClick={()=>setSelected(null)}>بستن پیش‌نمایش</button></div><p className="muted print-hide">اطلاعات حساس داخل QR ذخیره نمی‌شود؛ شناسه تصادفی و قابل لغو است.</p></section>}</main></>;
}
