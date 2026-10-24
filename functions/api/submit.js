export async function onRequestPost(context) {
  try {
    const formData = await context.request.formData();
    const data = Object.fromEntries(formData.entries());
    
    // ⚠️ این دو خط رو با اطلاعات خودت جایگزین کن
    const BOT_TOKEN = "8904228391:AAHjV_bPYOehcDVo8nkgdzAPyiGWM2JElbc";
    const CHAT_ID = "8904228391";
    
    let message = `🚨 *ثبت‌نام جدید در سایت* 🚨\n\n`;
    for (const [key, value] of Object.entries(data)) {
      message += `▪️ *${key}:* ${value}\n`;
    }

    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const tgResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    const tgResult = await tgResponse.json();

    // اگر تلگرام ارور داد، ارور رو به ما نشون بده
    if (!tgResult.ok) {
        return new Response(JSON.stringify({ 
            success: false, 
            message: "خطا در تلگرام", 
            telegram_error: tgResult 
        }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    }

    return new Response(JSON.stringify({ success: true, message: "ثبت‌نام با موفقیت انجام شد." }), {
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
