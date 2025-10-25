/* eslint-env browser */

import { getProfile, getStoredAuth } from "./shared/api.js";
import { fallbackProfile } from "./shared/data.js";
import { initPageChrome, renderCount } from "./shared/page.js";
import { getAvailableCredits, setBaseCredits } from "./shared/credits.js";

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

const listingRowClass =
  "group relative flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition-colors transition-shadow hover:border-[#6E4B7A] hover:bg-[#3A2440]/10 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CDB4DB]";
const listingThumbnailClass =
  "relative flex h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-inset ring-slate-200/80 transition group-hover:ring-[#CDB4DB]";
const listingThumbnailImageClass =
  "h-full w-full object-cover transition duration-200 ease-out group-hover:scale-105";
const listingThumbnailPlaceholderClass =
  "flex h-full w-full items-center justify-center text-xs font-semibold uppercase tracking-[0.3em] text-slate-500";
const listingBodyClass = "flex min-w-0 flex-1 flex-col gap-2";
const listingTitleClass =
  "truncate text-base font-semibold leading-6 text-slate-900 transition-colors group-hover:text-[#3A2440]";
const listingPriceLineClass =
  "flex flex-wrap items-center gap-2 text-sm text-slate-600";
const listingPriceLabelClass =
  "text-xs font-semibold uppercase tracking-[0.2em] text-[#6E4B7A]";
const listingPriceValueClass = "text-sm font-semibold text-[#3A2440]";
const listingBidsBadgeClass =
  "rounded-full bg-[#3A2440]/10 px-2 py-0.5 text-xs font-medium text-[#3A2440]";
const listingEndsContainerClass =
  "flex shrink-0 flex-col items-end gap-2 text-right";
const listingEndsLabelClass =
  "text-xs font-semibold uppercase tracking-[0.2em] text-[#6E4B7A]";
const listingEndsValueClass = "text-sm font-semibold text-[#3A2440]";
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

const renderCreditBadge = (elements, value) => {
  if (!elements && elements !== 0) {
    return;
  }

  const amount = Math.max(0, Number(value) || 0);
  const formatted = numberFormatter.format(amount);
  const markup = [
    `<span class="text-lg font-semibold text-[#B7791F]">${formatted}</span>`,
    '<span class="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 via-amber-300 to-amber-500 shadow-inner shadow-amber-600/40">',
    '  <span class="absolute inset-[3px] rounded-full bg-gradient-to-br from-amber-50 via-amber-200 to-amber-400"></span>',
    '  <span class="relative text-sm font-semibold text-[#6B3F00]">&cent;</span>',
    "</span>",
    '<span class="sr-only">credits</span>',
  ].join("");

  const apply = (element) => {
    if (!element) {
      return;
    }

    element.classList.add("flex", "items-center", "gap-3", "text-[#B7791F]");
    element.classList.remove("text-slate-900");
    element.innerHTML = markup;
  };

  if (typeof elements?.forEach === "function" && !elements.nodeType) {
    elements.forEach(apply);
    return;
  }

  apply(elements);
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
    return "Soon";
  }

  const end = new Date(value);
  if (Number.isNaN(end.getTime())) {
    return "Soon";
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
  if (days > 0 || hours > 0) {
    parts.push(`${hours}h`);
  }
  parts.push(`${minutes.toString().padStart(2, "0")}m`);

  return parts.join(" ");
};

