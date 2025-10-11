/* eslint-env browser */

import {
  getListing,
  getStoredAuth,
  updateListing,
  deleteListing,
} from "./shared/api.js";
import { initPageChrome } from "./shared/page.js";

const teardown = initPageChrome();

const form = document.querySelector("[data-edit-listing-form]");
const statusElement = document.querySelector("[data-form-status]");
const titleInput = document.querySelector("#listing-title");
const descriptionInput = document.querySelector("#listing-description");
const endsAtInput = document.querySelector("#listing-endsAt");
const tagsInput = document.querySelector("#listing-tags");
const addMediaButton = document.querySelector("[data-add-media]");
const mediaList = document.querySelector("[data-media-list]");
const mediaTemplate = document.querySelector("[data-media-template]");
const submitButton = document.querySelector("[data-submit-button]");
const deleteButton = document.querySelector("[data-delete-listing]");
const cancelLink = document.querySelector("[data-cancel-edit]");

const params = new URLSearchParams(window.location.search);
const listingId = params.get("id");

const MAX_MEDIA_ITEMS = 5;
const MIN_END_OFFSET_MS = 60 * 60 * 1000;

const formStatusClasses = {
  info: "rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600",
  warning:
    "rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700",
  error:
    "rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700",
  success:
    "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700",
};

let currentListing;
let activeAuth = getStoredAuth();

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

    removeButton.disabled =
      count === 1 && !items.some((entry, i) => i !== index);
    if (index === 0 && count === 1) {
      removeButton.disabled = true;
    }
  });
};

const createMediaElement = () => {
  if (!mediaTemplate?.content) {
    return undefined;
  }

  const element = mediaTemplate.content.firstElementChild;
  if (!element) {
    return undefined;
  }

  return element.cloneNode(true);
};

const addMediaItem = (values = {}) => {
  if (!mediaList) {
    return undefined;
  }

  const currentCount = mediaList.querySelectorAll("[data-media-item]").length;
  if (currentCount >= MAX_MEDIA_ITEMS) {
    return undefined;
  }

  const item = createMediaElement();
  if (!item) {
    return undefined;
  }

  const urlInput = item.querySelector("[data-media-url]");
  const altInput = item.querySelector("[data-media-alt]");

  if (urlInput && typeof values.url === "string") {
    urlInput.value = values.url;
  }
  if (altInput && typeof values.alt === "string") {
    altInput.value = values.alt;
  }

  mediaList.append(item);
  updateMediaControls();
  return item;
};

const clearMediaList = () => {
  if (!mediaList) {
    return;
  }

  mediaList.innerHTML = "";
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
  if (!mediaList.querySelector("[data-media-item]")) {
    addMediaItem();
  }
  updateMediaControls();
};

const setDeleteButtonVisible = (visible) => {
  if (!deleteButton) {
    return;
  }

  deleteButton.hidden = !visible;
  deleteButton.disabled = !visible;
};

setDeleteButtonVisible(false);

const setFormDisabled = (disabled) => {
  if (!form) {
    return;
  }

  const controls = Array.from(
    form.querySelectorAll(
      "input, textarea, button[type='submit'], button[data-add-media], button[data-remove-media], button[data-delete-listing]",
    ),
  );

  controls.forEach((control) => {
    if (deleteButton && control === deleteButton && deleteButton.hidden) {
      control.disabled = true;
      return;
    }

    control.disabled = disabled;
  });

  if (!disabled) {
    updateMediaControls();
  }
};

const ensureAuthState = () => {
  activeAuth = getStoredAuth();

  if (!activeAuth?.accessToken) {
    setFormDisabled(true);
    setDeleteButtonVisible(false);
    setStatus(
      'Sign in to edit this listing. <a class="font-semibold text-indigo-600 hover:underline" href="./login.html">Log in</a>',
      "warning",
      { allowHTML: true },
    );
    return false;
  }

  return true;
};

