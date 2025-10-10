/* eslint-env browser */

import {
  createListing,
  emitAuthChanged,
  getProfile,
  getStoredAuth,
  setStoredAuth,
  updateProfile,
} from "./shared/api.js";
import { fallbackProfile } from "./shared/data.js";
import { formatDate, initPageChrome, renderCount } from "./shared/page.js";

const teardown = initPageChrome();

const nameElements = document.querySelectorAll("[data-profile-name]");
const emailElements = document.querySelectorAll("[data-profile-email]");
const creditElements = document.querySelectorAll("[data-profile-credits]");
const listingCountElements = document.querySelectorAll(
  "[data-profile-listing-count]",
);
const winCountElements = document.querySelectorAll("[data-profile-win-count]");
const listingsContainer = document.querySelector("[data-profile-listings]");
const winsContainer = document.querySelector("[data-profile-wins]");
const statusElement = document.querySelector("[data-profile-status]");
const manageSection = document.querySelector("[data-profile-manage]");
const avatarForm = document.querySelector("[data-avatar-form]");
const avatarStatus = document.querySelector("[data-avatar-status]");
const listingForm = document.querySelector("[data-listing-form]");
const listingStatus = document.querySelector("[data-listing-status]");
const mediaFields = document.querySelector("[data-media-fields]");
const addMediaButton = document.querySelector("[data-add-media]");

const MAX_MEDIA_ITEMS = 5;

const params = new URLSearchParams(window.location.search);
let auth = getStoredAuth();
const profileName = params.get("name") || auth?.name || "";

const setStatus = (message, tone = "info") => {
  if (!statusElement) {
    return;
  }

  statusElement.textContent = message;
  if (!message) {
    statusElement.hidden = true;
    delete statusElement.dataset.tone;
    return;
  }

  statusElement.hidden = false;
  statusElement.dataset.tone = tone;
};

const assignText = (elements, value) => {
  if (!elements) {
    return;
  }

  const text = value ?? "";

  if (typeof elements.forEach === "function" && !elements.nodeType) {
    elements.forEach((element) => {
      element.textContent = text;
    });
    return;
  }

  if (elements) {
    elements.textContent = text;
  }
};

const setFormStatus = (element, message, tone = "info") => {
  if (!element) {
    return;
  }

  element.textContent = message;
  if (!message) {
    element.hidden = true;
    delete element.dataset.tone;
    return;
  }

  element.hidden = false;
  element.dataset.tone = tone;
};

const createMediaRow = (index) => {
  const row = document.createElement("div");
  row.className = "form__media-row";
  row.dataset.mediaRow = String(index);

  const urlLabel = document.createElement("label");
  urlLabel.innerHTML = `<span>Image URL ${index}</span>`;
  const urlInput = document.createElement("input");
  urlInput.type = "url";
  urlInput.name = `mediaUrl${index}`;
  urlInput.placeholder = "https://img.service.com/photo.jpg";
  urlInput.required = index === 1;
  urlInput.dataset.mediaUrl = "";
  urlLabel.append(urlInput);

  const altLabel = document.createElement("label");
  altLabel.innerHTML = `<span>Alt text ${index}</span>`;
  const altInput = document.createElement("input");
  altInput.type = "text";
  altInput.name = `mediaAlt${index}`;
  altInput.placeholder = "Describe this image";
  altInput.dataset.mediaAlt = "";
  altLabel.append(altInput);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "form__remove-button";
  removeButton.dataset.removeMedia = "";
  removeButton.textContent = "Remove image";
  removeButton.hidden = index === 1;

  row.append(urlLabel, altLabel, removeButton);
  return row;
};

const syncMediaRows = () => {
  if (!mediaFields) {
    return;
  }

  const rows = Array.from(mediaFields.querySelectorAll("[data-media-row]"));
  rows.forEach((row, index) => {
    const position = index + 1;
    row.dataset.mediaRow = String(position);

    const spans = row.querySelectorAll("label span");
    if (spans[0]) {
      spans[0].textContent = `Image URL ${position}`;
    }
    if (spans[1]) {
      spans[1].textContent = `Alt text ${position}`;
    }

    const urlInput = row.querySelector("[data-media-url]");
    if (urlInput) {
      urlInput.name = `mediaUrl${position}`;
      urlInput.required = position === 1;
    }

    const altInput = row.querySelector("[data-media-alt]");
    if (altInput) {
      altInput.name = `mediaAlt${position}`;
    }

    const removeButton = row.querySelector("[data-remove-media]");
    if (removeButton) {
      removeButton.hidden = position === 1;
    }
  });
};

const ensureMediaRows = () => {
  if (!mediaFields) {
    return;
  }

  if (!mediaFields.querySelector("[data-media-row]")) {
    mediaFields.append(createMediaRow(1));
  }

  syncMediaRows();
};

