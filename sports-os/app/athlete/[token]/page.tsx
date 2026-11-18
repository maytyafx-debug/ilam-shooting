"use client";
import {use,useEffect,useState} from "react";
import Link from "next/link";
type Achievement={event_title:string;sport_type:string;event_date:string;rank:number;medal:string};
type PublicCard={full_name:string;sport_type:string|null;athlete_category:string|null;organization:string;published_at:string;achievements:Achievement[]};
export default function PublicAthleteCardPage({params}:{params:{token:string}}){
 const [card,setCard]=useState<PublicCard|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;fetch("/api/public/athlete-card?token="+encodeURIComponent(token),{cache:"no-store"})
 .then(async r=>{const p=await r.json();if(!r.ok)throw new Error(p.error||"کارت در دسترس نیست.");return p.card as PublicCard;})
 .then(data=>{if(active)setCard(data);}).catch(e=>{if(active)setError(e instanceof Error?e.message:"کارت در دسترس نیست.");})
 .finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[token]);
 if(loading)return <main className="shell"><p>در حال بررسی اعتبار کارت...</p></main>;
 if(!card)return <main className="shell grid"><section className="panel empty-state"><h1 className="page-heading">کارت قابل نمایش نیست</h1><p className="muted">{error}</p><Link href="/">بازگشت</Link></section></main>;
 return <main className="shell grid public-champion-page"><article className="champion-public-card" dir="rtl"><div className="champion-public-top"><span>METATYA SPORTS OS</span><span>ATHLETE HONOUR CARD</span></div><div className="champion-public-emblem" aria-hidden="true">✦</div><p className="champion-kicker">پروفایل افتخار ورزشکار</p><h1>{card.full_name}</h1><p className="champion-public-sport">{card.sport_type||"رشته ثبت نشده"}{card.athlete_category?" · "+card.athlete_category:""}</p><p className="champion-public-org">{card.organization}</p><div className="champion-public-divider"/><h2>افتخارات تأییدشده</h2>
 {card.achievements.length?<ul className="champion-achievements">{card.achievements.map((a,i)=><li key={i}><span className="champion-medal">{a.medal}</span><span><strong>{a.event_title}</strong><small>{a.sport_type} · {new Date(a.event_date).toLocaleDateString("fa-IR")}</small></span><b>رتبه {a.rank.toLocaleString("fa-IR")}</b></li>)}</ul>:<p className="muted">هنوز افتخار تأییدشده‌ای برای نمایش ثبت نشده است.</p>}
 <footer>این صفحه فقط اطلاعات عمومی مجاز و نتایج تأییدشده را نمایش می‌دهد.</footer></article></main>;
}
