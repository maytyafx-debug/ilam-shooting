"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type EventInfo = {
  id: string;
  title: string;
  event_date: string;
  location: string | null;
  status: string;
} | null;

type AthleteProfile = {
  type: "athlete";
  tenant_id: string;
  member: { id: string; full_name: string; sport_type: string | null; status: string; created_at: string };
  identity: {
    personal_code: string | null;
    membership_number: string | null;
    athlete_category: string | null;
    gender: string | null;
    development_category: string | null;
  } | null;
  results: { id: string; score: number | null; rank: number | null; created_at: string; event: EventInfo }[];
  memberships: { status: string; start_date: string; end_date: string | null; fee_amount: number | null; currency: string }[];
  insurance: { provider_name: string; coverage_end: string; status: string }[];
  registrations: { status: string; registered_at: string; event: EventInfo }[];
};

type StaffProfile = {
  type: "coach" | "referee";
  tenant_id: string;
  identity: {
    personal_code: string;
    display_name: string;
    credential_title: string | null;
    credential_number: string | null;
    credential_level: string | null;
    credential_expires_on: string | null;
    status: string;
  };
  assignments: { id: string; role: string; status: string; assigned_at: string; event: EventInfo }[];
  development_plans: { id: string; title: string; stage: string; status: string; review_date: string | null }[];
};

type Payload = {
  account?: { email: string | null };
  profiles?: (AthleteProfile | StaffProfile)[];
  needs_linking?: boolean;
  error?: string;
};

const date = (value?: string | null) => value ? new Date(value).toLocaleDateString("fa-IR") : "—";
const roleName = (type: string) => type === "athlete" ? "ورزشکار" : type === "coach" ? "مربی" : "داور";
const statusName = (value: string) => ({
  active: "فعال",
  pending: "در انتظار بررسی",
  expired: "منقضی",
  suspended: "تعلیق‌شده",
  verified: "تأییدشده",
  assigned: "تخصیص‌یافته",
  confirmed: "تأیید حضور",
  completed: "تکمیل‌شده",
  registered: "ثبت‌نام‌شده",
  approved: "تأییدشده",
  waitlisted: "فهرست انتظار",
}[value] ?? value);

