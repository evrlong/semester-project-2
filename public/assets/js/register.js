/* eslint-env browser */

import { registerUser } from "./shared/api.js";
import { initPageChrome } from "./shared/page.js";

const teardown = initPageChrome();

const form = document.querySelector("[data-register-form]");

const formStatusClasses = {
  info: "mt-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600",
  error:
    "mt-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700",
  success:
    "mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700",
};

const createStatusElement = () => {
  const status = document.createElement("p");
  status.className = formStatusClasses.info;
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.hidden = true;
  return status;
};

const isValidNoroffEmail = (email) => /@(?:stud\.)?noroff\.no$/i.test(email);

if (form) {
  const status = createStatusElement();
  form.append(status);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (form.dataset.submitting === "true") {
      return;
    }

    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const venueManager = formData.get("venueManager") === "on";

    if (!name || !email || password.length < 8) {
      status.hidden = false;
      status.textContent =
        "Provide a name, Noroff email, and a password with at least 8 characters.";
      status.className = formStatusClasses.error;
      return;
    }

    if (!isValidNoroffEmail(email)) {
      status.hidden = false;
      status.textContent =
        "Use your @stud.noroff.no or @noroff.no email address.";
      status.className = formStatusClasses.error;
      return;
    }

    try {
      form.dataset.submitting = "true";
      status.hidden = false;
      status.textContent = "Creating your account…";
      status.className = formStatusClasses.info;

      await registerUser({
        name,
        email,
        password,
        venueManager,
      });

      status.textContent = "Account created! You can now log in.";
      status.className = formStatusClasses.success;
      form.reset();
    } catch (error) {
      console.error(error);
      status.hidden = false;
      status.textContent =
        error.message || "Registration failed. Please try again.";
      status.className = formStatusClasses.error;
    } finally {
      form.dataset.submitting = "false";
    }
  });
}

window.addEventListener("unload", () => {
  if (typeof teardown === "function") {
    teardown();
  }
});
