import { initPageChrome } from "./shared/page.js";

const teardown = initPageChrome();

const form = document.querySelector("[data-register-form]");

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
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!name || !email || password.length < 8) {
      status.hidden = false;
      status.textContent =
        "Please provide name, email and a password with at least 8 characters.";
      status.className = "form__status form__status--error";
      return;
    }

    status.hidden = false;
    status.textContent = "Account created! You can now log in.";
    status.className = "form__status form__status--success";
  });
}

window.addEventListener("unload", () => {
  if (typeof teardown === "function") {
    teardown();
  }
});
