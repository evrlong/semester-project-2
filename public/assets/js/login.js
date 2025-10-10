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
      status.className = formStatusClasses.error;
      return;
    }

    try {
      form.dataset.submitting = "true";
      status.hidden = false;
      status.textContent = "Signing you in…";
      status.className = formStatusClasses.info;

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
      status.className = formStatusClasses.success;

      window.setTimeout(() => {
        const url = new URL("./profile.html", window.location.href);
        if (auth.name) {
          url.searchParams.set("name", auth.name);
        }
        window.location.href = `${url.pathname}${url.search}`;
      }, 800);
    } catch (error) {
      console.error(error);
      status.hidden = false;
      status.textContent = error.message || "Login failed. Please try again.";
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
