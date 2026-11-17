"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        // Development diagnostics: preserve the original Supabase error in the browser console.
        console.error("[METATYA AUTH] signInWithPassword failed:", {
          message: error.message,
          name: error.name,
          status: error.status,
          code: error.code,
          error,
        });
        setMessage("ورود انجام نشد. جزئیات خطا در کنسول مرورگر ثبت شده است.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch (caughtError) {
      // Also expose client initialization, configuration, and unexpected runtime errors.
      console.error("[METATYA AUTH] Login flow threw an exception:", caughtError);
      setMessage("فرایند ورود با خطا متوقف شد. جزئیات در کنسول مرورگر ثبت شده است.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-wrap">
      <section className="panel auth-card">
        <h1 className="page-heading">ورود به METATYA Sports OS</h1>
        <p className="muted">با حساب کاربری تأییدشده سازمان خود وارد شوید.</p>
        <form className="grid" onSubmit={submit}>
          <div className="field">
            <label htmlFor="email">ایمیل</label>
            <input id="email" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password">رمز عبور</label>
            <input id="password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} />
          </div>
          <button className="btn" disabled={busy}>{busy ? "در حال ورود..." : "ورود"}</button>
        </form>
        {message && <p className="status error" role="alert">{message}</p>}
      </section>
    </main>
  );
}
