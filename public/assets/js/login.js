import { initPageChrome } from "./shared/page.js";

const teardown = initPageChrome();

const form = document.querySelector("[data-auth-form]");

if (form) {
  const status = document.createElement("p");
  status.className = "form__status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.hidden = true;
  form.append(status);

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      status.hidden = false;
      status.textContent = "Enter both your email and password.";
      status.className = "form__status form__status--error";
      return;
    }

    status.hidden = false;
    status.textContent = "Signing you in…";
    status.className = "form__status form__status--success";
  });
}

window.addEventListener("unload", () => {
  if (typeof teardown === "function") {
    teardown();
  }
});
