/* eslint-env browser */

import {
  emitAuthChanged,
  getProfile,
  getStoredAuth,
  setStoredAuth,
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

const params = new URLSearchParams(window.location.search);
const auth = getStoredAuth();
const profileName = params.get("name") || auth?.name || "";

const listingCardClass =
  "flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
const listingCardMediaClass =
  "aspect-[4/3] overflow-hidden rounded-xl bg-slate-100";
const listingCardBodyClass = "flex flex-col gap-3";
const listingCardTitleClass = "m-0 text-lg font-semibold text-slate-900";
const listingCardLinkClass =
  "text-slate-900 no-underline transition hover:text-indigo-600 hover:underline";
const listingCardDescriptionClass = "m-0 text-base text-slate-600";
const listingCardMetaClass = "flex flex-wrap gap-3 text-sm text-slate-500";
const emptyListingCardClass = `${listingCardClass} text-center text-sm text-slate-500`;
const profileStatusBaseClass = "text-sm";
const profileStatusToneClasses = {
  info: "text-slate-600",
  warning: "text-amber-600",
  error: "text-red-600",
};

const setStatus = (message, tone = "info") => {
  if (!statusElement) {
    return;
  }

  statusElement.textContent = message;
  if (!message) {
    statusElement.hidden = true;
    statusElement.className = `${profileStatusBaseClass} ${profileStatusToneClasses.info}`;
    return;
  }

  statusElement.hidden = false;
  const toneKey = tone && profileStatusToneClasses[tone] ? tone : "info";
  statusElement.className = `${profileStatusBaseClass} ${profileStatusToneClasses[toneKey]}`;
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

const createListingItem = (listing) => {
  const item = document.createElement("li");
  item.className = listingCardClass;

  const media = listing.media?.[0];
  if (media?.url) {
    const figure = document.createElement("figure");
    figure.className = listingCardMediaClass;

    const image = document.createElement("img");
    image.src = media.url;
    image.alt = media.alt || listing.title;
    figure.append(image);

    item.append(figure);
  }

  const content = document.createElement("div");
  content.className = listingCardBodyClass;

  const title = document.createElement("h3");
  title.className = listingCardTitleClass;
  title.innerHTML = `<a class="${listingCardLinkClass}" href="./listing.html?id=${encodeURIComponent(listing.id)}">${listing.title}</a>`;
  content.append(title);

  const description = document.createElement("p");
  description.className = listingCardDescriptionClass;
  description.textContent = listing.description || "No description provided.";
  content.append(description);

  const meta = document.createElement("div");
  meta.className = listingCardMetaClass;
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
    empty.className = emptyListingCardClass;
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

  if (auth?.name && auth.name === profile.name) {
    setStoredAuth({ ...auth, credits });
    emitAuthChanged();
  }
};

const loadProfile = async () => {
  if (!profileName) {
    setStatus("Sign in to view your profile.", "warning");
    hydrateProfile(fallbackProfile, { updateTitle: false });
    return;
  }

  setStatus("Loading profile…", "info");

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

loadProfile();

window.addEventListener("unload", () => {
  if (typeof teardown === "function") {
    teardown();
  }
});
