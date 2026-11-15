export async function onRequestPost() {
  return new Response(JSON.stringify({
    success: false,
    code: "FORM_SUBMISSIONS_DISABLED",
    message: "ارسال فرم از این مسیر غیرفعال است. این پایگاه فقط برای اطلاع‌رسانی عمومی و امور اداری خنثی استفاده می‌شود."
  }), {
    status: 410,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