const createListingItem = (listing, { canEdit = false } = {}) => {
  const item = document.createElement("li");
  item.className = "relative";

  const link = document.createElement("a");
  link.className = listingRowClass;

  if (listing?.id) {
    link.href = `./listing.html?id=${encodeURIComponent(listing.id)}`;
  }
  link.setAttribute(
    "aria-label",
    listing?.title ? `View ${listing.title}` : "View listing",
  );

  const media = listing?.media?.[0];
  const thumbnail = document.createElement("div");
  thumbnail.className = listingThumbnailClass;

  if (media?.url) {
    const image = document.createElement("img");
    image.className = listingThumbnailImageClass;
    image.src = media.url;
    image.alt = media.alt || listing?.title || "Listing media";
    thumbnail.append(image);
  } else {
    const placeholder = document.createElement("span");
    placeholder.className = listingThumbnailPlaceholderClass;
    const initial =
      typeof listing?.title === "string" && listing.title.trim()
        ? listing.title.trim().charAt(0).toUpperCase()
        : "\u2022";
    placeholder.textContent = initial;
    thumbnail.append(placeholder);
  }

  link.append(thumbnail);

  const content = document.createElement("div");
  content.className = listingBodyClass;

  const title = document.createElement("h3");
  title.className = listingTitleClass;
  title.textContent = listing?.title || "Untitled listing";
  content.append(title);

  const bidCount = listing?._count?.bids ?? listing?.bids?.length ?? 0;
  const highestBid = getHighestBidAmount(listing);
  const startingBidRaw = Number(
    listing?.price ?? listing?.startingBid ?? listing?.basePrice ?? 0,
  );
  const startingBid = Number.isFinite(startingBidRaw) ? startingBidRaw : 0;
  const bidLabel = bidCount === 1 ? "bid" : "bids";
  const priceAmount = Math.max(highestBid, startingBid, 0);
  const hasPrice = Number.isFinite(priceAmount) && priceAmount > 0;

  const priceLine = document.createElement("p");
  priceLine.className = listingPriceLineClass;

  const priceLabel = document.createElement("span");
  priceLabel.className = listingPriceLabelClass;
  priceLabel.textContent = "Price:";
  priceLine.append(priceLabel);

  const priceValue = document.createElement("span");
  priceValue.className = hasPrice
    ? listingPriceValueClass
    : "text-sm font-medium text-slate-500";
  priceValue.textContent = hasPrice
    ? formatCredits(priceAmount)
    : "No bids yet";
  priceLine.append(document.createTextNode(" "));
  priceLine.append(priceValue);

  if (bidCount > 0) {
    const bidsBadge = document.createElement("span");
    bidsBadge.className = listingBidsBadgeClass;
    bidsBadge.textContent = `${numberFormatter.format(bidCount)} ${bidLabel}`;
    priceLine.append(bidsBadge);
  }

  content.append(priceLine);
  link.append(content);

  const endsContainer = document.createElement("div");
  endsContainer.className = listingEndsContainerClass;

  if (canEdit && listing?.id) {
    const editLink = document.createElement("a");
    editLink.className =
      "inline-flex items-center justify-center gap-2 self-end rounded-lg border border-[#6E4B7A]/40 bg-white/90 px-3 py-1 text-xs font-semibold text-[#3A2440] shadow-sm transition hover:bg-[#3A2440]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CDB4DB]";
    const url = new URL("./editListing.html", window.location.href);
    url.searchParams.set("id", listing.id);
    editLink.href = `${url.pathname}${url.search}`;
    editLink.textContent = "Edit listing";
    editLink.setAttribute(
      "aria-label",
      listing.title ? `Edit ${listing.title}` : "Edit listing",
    );
    endsContainer.append(editLink);
  }

  const endsLabel = document.createElement("span");
  endsLabel.className = listingEndsLabelClass;
  endsLabel.textContent = "Ends in:";
  endsContainer.append(endsLabel);

  const endsValue = document.createElement("span");
  endsValue.className = listingEndsValueClass;
  endsValue.textContent = formatTimeRemaining(listing?.endsAt);
  endsContainer.append(endsValue);

  link.append(endsContainer);
  item.append(link);

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

  if (isOwnProfile) {
    setBaseCredits(credits, { reason: "Profile balance" });
  }

  const availableForDisplay = isOwnProfile ? getAvailableCredits() : credits;
  renderCreditBadge(creditElements, availableForDisplay);

  renderCollection(
    listingsContainer,
    profile.listings,
    "No active listings yet.",
    { canEdit: isOwnProfile },
  );
  renderCollection(winsContainer, profile.wins, "No wins yet.");
};

const loadProfile = async () => {
  if (!profileName) {
    setStatus("Sign in to view your profile.", "warning");
    hydrateProfile(fallbackProfile, { updateTitle: false });
    return;
  }

  setStatus("Loading profile...", "info");

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
