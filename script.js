document.addEventListener("DOMContentLoaded", () => {
  const forms = document.querySelectorAll("form");
  
  forms.forEach(form => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault(); // جلوگیری از رفرش شدن صفحه
      
      const submitBtn = form.querySelector(".btn-submit");
      const originalText = submitBtn.innerText;
      submitBtn.innerText = "در حال ارسال...";
      submitBtn.disabled = true;

      const formData = new FormData(form);

      try {
        const response = await fetch("/api/submit", {
          method: "POST",
          body: formData
        });

        if (response.ok) {
          alert("✅ درخواست شما با موفقیت ثبت شد. کارشناسان ما به‌زودی با شما تماس می‌گیرند.");
          form.reset(); // پاک کردن فرم
        } else {
          alert("❌ متاسفانه خطایی رخ داد. لطفاً دوباره تلاش کنید.");
        }
      } catch (error) {
        alert("❌ خطا در ارتباط با سرور.");
      } finally {
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
      }
    });
  });
});

'use strict';
const menuButton = document.querySelector('.menu-button');
const navigation = document.querySelector('#navigation');

menuButton.addEventListener('click', () => {
  const opened = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!opened));
  navigation.classList.toggle('open', !opened);
  menuButton.setAttribute('aria-label', opened ? 'باز کردن فهرست' : 'بستن فهرست');
});

navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  navigation.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'باز کردن فهرست');
}));
