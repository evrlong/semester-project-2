/* eslint-env browser */

import { createListing, getStoredAuth } from "./shared/api.js";
import { initPageChrome } from "./shared/page.js";

const teardown = initPageChrome();

const form = document.querySelector("[data-create-listing-form]");
const statusElement = document.querySelector("[data-form-status]");
const endsAtInput = document.querySelector("#listing-endsAt");
const addMediaButton = document.querySelector("[data-add-media]");
const mediaList = document.querySelector("[data-media-list]");
const mediaTemplate = document.querySelector("[data-media-template]");
const submitButton = document.querySelector("[data-submit-button]");

const MAX_MEDIA_ITEMS = 5;

const formStatusClasses = {
  info: "rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600",
  warning:
    "rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700",
  error:
    "rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700",
  success:
    "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700",
};

const setStatus = (message, tone = "info", { allowHTML = false } = {}) => {
  if (!statusElement) {
    return;
  }

  if (!message) {
    statusElement.hidden = true;
    statusElement.textContent = "";
    statusElement.removeAttribute("data-tone");
    statusElement.className = formStatusClasses.info;
    return;
  }

  const toneKey = formStatusClasses[tone] ? tone : "info";
  statusElement.hidden = false;
  statusElement.className = formStatusClasses[toneKey];
  statusElement.setAttribute("data-tone", toneKey);
  if (allowHTML) {
    statusElement.innerHTML = message;
  } else {
    statusElement.textContent = message;
  }
};

const getLocalDateTimeValue = (date) => {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
};

const updateMediaControls = () => {
  if (!mediaList) {
    return;
  }

  const items = Array.from(mediaList.querySelectorAll("[data-media-item]"));
  const count = items.length;

  if (addMediaButton) {
    addMediaButton.disabled = count >= MAX_MEDIA_ITEMS;
  }

  items.forEach((item, index) => {
    const removeButton = item.querySelector("[data-remove-media]");
    if (!removeButton) {
      return;
    }

    removeButton.disabled = count === 1 || index === 0;
  });
};

const addMediaItem = () => {
  if (!mediaList || !mediaTemplate) {
    return;
  }

  const currentCount = mediaList.querySelectorAll("[data-media-item]").length;
  if (currentCount >= MAX_MEDIA_ITEMS) {
    return;
  }

  const fragment = mediaTemplate.content.cloneNode(true);
  mediaList.append(fragment);
  updateMediaControls();
};

const removeMediaItem = (button) => {
  if (!mediaList) {
    return;
  }

  const item = button.closest("[data-media-item]");
  if (!item) {
    return;
  }

  item.remove();
  updateMediaControls();
};

const setFormDisabled = (disabled) => {
  if (!form) {
    return;
  }

  const controls = Array.from(
    form.querySelectorAll(
      "input, textarea, button[type='submit'], button[data-add-media], button[data-remove-media]",
    ),
  );

  controls.forEach((control) => {
    control.disabled = disabled;
  });

  if (!disabled) {
    updateMediaControls();
  }
};

const ensureAuthState = () => {
  const auth = getStoredAuth();
  if (!auth?.accessToken) {
    setFormDisabled(true);
    setStatus(
      'Sign in to create a listing. <a class="font-semibold text-indigo-600 hover:underline" href="./login.html">Log in</a>',
      "warning",
      { allowHTML: true },
    );
    return;
  }

  setFormDisabled(false);
  setStatus("");
};

if (addMediaButton) {
  addMediaButton.addEventListener("click", () => {
    addMediaItem();
  });
}

mediaList?.addEventListener("click", (event) => {
  const target = event.target;
  if (!target || typeof target.closest !== "function") {
    return;
  }

  const button = target.closest("[data-remove-media]");
  if (button) {
    removeMediaItem(button);
  }
});

if (endsAtInput) {
  const nowPlusHour = new Date(Date.now() + 60 * 60 * 1000);
  const defaultValue = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const minValue = getLocalDateTimeValue(nowPlusHour);
  endsAtInput.min = minValue;
  endsAtInput.value = getLocalDateTimeValue(defaultValue);
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (form.dataset.submitting === "true") {
    return;
  }

  const auth = getStoredAuth();
  if (!auth?.accessToken) {
    ensureAuthState();
    setStatus("You must be logged in to create a listing.", "error");
    return;
  }

  const formData = new FormData(form);
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const endsAtRaw = String(formData.get("endsAt") ?? "").trim();
  const tagsRaw = String(formData.get("tags") ?? "").trim();

  if (title.length < 3) {
    setStatus("Add a title with at least 3 characters.", "error");
    return;
  }

  const endsAtDate = endsAtRaw ? new Date(endsAtRaw) : null;
  if (!endsAtDate || Number.isNaN(endsAtDate.getTime())) {
    setStatus("Choose a valid auction end date and time.", "error");
    return;
  }

  const now = new Date();
  if (endsAtDate.getTime() - now.getTime() < 60 * 60 * 1000) {
    setStatus("Your auction must end at least 1 hour from now.", "error");
    return;
  }

  const tags = tagsRaw
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag, index, array) => tag && array.indexOf(tag) === index)
    .slice(0, 8);

  const mediaItems = Array.from(
    mediaList?.querySelectorAll("[data-media-item]") ?? [],
  );

  const media = [];
  for (const item of mediaItems) {
    const urlInput = item.querySelector("[data-media-url]");
    const altInput = item.querySelector("[data-media-alt]");
    const urlValue = urlInput?.value.trim();
    const altValue = altInput?.value.trim();

    if (!urlValue) {
      continue;
    }

    try {
      // Throws if the URL is not absolute

      new URL(urlValue);
    } catch {
      setStatus(
        "Enter a valid, absolute image URL (including https://).",
        "error",
      );
      return;
    }

    media.push({
      url: urlValue,
      alt: altValue || undefined,
    });
  }

  const payload = {
    title,
    endsAt: endsAtDate.toISOString(),
  };

  if (description) {
    payload.description = description;
  }

  if (tags.length) {
    payload.tags = tags;
  }

  if (media.length) {
    payload.media = media;
  }

  try {
    form.dataset.submitting = "true";
    if (submitButton) {
      submitButton.disabled = true;
    }
    setStatus("Publishing your listing\u2026", "info");

    const response = await createListing(payload);
    const listing = response?.data ?? response;

    if (!listing?.id) {
      throw new Error(
        "We created the listing but couldn't confirm its details.",
      );
    }

    setStatus("Listing created! Redirecting\u2026", "success");

    window.setTimeout(() => {
      const target = new URL("./listing.html", window.location.href);
      target.searchParams.set("id", listing.id);
      window.location.href = `${target.pathname}${target.search}`;
    }, 900);
  } catch (error) {
    console.error(error);
    setStatus(
      error.message ||
        "We couldn't create your listing right now. Please try again.",
      "error",
    );
  } finally {
    delete form.dataset.submitting;
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
});

ensureAuthState();
updateMediaControls();

window.addEventListener("auth:changed", ensureAuthState);

const handlePageHide = () => {
  window.removeEventListener("auth:changed", ensureAuthState);
  if (typeof teardown === "function") {
    teardown();
  }
};

window.addEventListener("pagehide", handlePageHide, { once: true });