export default function PersonalPortalPage() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/personal-portal", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as Payload;
        if (!response.ok) throw new Error(data.error || "دریافت اطلاعات ممکن نشد.");
        if (active) setPayload(data);
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : "خطای ارتباط با سرویس");
      })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-inner">
          <div>
            <div className="brand">METATYA Sports OS</div>
            <small>پنل شخصی و پرونده اختصاصی</small>
          </div>
          <div className="topbar-actions">
            <Link className="btn secondary" href="/">بازگشت به سامانه</Link>
          </div>
        </div>
      </header>
      <main className="shell grid gap-4">
        <section className="page-intro">
          <div>
            <h1 className="page-heading">پنل شخصی من</h1>
            <p className="muted">اطلاعات این صفحه فقط از پرونده‌های متصل به حساب واردشده دریافت می‌شود.</p>
            {payload?.account?.email && <p className="muted">{payload.account.email}</p>}
          </div>
        </section>

        {busy && <section className="panel">در حال دریافت پرونده‌های اختصاصی...</section>}
        {message && <p className="status error" role="alert">{message}</p>}

        {!busy && payload?.needs_linking && (
          <section className="panel empty-state">
            <h2 className="section-title">پرونده‌ای به این حساب متصل نیست</h2>
            <p className="muted">برای حفاظت از اطلاعات، جستجو بر اساس کد یا نام به‌تنهایی انجام نمی‌شود. مدیر مجاز سازمان باید پس از احراز هویت، حساب شما را به پرونده صحیح ورزشکار، مربی یا داور متصل کند.</p>
          </section>
        )}

        {payload?.profiles?.map((profile, index) => (
          <section className="panel grid gap-4" key={profile.tenant_id + profile.type + index}>
            {profile.type === "athlete" ? (
              <>
                <div className="section-heading-row">
                  <div>
                    <span className="role-chip">{roleName(profile.type)}</span>
                    <h2 className="section-title">{profile.member.full_name}</h2>
                    <p className="muted">{profile.member.sport_type || "رشته ثبت نشده"}</p>
                  </div>
                  <div className="personal-code">
                    <small>کد شناسایی شخصی</small>
                    <strong>{profile.identity?.personal_code || "در انتظار تخصیص"}</strong>
                  </div>
                </div>
                <div className="stats">
                  <article className="stat"><span className="muted">وضعیت پرونده</span><strong>{statusName(profile.member.status)}</strong></article>
                  <article className="stat"><span className="muted">شماره عضویت</span><strong>{profile.identity?.membership_number || "—"}</strong></article>
                  <article className="stat"><span className="muted">رده ورزشی</span><strong>{profile.identity?.athlete_category || "—"}</strong></article>
                </div>
                <div>
                  <h3 className="section-title">نتایج تأییدشده</h3>
                  {profile.results.length === 0 ? <p className="muted">نتیجه تأییدشده‌ای ثبت نشده است.</p> : (
                    <ul className="list">{profile.results.map((result) => (
                      <li key={result.id}>
                        <strong>{result.event?.title || "رویداد"}</strong>
                        <span className="muted"> — امتیاز: {result.score ?? "—"} — رتبه: {result.rank ?? "—"} — {date(result.created_at)}</span>
                      </li>
                    ))}</ul>
                  )}
                </div>
                <div className="portal-columns">
                  <div>
                    <h3 className="section-title">عضویت</h3>
                    {profile.memberships.length === 0 ? <p className="muted">اطلاعات عضویت ثبت نشده است.</p> : profile.memberships.map((item, i) => (
                      <p key={i}>{statusName(item.status)} — از {date(item.start_date)} تا {date(item.end_date)}</p>
                    ))}
                  </div>
                  <div>
                    <h3 className="section-title">بیمه ورزشی</h3>
                    {profile.insurance.length === 0 ? <p className="muted">اطلاعات بیمه ثبت نشده است.</p> : profile.insurance.map((item, i) => (
                      <p key={i}>{item.provider_name} — {statusName(item.status)} — پایان اعتبار: {date(item.coverage_end)}</p>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="section-title">ثبت‌نام مسابقات</h3>
                  {profile.registrations.length === 0 ? <p className="muted">ثبت‌نامی در مسابقات ثبت نشده است.</p> : (
                    <ul className="list">{profile.registrations.map((item, i) => (
                      <li key={i}>{item.event?.title || "رویداد"} — {statusName(item.status)} — {date(item.registered_at)}</li>
                    ))}</ul>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="section-heading-row">
                  <div>
                    <span className="role-chip">{roleName(profile.type)}</span>
                    <h2 className="section-title">{profile.identity.display_name}</h2>
                    <p className="muted">{profile.identity.credential_title || "پرونده حرفه‌ای"}</p>
                  </div>
                  <div className="personal-code">
                    <small>کد شناسایی شخصی</small>
                    <strong>{profile.identity.personal_code}</strong>
                  </div>
                </div>
                <div className="stats">
                  <article className="stat"><span className="muted">وضعیت فعالیت</span><strong>{statusName(profile.identity.status)}</strong></article>
                  <article className="stat"><span className="muted">درجه / سطح</span><strong>{profile.identity.credential_level || "—"}</strong></article>
                  <article className="stat"><span className="muted">اعتبار مدرک تا</span><strong>{date(profile.identity.credential_expires_on)}</strong></article>
                </div>
                {profile.type === "coach" && (
                  <div>
                    <h3 className="section-title">برنامه‌های رشد تحت مسئولیت من</h3>
                    {profile.development_plans.length === 0 ? <p className="muted">برنامه‌ای به این حساب تخصیص داده نشده است.</p> : (
                      <ul className="list">{profile.development_plans.map((plan) => (
                        <li key={plan.id}>{plan.title} — {statusName(plan.status)} — بازبینی: {date(plan.review_date)}</li>
                      ))}</ul>
                    )}
                  </div>
                )}
                {profile.type === "referee" && (
                  <div>
                    <h3 className="section-title">مأموریت‌های داوری من</h3>
                    {profile.assignments.length === 0 ? <p className="muted">مأموریتی برای این حساب ثبت نشده است.</p> : (
                      <ul className="list">{profile.assignments.map((item) => (
                        <li key={item.id}>{item.event?.title || "رویداد"} — {statusName(item.status)} — {date(item.assigned_at)}</li>
                      ))}</ul>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        ))}
        <p className="muted">کد شخصی فقط شناسه پرونده است و جایگزین ورود امن یا احراز هویت نمی‌شود.</p>
      </main>
    </>
  );
}
