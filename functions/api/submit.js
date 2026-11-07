export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const BOT_TOKEN = env.BOT_TOKEN;
    const CHAT_ID = env.CHAT_ID;

    if (!BOT_TOKEN || !CHAT_ID) {
      return new Response(JSON.stringify({
        success: false,
        message: "تنظیمات امن ارسال فرم روی سرور کامل نیست."
      }), {
        status: 503,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    const formData = await request.formData();
    const data = Object.fromEntries(formData.entries());

    let message = "ثبت‌نام جدید در سایت هیأت تیراندازی ایلام\n\n";
    for (const [key, value] of Object.entries(data)) {
      message += "• " + String(key).slice(0, 100) + ": " + String(value).slice(0, 1000) + "\n";
    }

    const tgResponse = await fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text: message })
    });

    const tgResult = await tgResponse.json();

    if (!tgResponse.ok || !tgResult.ok) {
      return new Response(JSON.stringify({
        success: false,
        message: "ارسال درخواست به مقصد انجام نشد."
      }), {
        status: 502,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: "درخواست دریافت شد."
    }), {
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  } catch (_error) {
    return new Response(JSON.stringify({
      success: false,
      message: "خطای داخلی هنگام دریافت درخواست."
    }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }
}
