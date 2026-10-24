export async function onRequestPost(context) {
  try {
    const formData = await context.request.formData();
    const data = Object.fromEntries(formData.entries());
    
    // فعلا اطلاعات رو در لاگ کلادفلر ذخیره می‌کنیم
    console.log("اطلاعات جدید ثبت شد:", data);

    // اینجا می‌تونیم بعدا کد ارسال ایمیل یا دیتابیس رو اضافه کنیم
    
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