const resetMediaRows = () => {
  if (!mediaFields) {
    return;
  }

  const rows = Array.from(mediaFields.querySelectorAll("[data-media-row]"));
  rows.forEach((row, index) => {
    const urlInput = row.querySelector("[data-media-url]");
    const altInput = row.querySelector("[data-media-alt]");
    if (index === 0) {
      if (urlInput) {
        urlInput.value = "";
      }
      if (altInput) {
        altInput.value = "";
      }
    } else {
      row.remove();
    }
  });

  ensureMediaRows();
};

ensureMediaRows();

const createListingItem = (listing) => {
  const item = document.createElement("li");
  item.className = "listing-card";

  const media = listing.media?.[0];
  if (media?.url) {
    const figure = document.createElement("figure");
    figure.className = "listing-card__media";

    const image = document.createElement("img");
    image.src = media.url;
    image.alt = media.alt || listing.title;
    figure.append(image);

    item.append(figure);
  }

  const content = document.createElement("div");
  content.className = "listing-card__body";

  const title = document.createElement("h3");
  title.className = "listing-card__title";
  title.innerHTML = `<a href="./listing.html?id=${encodeURIComponent(listing.id)}">${listing.title}</a>`;
  content.append(title);

  const description = document.createElement("p");
  description.className = "listing-card__description";
  description.textContent = listing.description || "No description provided.";
  content.append(description);

  const meta = document.createElement("div");
  meta.className = "listing-card__meta";
  const bidCount = listing._count?.bids ?? listing.bids?.length ?? 0;
  meta.innerHTML = `
    <span>Ends ${formatDate(listing.endsAt)}</span>
    <span><strong>${bidCount}</strong> bids</span>
  `;
  content.append(meta);

  item.append(content);

  return item;
};

const renderCollection = (container, items, emptyMessage) => {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!items || !items.length) {
    const empty = document.createElement("li");
    empty.className = "listing-card listing-card--empty";
    empty.textContent = emptyMessage;
    container.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach((item) => fragment.append(createListingItem(item)));
  container.append(fragment);
};

const hydrateProfile = (profile, { updateTitle = true } = {}) => {
  if (!profile) {
    return;
  }

  assignText(nameElements, profile.name);
  if (profile.name && updateTitle) {
    document.title = `${profile.name} | Auction House`;
  }
  assignText(emailElements, profile.email);

  const rawCredits = Number(profile.credits ?? 0);
  const credits = Number.isFinite(rawCredits) ? rawCredits : 0;
  const formattedCredits = new Intl.NumberFormat().format(credits);
  assignText(creditElements, `${formattedCredits} credits`);

  const listingCount =
    profile._count?.listings ?? profile.listings?.length ?? 0;
  const winCount = profile._count?.wins ?? profile.wins?.length ?? 0;

  renderCount(listingCountElements, listingCount);
  renderCount(winCountElements, winCount);

  renderCollection(
    listingsContainer,
    profile.listings,
    "No active listings yet.",
  );
  renderCollection(winsContainer, profile.wins, "No wins yet.");

  const storedAuth = getStoredAuth();
  const isOwnProfile =
    storedAuth?.name && profile.name && storedAuth.name === profile.name;

  if (isOwnProfile) {
    const nextAuth = {
      ...storedAuth,
      credits,
      avatar: profile.avatar,
      banner: profile.banner,
    };
    setStoredAuth(nextAuth);
    auth = nextAuth;
    emitAuthChanged();
  }

  if (manageSection) {
    manageSection.hidden = !isOwnProfile;
  }

  if (isOwnProfile && avatarForm) {
    const avatarUrlInput = avatarForm.querySelector('[name="avatarUrl"]');
    const avatarAltInput = avatarForm.querySelector('[name="avatarAlt"]');

    if (avatarUrlInput) {
      avatarUrlInput.value = profile.avatar?.url || "";
    }
    if (avatarAltInput) {
      avatarAltInput.value = profile.avatar?.alt || "";
    }
  }
};

const loadProfile = async ({ showLoading = true } = {}) => {
  auth = getStoredAuth();

  if (!profileName) {
    setStatus("Sign in to view your profile.", "warning");
    hydrateProfile(fallbackProfile, { updateTitle: false });
    return;
  }

  if (showLoading) {
    setStatus("Loading profile…", "info");
  }

  try {
    const response = await getProfile(profileName, {
      _listings: true,
      _wins: true,
    });

    const profile = response?.data;

    if (!profile) {
      throw new Error("Profile not found");
    }

    setStatus("");
    hydrateProfile(profile, { updateTitle: true });
  } catch (error) {
    console.error(error);
    if (!auth?.accessToken) {
      setStatus("Sign in to view your profile.", "warning");
    } else {
      setStatus(
        error.message ||
          "We couldn't load this profile right now. Showing an example instead.",
        "error",
      );
    }
    hydrateProfile(fallbackProfile, { updateTitle: false });
  }
};