const applyListingToForm = (listing) => {
  if (!listing) {
    return;
  }

  if (titleInput) {
    titleInput.value = listing.title || "";
  }

  if (descriptionInput) {
    descriptionInput.value = listing.description || "";
  }

  if (tagsInput) {
    const tags = Array.isArray(listing.tags) ? listing.tags : [];
    tagsInput.value = tags.join(", ");
  }

  if (endsAtInput) {
    const minimumDate = new Date(Date.now() + MIN_END_OFFSET_MS);
    const endsAtDate = listing.endsAt ? new Date(listing.endsAt) : null;

    if (endsAtDate && !Number.isNaN(endsAtDate.getTime())) {
      const localValue = getLocalDateTimeValue(endsAtDate);
      endsAtInput.value = localValue;

      const minValue =
        endsAtDate.getTime() < minimumDate.getTime() ? endsAtDate : minimumDate;
      endsAtInput.min = getLocalDateTimeValue(minValue);
    } else {
      endsAtInput.value = "";
      endsAtInput.min = getLocalDateTimeValue(minimumDate);
    }
  }

  if (cancelLink && listing.id) {
    const url = new URL("./listing.html", window.location.href);
    url.searchParams.set("id", listing.id);
    cancelLink.href = `${url.pathname}${url.search}`;
  }

  clearMediaList();
  const media = Array.isArray(listing.media) ? listing.media : [];
  if (media.length) {
    media.forEach((entry) => {
      addMediaItem({
        url: entry?.url || "",
        alt: entry?.alt || "",
      });
    });
  } else {
    addMediaItem();
  }
};

const extractTags = (value) =>
  String(value || "")
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag, index, array) => tag && array.indexOf(tag) === index)
    .slice(0, 8);

const extractMedia = () => {
  if (!mediaList) {
    return [];
  }

  const media = [];
  const items = Array.from(mediaList.querySelectorAll("[data-media-item]"));
  for (const item of items) {
    const urlInput = item.querySelector("[data-media-url]");
    const altInput = item.querySelector("[data-media-alt]");
    const urlValue = urlInput?.value.trim();
    const altValue = altInput?.value.trim();

    if (!urlValue) {
      continue;
    }

    try {
      new URL(urlValue);
    } catch {
      throw new Error("Enter valid, absolute URLs for all images.");
    }

    media.push({
      url: urlValue,
      alt: altValue || undefined,
    });
  }

  return media.slice(0, MAX_MEDIA_ITEMS);
};

const listingBelongsToUser = (listing, auth) =>
  Boolean(listing?.seller?.name) && Boolean(auth?.name)
    ? listing.seller.name === auth.name
    : false;

const loadListing = async () => {
  if (!listingId) {
    setStatus("We couldn't find a listing to edit.", "error");
    setFormDisabled(true);
    return;
  }

  if (!ensureAuthState()) {
    return;
  }

  try {
    setStatus("Loading listing\u2026", "info");
    setFormDisabled(true);
    setDeleteButtonVisible(false);

    const response = await getListing(listingId, { _seller: true });
    const listing = response?.data ?? response;

    if (!listing?.id) {
      throw new Error("Listing not found.");
    }

    if (!listingBelongsToUser(listing, activeAuth)) {
      setStatus("You can only edit your own listings.", "error");
      setFormDisabled(true);
      setDeleteButtonVisible(false);
      return;
    }

    currentListing = listing;
    document.title = `${listing.title} | Edit listing`;
    applyListingToForm(listing);
    setStatus("");
    setDeleteButtonVisible(true);
    setFormDisabled(false);
  } catch (error) {
    console.error(error);
    setStatus(
      error.message ||
        "We couldn't load this listing right now. Please try again.",
      "error",
    );
    setFormDisabled(true);
    setDeleteButtonVisible(false);
  }
};

addMediaButton?.addEventListener("click", () => {
  addMediaItem();
});

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

