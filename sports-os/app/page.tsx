"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { CoreEvent, CoreMember } from "@/lib/core-sports/types";

type ApiError = { error?: string };

export default function DashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [members, setMembers] = useState<CoreMember[]>([]);
  const [events, setEvents] = useState<CoreEvent[]>([]);
  const [memberId, setMemberId] = useState("");
  const [eventId, setEventId] = useState("");
  const [score, setScore] = useState("");
  const [rank, setRank] = useState("");
  const [notes, setNotes] = useState("");
  const [memberName, setMemberName] = useState("");
  const [sportType, setSportType] = useState("تیراندازی ورزشی");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadData() {
    const [memberResponse, eventResponse] = await Promise.all([
      fetch("/api/core-sports/members", { cache: "no-store" }),
      fetch("/api/core-sports/events", { cache: "no-store" }),
    ]);
    if (memberResponse.status === 401 || eventResponse.status === 401) {
      router.replace("/login");
      return;
    }
    const memberPayload = await memberResponse.json();
    const eventPayload = await eventResponse.json();
    if (!memberResponse.ok || !eventResponse.ok) {
      throw new Error((memberPayload as ApiError).error || (eventPayload as ApiError).error || "دریافت اطلاعات ناموفق بود.");
    }
    setMembers(memberPayload.members ?? []);
    setEvents(eventPayload.events ?? []);
  }

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          router.replace("/login");
          return;
        }
        await loadData();
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "خطای ارتباط با سرویس");
      } finally {
        if (active) setReady(true);
      }
    }
    void init();
    return () => { active = false; };
  }, [router]);

  async function postJson(path: string, body: unknown) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error((payload as ApiError).error || "عملیات ناموفق بود.");
    return payload;
  }

  async function submitMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await postJson("/api/core-sports/members", { full_name: memberName, sport_type: sportType });
      setMemberName("");
      await loadData();
      setMessage("عضو با موفقیت ثبت شد.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ثبت عضو ناموفق بود.");
    } finally { setBusy(false); }
  }

  async function submitEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await postJson("/api/core-sports/events", { title: eventTitle, sport_type: sportType, event_date: new Date(eventDate).toISOString() });
      setEventTitle("");
      setEventDate("");
      await loadData();
      setMessage("رویداد با موفقیت ثبت شد.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ثبت رویداد ناموفق بود.");
    } finally { setBusy(false); }
  }

  async function submitResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await postJson("/api/core-sports/results", {
        member_id: memberId,
        event_id: eventId,
        score: score === "" ? null : Number(score),
        rank: rank === "" ? null : Number(rank),
        notes: notes || null,
      });
      setMessage("نتیجه با موفقیت ثبت شد.");
      setScore("");
      setRank("");
      setNotes("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ثبت نتیجه ناموفق بود.");
    } finally { setBusy(false); }
  }

  async function signOut() {
    await createSupabaseBrowserClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (!ready) return <main className="shell"><p>در حال بارگذاری پنل...</p></main>;

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-inner">
          <div><div className="brand">METATYA Sports OS</div><small>هسته‌ی مشترک مدیریت ورزش</small></div>
          <button className="btn secondary" onClick={signOut}>خروج</button>
        </div>
      </header>
      <main className="shell grid">
        <section>
          <h1 className="page-heading">داشبورد مدیریتی</h1>
          <p className="muted">مدیریت اعضا، رویدادها و نتایج ورزشی</p>
        </section>
        <section className="stats">
          <div className="stat"><span className="muted">اعضای قابل مشاهده</span><strong>{members.length}</strong></div>
          <div className="stat"><span className="muted">رویدادهای قابل مشاهده</span><strong>{events.length}</strong></div>
        </section>
        <section className="panel">
          <h2 className="section-title">ثبت عضو جدید</h2>
          <form className="form-grid" onSubmit={submitMember}>
            <div className="field"><label htmlFor="member-name">نام و نام خانوادگی</label><input id="member-name" required maxLength={150} value={memberName} onChange={e => setMemberName(e.target.value)} /></div>
            <div className="field"><label htmlFor="member-sport">رشته ورزشی</label><input id="member-sport" value={sportType} onChange={e => setSportType(e.target.value)} /></div>
            <div className="field full"><button className="btn" disabled={busy}>ثبت عضو</button></div>
          </form>
        </section>
        <section className="panel">
          <h2 className="section-title">ثبت رویداد جدید</h2>
          <form className="form-grid" onSubmit={submitEvent}>
            <div className="field"><label htmlFor="event-title">عنوان رویداد</label><input id="event-title" required maxLength={200} value={eventTitle} onChange={e => setEventTitle(e.target.value)} /></div>
            <div className="field"><label htmlFor="event-date">تاریخ و ساعت</label><input id="event-date" type="datetime-local" required value={eventDate} onChange={e => setEventDate(e.target.value)} /></div>
            <div className="field full"><button className="btn" disabled={busy}>ثبت رویداد</button></div>
          </form>
        </section>
        <section className="panel">
          <h2 className="section-title">ثبت نتیجه رویداد</h2>
          <form className="form-grid" onSubmit={submitResult}>
            <div className="field"><label htmlFor="member">ورزشکار / عضو</label><select id="member" required value={memberId} onChange={e => setMemberId(e.target.value)}><option value="">انتخاب عضو</option>{members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select></div>
            <div className="field"><label htmlFor="event">رویداد</label><select id="event" required value={eventId} onChange={e => setEventId(e.target.value)}><option value="">انتخاب رویداد</option>{events.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}</select></div>
            <div className="field"><label htmlFor="score">امتیاز</label><input id="score" type="number" step="0.001" value={score} onChange={e => setScore(e.target.value)} /></div>
            <div className="field"><label htmlFor="rank">رتبه</label><input id="rank" type="number" min="1" step="1" value={rank} onChange={e => setRank(e.target.value)} /></div>
            <div className="field full"><label htmlFor="notes">توضیحات</label><textarea id="notes" maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} /></div>
            <div className="field full"><button className="btn" disabled={busy || members.length === 0 || events.length === 0}>ثبت نتیجه</button></div>
          </form>
          {message && <p className="status" role="status" aria-live="polite">{message}</p>}
        </section>
        <section className="panel">
          <h2 className="section-title">فهرست اعضا</h2>
          {members.length === 0 ? <p className="muted">عضوی ثبت نشده است.</p> : <ul className="list">{members.map(member => <li key={member.id}>{member.full_name} <span className="muted">— {member.sport_type || "رشته ثبت نشده"}</span></li>)}</ul>}
        </section>
        <section className="panel">
          <h2 className="section-title">رویدادها</h2>
          {events.length === 0 ? <p className="muted">رویدادی ثبت نشده است.</p> : <ul className="list">{events.map(item => <li key={item.id}>{item.title} — {new Date(item.event_date).toLocaleDateString("fa-IR")}</li>)}</ul>}
        </section>
      </main>
    </>
  );
}