if (addMediaButton) {
  addMediaButton.addEventListener("click", (event) => {
    event.preventDefault();

    if (!mediaFields) {
      return;
    }

    const currentCount =
      mediaFields.querySelectorAll("[data-media-row]").length;
    if (currentCount >= MAX_MEDIA_ITEMS) {
      setFormStatus(
        listingStatus,
        `You can add up to ${MAX_MEDIA_ITEMS} images per listing.`,
        "warning",
      );
      return;
    }

    mediaFields.append(createMediaRow(currentCount + 1));
    syncMediaRows();
  });
}

if (mediaFields) {
  mediaFields.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-media]");
    if (!button) {
      return;
    }

    event.preventDefault();

    const rows = Array.from(mediaFields.querySelectorAll("[data-media-row]"));
    if (rows.length <= 1) {
      return;
    }

    button.closest("[data-media-row]")?.remove();
    syncMediaRows();
  });
}

if (avatarForm) {
  avatarForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (avatarForm.dataset.submitting === "true") {
      return;
    }

    const latestAuth = getStoredAuth();
    if (!latestAuth?.accessToken || latestAuth.name !== profileName) {
      setFormStatus(
        avatarStatus,
        "You must be signed in to update your avatar.",
        "error",
      );
      return;
    }

    const formData = new FormData(avatarForm);
    const url = String(formData.get("avatarUrl") ?? "").trim();
    const alt = String(formData.get("avatarAlt") ?? "").trim();

    if (!url) {
      setFormStatus(avatarStatus, "Enter a valid image URL.", "error");
      return;
    }

    try {
      avatarForm.dataset.submitting = "true";
      setFormStatus(avatarStatus, "Saving avatar…", "info");
      await updateProfile(latestAuth.name, {
        avatar: {
          url,
          alt,
        },
      });
      setFormStatus(avatarStatus, "Avatar updated successfully!", "success");
      await loadProfile({ showLoading: false });
    } catch (error) {
      console.error(error);
      setFormStatus(
        avatarStatus,
        error.message || "Unable to update avatar.",
        "error",
      );
    } finally {
      avatarForm.dataset.submitting = "false";
    }
  });
}

if (listingForm) {
  listingForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (listingForm.dataset.submitting === "true") {
      return;
    }

    const latestAuth = getStoredAuth();
    if (!latestAuth?.accessToken || latestAuth.name !== profileName) {
      setFormStatus(
        listingStatus,
        "You must be signed in to create a listing.",
        "error",
      );
      return;
    }

    const formData = new FormData(listingForm);
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const endsAtValue = String(formData.get("endsAt") ?? "").trim();
    const tagsValue = String(formData.get("tags") ?? "").trim();

    if (!title || !description || !endsAtValue) {
      setFormStatus(
        listingStatus,
        "Provide a title, description, and deadline to publish.",
        "error",
      );
      return;
    }

    const deadline = new Date(endsAtValue);
    if (Number.isNaN(deadline.getTime()) || deadline.getTime() <= Date.now()) {
      setFormStatus(
        listingStatus,
        "Choose a future deadline for your listing.",
        "error",
      );
      return;
    }

    const mediaRows = Array.from(
      mediaFields?.querySelectorAll("[data-media-row]") || [],
    );

    const media = mediaRows
      .map((row) => {
        const urlInput = row.querySelector("[data-media-url]");
        const altInput = row.querySelector("[data-media-alt]");
        const urlValue = String(urlInput?.value ?? "").trim();
        if (!urlValue) {
          return undefined;
        }
        return {
          url: urlValue,
          alt: String(altInput?.value ?? "").trim(),
        };
      })
      .filter(Boolean);

    if (!media.length) {
      setFormStatus(
        listingStatus,
        "Add at least one image URL for your gallery.",
        "error",
      );
      return;
    }

    const payload = {
      title,
      description,
      endsAt: deadline.toISOString(),
      media,
    };

    if (tagsValue) {
      payload.tags = tagsValue
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => Boolean(tag));
    }

    try {
      listingForm.dataset.submitting = "true";
      setFormStatus(listingStatus, "Publishing listing…", "info");
      await createListing(payload);
      setFormStatus(
        listingStatus,
        "Listing published! It will appear in your active listings shortly.",
        "success",
      );
      listingForm.reset();
      resetMediaRows();
      await loadProfile({ showLoading: false });
    } catch (error) {
      console.error(error);
      setFormStatus(
        listingStatus,
        error.message || "Unable to publish listing.",
        "error",
      );
    } finally {
      listingForm.dataset.submitting = "false";
    }
  });
}

loadProfile();

window.addEventListener("auth:changed", () => {
  auth = getStoredAuth();
});

window.addEventListener("unload", () => {
  if (typeof teardown === "function") {
    teardown();
  }
});