deleteButton?.addEventListener("click", async () => {
  if (!listingId || !currentListing?.id) {
    return;
  }

  if (!ensureAuthState()) {
    return;
  }

  const confirmed = window.confirm(
    "Delete this listing? Bidders will no longer see it and this can't be undone.",
  );

  if (!confirmed) {
    return;
  }

  try {
    setStatus("Deleting listing\u2026", "info");
    setFormDisabled(true);

    await deleteListing(listingId);

    setStatus("Listing deleted. Redirecting\u2026", "success");

    window.setTimeout(() => {
      if (activeAuth?.name) {
        const url = new URL("./profile.html", window.location.href);
        url.searchParams.set("name", activeAuth.name);
        window.location.href = `${url.pathname}${url.search}`;
      } else {
        window.location.href = "./index.html";
      }
    }, 900);
  } catch (error) {
    console.error(error);
    setStatus(
      error.message ||
        "We couldn't delete this listing right now. Please try again.",
      "error",
    );
    setDeleteButtonVisible(true);
    setFormDisabled(false);
  }
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (form.dataset.submitting === "true") {
    return;
  }

  if (!listingId) {
    setStatus(
      "Listing ID is missing. Please return to the listing and try again.",
      "error",
    );
    return;
  }

  if (!ensureAuthState()) {
    return;
  }

  const title = String(titleInput?.value ?? "").trim();
  const description = String(descriptionInput?.value ?? "").trim();
  const endsAtRaw = String(endsAtInput?.value ?? "").trim();
  const tags = extractTags(tagsInput?.value ?? "");

  if (title.length < 3) {
    setStatus("Add a title with at least 3 characters.", "error");
    return;
  }

  const endsAtDate = endsAtRaw ? new Date(endsAtRaw) : null;
  if (!endsAtDate || Number.isNaN(endsAtDate.getTime())) {
    setStatus("Choose a valid auction end date and time.", "error");
    return;
  }

  const isoEndsAt = endsAtDate.toISOString();
  const unchangedDeadline =
    currentListing?.endsAt &&
    Math.abs(new Date(currentListing.endsAt).getTime() - endsAtDate.getTime()) <
      60 * 1000;

  if (
    !unchangedDeadline &&
    endsAtDate.getTime() - Date.now() < MIN_END_OFFSET_MS
  ) {
    setStatus("Your auction must end at least 1 hour from now.", "error");
    return;
  }

  let media;
  try {
    media = extractMedia();
  } catch (error) {
    setStatus(error.message || "Check your image URLs and try again.", "error");
    return;
  }

  const payload = {
    title,
    description,
    endsAt: isoEndsAt,
    tags,
    media,
  };

  try {
    form.dataset.submitting = "true";
    if (submitButton) {
      submitButton.disabled = true;
    }
    setFormDisabled(true);
    setStatus("Saving changes\u2026", "info");

    const response = await updateListing(listingId, payload);
    const updatedListing = response?.data ?? response;

    setStatus("Listing updated! Redirecting\u2026", "success");

    window.setTimeout(() => {
      const url = new URL("./listing.html", window.location.href);
      url.searchParams.set("id", updatedListing?.id || listingId);
      window.location.href = `${url.pathname}${url.search}`;
    }, 900);
  } catch (error) {
    console.error(error);
    setStatus(
      error.message ||
        "We couldn't update this listing right now. Please try again.",
      "error",
    );
  } finally {
    delete form.dataset.submitting;
    if (submitButton) {
      submitButton.disabled = false;
    }
    setFormDisabled(false);
  }
});

if (!listingId) {
  setStatus(
    "We couldn't find a listing to edit. Return to your listings and try again.",
    "error",
  );
  setFormDisabled(true);
  setDeleteButtonVisible(false);
} else if (ensureAuthState()) {
  loadListing();
}

window.addEventListener("auth:changed", () => {
  if (!listingId) {
    return;
  }

  if (ensureAuthState()) {
    loadListing();
  }
});

window.addEventListener("unload", () => {
  if (typeof teardown === "function") {
    teardown();
  }
});
