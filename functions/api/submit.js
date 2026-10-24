export async function onRequestPost(context) {
  try {
    const formData = await context.request.formData();
    const data = Object.fromEntries(formData.entries());
    
    // --- تنظیمات تلگرام ---
    const BOT_TOKEN = "AAHjV_bPYOehcDVo8nkgdzAPyiGWM2JElbc";
    const CHAT_ID = "8904228391";
    
    // ساختن متن پیام
    let message = `🚨 *ثبت‌نام جدید در سایت هیأت* 🚨\n\n`;
    for (const [key, value] of Object.entries(data)) {
      message += `▪️ *${key}:* ${value}\n`;
    }

    // ارسال به تلگرام
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    return new Response(JSON.stringify({ success: true, message: "ثبت‌نام با موفقیت انجام شد." }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: "خطا در ثبت اطلاعات" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
