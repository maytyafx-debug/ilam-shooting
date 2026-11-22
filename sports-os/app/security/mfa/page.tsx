"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import "../globals.css";

type Mode = "loading" | "enroll" | "challenge";

export default function SecurityMfaPage() {
  const router = useRouter();
  const started = useRef(false);
  const [mode, setMode] = useState<Mode>("loading");
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let mounted = true;

    async function initialize() {
      const supabase = createSupabaseBrowserClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        router.replace("/login");
        return;
      }

      const tenantResponse = await fetch("/api/core-sports/tenant", { cache: "no-store" });
      const tenantPayload = await tenantResponse.json();
      if (!tenantResponse.ok) {
        router.replace(tenantResponse.status === 401 ? "/login" : "/platform");
        return;
      }

      const tenants = tenantPayload.tenants ?? [];
      const isPrivileged = tenants.some((tenant: { role: string }) =>
        ["owner", "admin"].includes(tenant.role),
      );
      if (!isPrivileged) {
        router.replace("/platform");
        return;
      }

      const { data: assurance, error: assuranceError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) throw assuranceError;
      if (assurance.currentLevel === "aal2") {
        router.replace("/platform");
        return;
      }

      const { data: factors, error: factorsError } =
        await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;

      const verified = factors.totp.find((factor) => factor.status === "verified");
      if (verified) {
        if (!mounted) return;
        setFactorId(verified.id);
        setMode("challenge");
        return;
      }

      // Remove only unfinished TOTP enrollments before creating a fresh setup.
      for (const factor of factors.totp.filter((item) => item.status !== "verified")) {
        const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (removeError) throw removeError;
      }

      const { data: enrollment, error: enrollmentError } =
        await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "METATYA Sports OS Admin",
        });
      if (enrollmentError) throw enrollmentError;
      if (!mounted) return;
      setFactorId(enrollment.id);
      setQrCode(enrollment.totp.qr_code);
      setSecret(enrollment.totp.secret);
      setMode("enroll");
    }

    initialize().catch((caught) => {
      if (mounted) {
        setError(caught instanceof Error ? caught.message : "راه‌اندازی تأیید دومرحله‌ای ناموفق بود.");
        setMode("loading");
      }
    });

    return () => { mounted = false; };
  }, [router]);

  async function verifyFactor() {
    if (!/^\d{6,8}$/.test(code)) {
      setError("کد تأیید باید ۶ تا ۸ رقم باشد.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) throw verifyError;

      await supabase.auth.refreshSession();
      router.replace("/platform");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "کد تأیید پذیرفته نشد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="platform-loading" dir="rtl">
      <section className="platform-panel" style={{ width: "min(560px, 94vw)", padding: 28 }}>
        <span className="eyebrow">METATYA / ACCOUNT SECURITY</span>
        <h1>تأیید دومرحله‌ای مدیران</h1>
        <p>برای دسترسی مدیریتی، نشست حساب باید با عامل دوم تأیید شود. این کنترل در APIهای مدیریتی نیز اعمال می‌شود.</p>

        {mode === "loading" && !error && <p>در حال بررسی وضعیت امنیت حساب…</p>}

        {mode === "enroll" && <>
          <p>کد QR را با برنامه تأییدکننده خود اسکن کنید. کلید پشتیبان را محرمانه نگه دارید و آن را برای هیچ‌کس ارسال نکنید.</p>
          {qrCode && <div style={{ background: "#fff", padding: 14, display: "inline-block", borderRadius: 12 }}>
            <img src={qrCode} alt="کد QR راه‌اندازی تأیید دومرحله‌ای" width={210} height={210} />
          </div>}
          <p><b>کلید راه‌اندازی:</b></p>
          <code style={{ display: "block", overflowWrap: "anywhere", userSelect: "all" }}>{secret}</code>
        </>}

        {mode === "challenge" && <p>کد جاری برنامه تأییدکننده را وارد کنید تا نشست مدیریتی تأیید شود.</p>}

        {(mode === "enroll" || mode === "challenge") && <>
          <label style={{ display: "block", marginTop: 18 }}>
            کد تأیید
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
              maxLength={8}
              placeholder="کد یک‌بارمصرف"
            />
          </label>
          <button onClick={() => void verifyFactor()} disabled={busy || code.length < 6}>
            {busy ? "در حال تأیید…" : mode === "enroll" ? "فعال‌سازی و تأیید" : "تأیید و ورود"}
          </button>
        </>}

        {error && <p role="alert" style={{ color: "#ff8d8d" }}>{error}</p>}
      </section>
    </main>
  );
}
