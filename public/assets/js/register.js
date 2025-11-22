/* eslint-env browser */

import {
  emitAuthChanged,
  getProfile,
  loginUser,
  registerUser,
  setStoredAuth,
} from "./shared/api.js";
import { setBaseCredits } from "./shared/credits.js";
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
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (!name || !email || password.length < 8) {
      status.hidden = false;
      status.textContent =
        "Provide a name, Noroff email, and a password with at least 8 characters.";
      status.className = formStatusClasses.error;
      return;
    }

    if (password !== confirmPassword) {
      status.hidden = false;
      status.textContent = "Passwords must match.";
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
      status.textContent = "Creating your account...";
      status.className = formStatusClasses.info;

      await registerUser({
        name,
        email,
        password,
      });

      status.textContent = "Account created! Signing you in...";
      status.className = formStatusClasses.info;

      const loginResponse = await loginUser({ email, password });
      const auth = loginResponse?.data;

      if (!auth?.accessToken) {
        throw new Error("Registration succeeded but login failed.");
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
          setBaseCredits(credits, { reason: "Synced after registration" });
        }
      } catch (profileError) {
        console.warn(
          "Unable to fetch profile after registration",
          profileError,
        );
      }

      status.textContent = "All set! Redirecting to home...";
      status.className = formStatusClasses.success;
      window.setTimeout(() => {
        window.location.href = "./index.html";
      }, 600);
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
