(() => {
  "use strict";
  const select = document.querySelector("#tenantSelect");
  const card = document.querySelector("#tenantCard");
  const dialog = document.querySelector("#adminDialog");
  const openers = [document.querySelector("#adminOpen"), document.querySelector("#adminOpen2")];
  const close = document.querySelector("#adminClose");

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

  openers.filter(Boolean).forEach((button) => button.addEventListener("click", () => dialog.showModal()));
  close?.addEventListener("click", () => dialog.close());
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
})();
