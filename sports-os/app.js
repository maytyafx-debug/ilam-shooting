(() => {
  "use strict";
  const select = document.querySelector("#tenantSelect");
  const card = document.querySelector("#tenantCard");
  const dialog = document.querySelector("#adminDialog");
  const openers = [document.querySelector("#adminOpen"), document.querySelector("#adminOpen2")];
  const close = document.querySelector("#adminClose");
  const pricingCards = document.querySelector("#pricingCards");

  const renderTenant = (tenant) => {
    if (!tenant || !card) return;
    card.style.borderRightColor = tenant.accent || "#d8b36c";
    card.querySelector(".tenant-emblem").textContent = tenant.sport.slice(0, 2);
    card.querySelector(".tenant-sport").textContent = tenant.sport.toUpperCase() + " / " + tenant.region;
    card.querySelector("h3").textContent = tenant.name;
    card.querySelector("p").textContent = tenant.description;
    card.querySelector("small").textContent = tenant.scopeNotice;
  };

  fetch("tenants.json")
    .then((response) => {
      if (!response.ok) throw new Error("Tenant config unavailable");
      return response.json();
    })
    .then((data) => {
      document.title = data.platform.name + " | Demo";
      data.tenants.forEach((tenant) => {
        const option = document.createElement("option");
        option.value = tenant.id;
        option.textContent = tenant.sport + " — " + tenant.region;
        select.append(option);
      });
      select.addEventListener("change", () => renderTenant(data.tenants.find((tenant) => tenant.id === select.value)));
      select.value = data.tenants[0].id;
      renderTenant(data.tenants[0]);
    })
    .catch(() => {
      card.querySelector("h3").textContent = "پیکربندی نمونه بارگذاری نشد";
      card.querySelector("p").textContent = "صفحه را از طریق وب‌سرور محلی اجرا کنید.";
    });


  const renderPricing = (config) => {
    if (!pricingCards || !Array.isArray(config.plans)) return;
    pricingCards.replaceChildren();
    config.plans.forEach((plan) => {
      const article = document.createElement("article");
      article.className = "pricing-card" + (plan.recommended ? " recommended" : "");
      const label = document.createElement("span");
      label.className = "pricing-label";
      label.textContent = plan.label;
      const title = document.createElement("h3");
      title.textContent = plan.name;
      const description = document.createElement("p");
      description.className = "pricing-description";
      description.textContent = plan.description;
      const quote = document.createElement("div");
      quote.className = "pricing-quote";
      quote.textContent = "تعرفه پس از برآورد نیاز";
      const list = document.createElement("ul");
      plan.features.forEach((feature) => {
        const item = document.createElement("li");
        item.textContent = feature;
        list.append(item);
      });
      const terms = document.createElement("div");
      terms.className = "term-options";
      plan.termOptions.forEach((term) => {
        const item = document.createElement("span");
        const discount = term.discountPercent ? " · " + (term.months === 12 ? "حدود " : "") + term.discountPercent + "٪ تخفیف" : " · بدون تخفیف";
        item.textContent = (term.months === 3 ? "سه‌ماهه" : term.months === 6 ? "شش‌ماهه" : "سالانه") + discount;
        terms.append(item);
      });
      const setup = document.createElement("small");
      setup.className = "setup-note";
      setup.textContent = plan.customQuote ? "قیمت‌گذاری اختصاصی و قراردادی" : "هزینه راه‌اندازی جداگانه محاسبه می‌شود";
      article.append(label, title, description, quote, list, terms, setup);
      pricingCards.append(article);
    });
  };

  fetch("pricing.json")
    .then((response) => {
      if (!response.ok) throw new Error("Pricing config unavailable");
      return response.json();
    })
    .then(renderPricing)
    .catch(() => {
      if (pricingCards) pricingCards.textContent = "اطلاعات بسته‌های اشتراک در دسترس نیست.";
    });

  openers.filter(Boolean).forEach((button) => button.addEventListener("click", () => dialog.showModal()));
  close?.addEventListener("click", () => dialog.close());
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
})();
