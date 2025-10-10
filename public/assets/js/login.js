/* eslint-env browser */

import {
  emitAuthChanged,
  getProfile,
  loginUser,
  setStoredAuth,
} from "./shared/api.js";
import { initPageChrome } from "./shared/page.js";

const teardown = initPageChrome();

const form = document.querySelector("[data-auth-form]");

const createStatusElement = () => {
  const status = document.createElement("p");
  status.className = "form__status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.hidden = true;
  return status;
};

if (form) {
  const status = createStatusElement();
  form.append(status);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (form.dataset.submitting === "true") {
      return;
    }

    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "").trim();

    if (!email || !password) {
      status.hidden = false;
      status.textContent = "Enter both your email and password.";
      status.className = "form__status form__status--error";
      return;
    }

    try {
      form.dataset.submitting = "true";
      status.hidden = false;
      status.textContent = "Signing you in…";
      status.className = "form__status";

      const response = await loginUser({ email, password });
      const auth = response?.data;

      if (!auth?.accessToken) {
        throw new Error("Login failed. Please try again.");
      }

      setStoredAuth(auth);
      emitAuthChanged();

      try {
        const profileResponse = await getProfile(auth.name, {});
        const profile = profileResponse?.data;
        if (profile) {
          const creditValue = Number(profile.credits ?? auth.credits ?? 0);
          const credits = Number.isFinite(creditValue)
            ? creditValue
            : auth.credits;
          setStoredAuth({ ...auth, credits });
          emitAuthChanged();
        }
      } catch (profileError) {
        console.warn("Unable to fetch profile after login", profileError);
      }

      status.textContent = "Signed in successfully. Redirecting…";
      status.className = "form__status form__status--success";

      window.setTimeout(() => {
        const url = new URL("./profile.html", window.location.origin);
        if (auth.name) {
          url.searchParams.set("name", auth.name);
        }
        window.location.href = `${url.pathname}${url.search}`;
      }, 800);
    } catch (error) {
      console.error(error);
      status.hidden = false;
      status.textContent = error.message || "Login failed. Please try again.";
      status.className = "form__status form__status--error";
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
