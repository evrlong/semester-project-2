/* eslint-env browser */

import {
  emitAuthChanged,
  getProfile,
  getStoredAuth,
  setStoredAuth,
} from "./shared/api.js";
import { fallbackProfile } from "./shared/data.js";
import { initPageChrome, renderCount } from "./shared/page.js";

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

const numberFormatter = new Intl.NumberFormat();

const listingCardClass =
  "group relative flex h-full cursor-pointer flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors transition-shadow hover:border-indigo-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500";
const listingCardMediaClass =
  "aspect-[4/3] overflow-hidden rounded-xl bg-slate-100";
const listingCardBodyClass = "flex flex-col gap-3";
const listingCardTitleClass =
  "m-0 text-lg font-semibold text-slate-900 transition-colors group-hover:text-indigo-600";
const listingCardMetaPrimaryClass = "m-0 text-sm text-slate-600";
const listingCardMetaSecondaryClass =
  "m-0 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500";
const emptyListingCardClass =
  "flex h-full min-h-[200px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500";
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

const formatCredits = (value) =>
  `${numberFormatter.format(Math.max(0, Number(value) || 0))} credits`;

const getHighestBidAmount = (listing) => {
  if (!listing) {
    return 0;
  }

  const bids = Array.isArray(listing.bids) ? listing.bids : [];
  const highestFromBids = bids.reduce((highest, bid) => {
    const amount = Number(bid?.amount);
    if (!Number.isFinite(amount)) {
      return highest;
    }
    return amount > highest ? amount : highest;
  }, 0);

  const directAmount = Number(
    listing.highestBid?.amount ?? listing.highestBid ?? 0,
  );
  const normalizedDirect = Number.isFinite(directAmount) ? directAmount : 0;

  return Math.max(highestFromBids, normalizedDirect, 0);
};

const formatTimeRemaining = (value) => {
  if (!value) {
    return "Ends soon";
  }

  const end = new Date(value);
  if (Number.isNaN(end.getTime())) {
    return "Ends soon";
  }

  const diff = end.getTime() - Date.now();
  if (diff <= 0) {
    return "Ended";
  }

  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts = [];
  if (days > 0) {
    parts.push(`${days}d`);
  }
  parts.push(`${hours}h`);
  parts.push(`${minutes.toString().padStart(2, "0")}m`);

  return `Ends in ${parts.join(" ")}`;
};

const createListingItem = (listing, { canEdit = false } = {}) => {
  const item = document.createElement("li");
  item.className = "relative h-full";

  const link = document.createElement("a");
  link.className = listingCardClass;
  link.href = `./listing.html?id=${encodeURIComponent(listing.id)}`;
  link.setAttribute(
    "aria-label",
    listing.title ? `View ${listing.title}` : "View listing",
  );

  const media = listing.media?.[0];
  if (media?.url) {
    const figure = document.createElement("figure");
    figure.className = listingCardMediaClass;

    const image = document.createElement("img");
    image.src = media.url;
    image.alt = media.alt || listing.title;
    figure.append(image);

    link.append(figure);
  }

  const content = document.createElement("div");
  content.className = listingCardBodyClass;

  const title = document.createElement("h3");
  title.className = listingCardTitleClass;
  title.textContent = listing.title || "Untitled listing";
  content.append(title);

  const bidCount = listing._count?.bids ?? listing.bids?.length ?? 0;
  const highestBid = getHighestBidAmount(listing);
  const bidLabel = bidCount === 1 ? "bid" : "bids";

  const bidsLine = document.createElement("p");
  bidsLine.className = listingCardMetaPrimaryClass;
  const highestDisplay =
    bidCount > 0
      ? `<strong>${formatCredits(highestBid)}</strong>`
      : '<span class="font-medium text-slate-500">No bids yet</span>';
  bidsLine.innerHTML = `<strong>${numberFormatter.format(
    bidCount,
  )}</strong> ${bidLabel} · Highest bid ${highestDisplay}`;
  content.append(bidsLine);

  const endsLine = document.createElement("p");
  endsLine.className = listingCardMetaSecondaryClass;
  endsLine.textContent = formatTimeRemaining(listing.endsAt);
  content.append(endsLine);

  link.append(content);
  item.append(link);

  if (canEdit && listing?.id) {
    const editLink = document.createElement("a");
    editLink.className =
      "absolute right-5 top-5 z-10 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500";
    const url = new URL("./editListing.html", window.location.href);
    url.searchParams.set("id", listing.id);
    editLink.href = `${url.pathname}${url.search}`;
    editLink.textContent = "Edit listing";
    editLink.setAttribute(
      "aria-label",
      listing.title ? `Edit ${listing.title}` : "Edit listing",
    );
    item.append(editLink);
  }

  return item;
};
const renderCollection = (container, items, emptyMessage, options = {}) => {
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
  items.forEach((item) => fragment.append(createListingItem(item, options)));
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

  const currentAuth = getStoredAuth();
  const isOwnProfile =
    Boolean(profile?.name) && Boolean(currentAuth?.name)
      ? currentAuth.name === profile.name
      : false;

  renderCollection(
    listingsContainer,
    profile.listings,
    "No active listings yet.",
    { canEdit: isOwnProfile },
  );
  renderCollection(winsContainer, profile.wins, "No wins yet.");

  if (auth?.name && auth.name === profile.name) {
    if (auth.credits !== credits) {
      setStoredAuth({ ...auth, credits });
      emitAuthChanged();
    }
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

const handlePageHide = () => {
  if (typeof teardown === "function") {
    teardown();
  }
};

window.addEventListener("pagehide", handlePageHide, { once: true });
