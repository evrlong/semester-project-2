/* eslint-env browser */

import {
  createBid,
  getListing,
  getStoredAuth,
  refreshStoredAuthProfile,
} from "./shared/api.js";
import { fallbackListings } from "./shared/data.js";
import { formatDate, initPageChrome } from "./shared/page.js";

const teardown = initPageChrome();

const titleElements = document.querySelectorAll("[data-listing-title]");
const descriptionElements = document.querySelectorAll(
  "[data-listing-description]",
);
const sellerElements = document.querySelectorAll("[data-listing-seller]");
const deadlineElements = document.querySelectorAll("[data-listing-deadline]");
const bidCountElements = document.querySelectorAll("[data-listing-bid-count]");
const highestBidElements = document.querySelectorAll(
  "[data-listing-highest-bid]",
);
const nextMinimumElements = document.querySelectorAll(
  "[data-listing-next-minimum]",
);
const statusElement = document.querySelector("[data-listing-status]");
const imageElement = document.querySelector("[data-listing-image]");
const galleryOpenButton = document.querySelector("[data-gallery-open]");
const galleryEmptyState = document.querySelector("[data-gallery-empty]");
const galleryThumbnailsContainer = document.querySelector(
  "[data-gallery-thumbnails]",
);
const galleryModal = document.querySelector("[data-gallery-modal]");
const galleryModalImage = document.querySelector("[data-gallery-modal-image]");
const galleryModalClose = document.querySelector("[data-gallery-close]");
const galleryPrevButton = document.querySelector("[data-gallery-prev]");
const galleryNextButton = document.querySelector("[data-gallery-next]");
const bidsContainer = document.querySelector("[data-bid-list]");
const bidForm = document.querySelector("[data-bid-form]");
const bidAmountInput = document.querySelector("[data-bid-amount]");
const bidSubmitButton =
  bidForm?.querySelector("[data-bid-submit]") ||
  bidForm?.querySelector('button[type="submit"]');
const bidStatus = document.querySelector("[data-bid-status]");
const bidNotice = document.querySelector("[data-bid-notice]");
const editButton = document.querySelector("[data-edit-listing]");

const params = new URLSearchParams(window.location.search);
const listingId = params.get("id");

let currentListing;

const galleryState = {
  items: [],
  currentIndex: -1,
};

const thumbnailMediaQuery = window.matchMedia("(min-width: 640px)");

const numberFormatter = new Intl.NumberFormat();

const formatCredits = (value) => `${numberFormatter.format(value)} credits`;

const formStatusClasses = {
  info: "mt-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600",
  error:
    "mt-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700",
  success:
    "mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700",
};

const listingStatusBaseClass = "text-sm";
const listingStatusToneClasses = {
  info: "text-slate-600",
  warning: "text-amber-600",
  error: "text-red-600",
};

const bidNoticeClasses = {
  info: "mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600",
  warning:
    "mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700",
  error:
    "mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
  success:
    "mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700",
};

const listingBidClass =
  "flex flex-wrap justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700";
const listingBidEmptyClass = `${listingBidClass} justify-center text-slate-500`;

const setStatus = (message, tone = "info") => {
  if (!statusElement) {
    return;
  }

  statusElement.textContent = message;
  if (!message) {
    statusElement.hidden = true;
    statusElement.className = `${listingStatusBaseClass} ${listingStatusToneClasses.info}`;
    return;
  }

  statusElement.hidden = false;
  const toneKey = tone && listingStatusToneClasses[tone] ? tone : "info";
  statusElement.className = `${listingStatusBaseClass} ${listingStatusToneClasses[toneKey]}`;
};

const assignTextContent = (elements, value) => {
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

const setGalleryButtonState = (enabled) => {
  if (!galleryOpenButton) {
    return;
  }

  galleryOpenButton.disabled = !enabled;
  galleryOpenButton.setAttribute("aria-disabled", enabled ? "false" : "true");

  const total = galleryState.items.length;
  const current = galleryState.currentIndex;
  const hasItems = enabled && total > 0;
  const canNavigate = hasItems && total > 1;

  if (galleryPrevButton) {
    const showPrev = canNavigate && current > 0;
    galleryPrevButton.hidden = !showPrev;
    galleryPrevButton.disabled = !showPrev;
  }

  if (galleryNextButton) {
    const showNext = canNavigate && current < total - 1;
    galleryNextButton.hidden = !showNext;
    galleryNextButton.disabled = !showNext;
  }
};

const applyThumbnailSelection = () => {
  if (!galleryThumbnailsContainer) {
    return;
  }

  const buttons = galleryThumbnailsContainer.querySelectorAll(
    "[data-gallery-thumb]",
  );

  buttons.forEach((button) => {
    const index = Number(button.dataset.galleryIndex);
    if (index === galleryState.currentIndex) {
      button.classList.add("ring-2", "ring-indigo-500");
      button.setAttribute("aria-current", "true");
    } else {
      button.classList.remove("ring-2", "ring-indigo-500");
      button.removeAttribute("aria-current");
    }
  });
};

function handleModalKeydown(event) {
  if (event.key === "Escape") {
    closeGalleryModal();
  }
}

const closeGalleryModal = () => {
  if (!galleryModal) {
    return;
  }

  if (!galleryModal.classList.contains("hidden")) {
    galleryModal.classList.add("hidden");
    document.body.classList.remove("overflow-hidden");
    window.removeEventListener("keydown", handleModalKeydown);
  }

  if (galleryModalImage) {
    galleryModalImage.removeAttribute("src");
    galleryModalImage.removeAttribute("alt");
  }
};

const syncModalImage = () => {
  if (!galleryModal || galleryModal.classList.contains("hidden")) {
    return;
  }

  const media = galleryState.items[galleryState.currentIndex];
  if (!media?.url) {
    closeGalleryModal();
    return;
  }

  if (galleryModalImage) {
    galleryModalImage.src = media.url;
    galleryModalImage.alt =
      media.alt || currentListing?.title || "Listing image preview";
  }
};

const updateMainImage = (index) => {
  if (!imageElement) {
    return;
  }

  const media =
    index >= 0 && index < galleryState.items.length
      ? galleryState.items[index]
      : undefined;

  if (!media?.url) {
    imageElement.hidden = true;
    imageElement.removeAttribute("src");
    imageElement.removeAttribute("alt");
    if (galleryEmptyState) {
      galleryEmptyState.hidden = false;
    }
    galleryState.currentIndex = -1;
    setGalleryButtonState(false);
    applyThumbnailSelection();
    syncModalImage();
    return;
  }

  imageElement.hidden = false;
  imageElement.src = media.url;
  imageElement.alt =
    media.alt || currentListing?.title || "Listing image preview";
  if (galleryEmptyState) {
    galleryEmptyState.hidden = true;
  }
  galleryState.currentIndex = index;
  setGalleryButtonState(true);
  applyThumbnailSelection();
  syncModalImage();
};

const renderGalleryThumbnails = () => {
  if (!galleryThumbnailsContainer) {
    return;
  }

  const shouldShow =
    thumbnailMediaQuery.matches && galleryState.items.length > 1;

  if (!shouldShow) {
    galleryThumbnailsContainer.hidden = true;
    return;
  }

  galleryThumbnailsContainer.hidden = false;
  galleryThumbnailsContainer.innerHTML = "";

  const fragment = document.createDocumentFragment();

  galleryState.items.forEach((media, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.galleryThumb = "true";
    button.dataset.galleryIndex = String(index);
    button.className =
      "group relative overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-indigo-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500";

    const thumbImage = document.createElement("img");
    thumbImage.className = "aspect-[4/3] h-full w-full object-cover";
    thumbImage.src = media.url;
    thumbImage.alt = media.alt || currentListing?.title || "Listing image";
    button.setAttribute("aria-label", thumbImage.alt);
    button.append(thumbImage);
    button.addEventListener("click", () => {
      if (galleryState.currentIndex !== index) {
        updateMainImage(index);
      }
    });

    fragment.append(button);
  });

  galleryThumbnailsContainer.append(fragment);
  applyThumbnailSelection();
};

const hydrateGallery = (listing) => {
  const mediaItems = Array.isArray(listing?.media)
    ? listing.media.filter((item) => item?.url)
    : [];

  galleryState.items = mediaItems;
  galleryState.currentIndex = -1;

  if (mediaItems.length) {
    updateMainImage(0);
  } else {
    updateMainImage(-1);
  }

  renderGalleryThumbnails();
};

const openGalleryModal = () => {
  if (!galleryModal) {
    return;
  }

  const media = galleryState.items[galleryState.currentIndex];
  if (!media?.url) {
    return;
  }

  galleryModal.classList.remove("hidden");
  document.body.classList.add("overflow-hidden");
  syncModalImage();
  window.addEventListener("keydown", handleModalKeydown);
};
setGalleryButtonState(false);

if (galleryOpenButton) {
  galleryOpenButton.addEventListener("click", () => {
    if (!galleryOpenButton.disabled) {
      openGalleryModal();
    }
  });
}

galleryModalClose?.addEventListener("click", closeGalleryModal);
galleryModal?.addEventListener("click", (event) => {
  if (event.target === galleryModal) {
    closeGalleryModal();
  }
});

galleryPrevButton?.addEventListener("click", () => {
  if (galleryState.currentIndex > 0) {
    updateMainImage(galleryState.currentIndex - 1);
  }
});

galleryNextButton?.addEventListener("click", () => {
  if (
    galleryState.currentIndex >= 0 &&
    galleryState.currentIndex < galleryState.items.length - 1
  ) {
    updateMainImage(galleryState.currentIndex + 1);
  }
});

if (typeof thumbnailMediaQuery.addEventListener === "function") {
  thumbnailMediaQuery.addEventListener("change", () => {
    renderGalleryThumbnails();
  });
} else if (typeof thumbnailMediaQuery.addListener === "function") {
  thumbnailMediaQuery.addListener(() => {
    renderGalleryThumbnails();
  });
}

const updateEditButton = (listing) => {
  if (!editButton) {
    return;
  }

  const auth = getStoredAuth();
  const canEdit =
    Boolean(auth?.name) && listing?.seller?.name === auth.name && listing?.id;

  if (!canEdit) {
    editButton.hidden = true;
    editButton.removeAttribute("href");
    return;
  }

  const url = new URL("./editListing.html", window.location.href);
  url.searchParams.set("id", listing.id);
  editButton.href = `${url.pathname}${url.search}`;
  editButton.hidden = false;
};

const getHighestBidAmount = (listing) => {
  if (!listing?.bids?.length) {
    return 0;
  }

  return listing.bids.reduce((max, bid) => {
    const amount = Number(bid.amount);
    if (!Number.isFinite(amount)) {
      return max;
    }
    return amount > max ? amount : max;
  }, 0);
};

const getNextMinimumBidAmount = (listing) => {
  const highest = getHighestBidAmount(listing);
  return highest > 0 ? highest + 1 : 1;
};

const setBidNotice = (message, tone = "info") => {
  if (!bidNotice) {
    return;
  }

  if (!message) {
    bidNotice.hidden = true;
    bidNotice.textContent = "";
    bidNotice.className = bidNoticeClasses.info;
    return;
  }

  bidNotice.hidden = false;
  bidNotice.textContent = message;
  const toneKey = tone && bidNoticeClasses[tone] ? tone : "info";
  bidNotice.className = bidNoticeClasses[toneKey];
};

const setBidStatus = (message, tone = "info") => {
  if (!bidStatus) {
    return;
  }

  if (!message) {
    bidStatus.hidden = true;
    bidStatus.textContent = "";
    bidStatus.className = formStatusClasses.info;
    delete bidStatus.dataset.tone;
    return;
  }

  bidStatus.hidden = false;
  bidStatus.textContent = message;
  const toneKey = tone && formStatusClasses[tone] ? tone : "info";
  bidStatus.className = formStatusClasses[toneKey];
  bidStatus.dataset.tone = toneKey;
};

const isListingClosed = (listing) => {
  if (!listing?.endsAt) {
    return false;
  }

  const ends = new Date(listing.endsAt);
  if (Number.isNaN(ends.getTime())) {
    return false;
  }

  return ends.getTime() <= Date.now();
};

const updateBidSummary = () => {
  const highest = getHighestBidAmount(currentListing);
  assignTextContent(
    highestBidElements,
    highest > 0 ? formatCredits(highest) : "No bids yet",
  );

  const nextMinimum = getNextMinimumBidAmount(currentListing);
  assignTextContent(nextMinimumElements, numberFormatter.format(nextMinimum));

  if (bidAmountInput) {
    const minimum = Math.max(1, nextMinimum);
    bidAmountInput.min = String(minimum);
    bidAmountInput.setAttribute("min", String(minimum));
    if (!bidAmountInput.value) {
      bidAmountInput.placeholder = numberFormatter.format(minimum);
    }
  }
};

const updateBidFormAvailability = () => {
  if (!bidForm) {
    return;
  }

  const auth = getStoredAuth();
  const signedIn = Boolean(auth?.accessToken);
  const sellerName = currentListing?.seller?.name;
  const authName = typeof auth?.name === "string" ? auth.name : "";
  const isSeller =
    signedIn &&
    sellerName &&
    authName.toLowerCase() === sellerName.toLowerCase();
  const closed = isListingClosed(currentListing);
  const listingAvailable =
    Boolean(listingId) &&
    Boolean(currentListing?.id) &&
    currentListing.id === listingId;

  let message = "";
  let tone = "info";

  if (!listingId) {
    message = "We couldn't find this listing, so bidding is unavailable.";
    tone = "warning";
  } else if (!listingAvailable) {
    message = "Bidding is disabled while we show an example listing.";
    tone = "warning";
  } else if (!signedIn) {
    message = "Log in to place a bid.";
  } else if (isSeller) {
    message = "You cannot bid on your own listing.";
    tone = "warning";
  } else if (closed) {
    message = "This auction has ended. Bidding is closed.";
    tone = "warning";
  }

  const allow =
    !message && signedIn && listingAvailable && !isSeller && !closed;

  if (bidAmountInput) {
    bidAmountInput.disabled = !allow;
  }

  if (bidSubmitButton) {
    bidSubmitButton.disabled = !allow;
  }

  setBidNotice(message, tone);

  if (!allow) {
    setBidStatus("");
  }
};

const renderBids = (bids = []) => {
  if (!bidsContainer) {
    return;
  }

  bidsContainer.innerHTML = "";

  if (!bids.length) {
    const empty = document.createElement("li");
    empty.className = listingBidEmptyClass;
    empty.textContent = "No bids yet. Be the first to place one!";
    bidsContainer.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  bids
    .slice()
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .forEach((bid) => {
      const item = document.createElement("li");
      item.className = listingBidClass;
      const bidder = bid.bidder?.name || "Anonymous";
      const created = bid.created ? new Date(bid.created).toISOString() : "";
      item.innerHTML = `
        <span>${bidder}</span>
        <strong>${formatCredits(Number(bid.amount) || 0)}</strong>
        <time datetime="${created}">${formatDate(bid.created)}</time>
      `;
      fragment.append(item);
    });

  bidsContainer.append(fragment);
};

const hydrateListing = (listing, { updateTitle = true } = {}) => {
  if (!listing) {
    return;
  }

  currentListing = listing;

  updateEditButton(listing);
  hydrateGallery(listing);

  assignTextContent(titleElements, listing.title);
  if (listing.title && updateTitle) {
    document.title = `${listing.title} | Auction House`;
  }
  assignTextContent(
    descriptionElements,
    listing.description || "No description provided.",
  );

  const sellerName = listing.seller?.name || "Unknown seller";
  assignTextContent(sellerElements, sellerName);

  assignTextContent(deadlineElements, formatDate(listing.endsAt));
  let isoDeadline = "";
  if (listing.endsAt) {
    const parsed = new Date(listing.endsAt);
    if (!Number.isNaN(parsed.getTime())) {
      isoDeadline = parsed.toISOString();
    }
  }
  if (isoDeadline && deadlineElements) {
    const assignDateTime = (element) => {
      if (element?.tagName === "TIME") {
        element.dateTime = isoDeadline;
      }
    };

    if (
      typeof deadlineElements.forEach === "function" &&
      !deadlineElements.nodeType
    ) {
      deadlineElements.forEach(assignDateTime);
    } else {
      assignDateTime(deadlineElements);
    }
  }

  const bids = listing._count?.bids ?? listing.bids?.length ?? 0;
  assignTextContent(bidCountElements, numberFormatter.format(bids));

  renderBids(listing.bids || []);
  updateBidSummary();
  updateBidFormAvailability();
  setBidStatus("");
};

const loadListing = async ({ silent = false } = {}) => {
  if (!listingId) {
    setStatus(
      "We couldn't find that listing. Showing an example instead.",
      "warning",
    );
    hydrateListing(fallbackListings[0], { updateTitle: false });
    return;
  }

  if (!silent) {
    setStatus("Loading listing details…", "info");
  }

  try {
    const response = await getListing(listingId, {
      _seller: true,
      _bids: true,
    });

    const listing = response?.data;

    if (!listing) {
      throw new Error("Listing not found");
    }

    setStatus("");
    hydrateListing(listing, { updateTitle: true });
  } catch (error) {
    console.error(error);
    setStatus(
      error.message ||
        "We couldn't load this listing right now. Showing an example instead.",
      "error",
    );
    hydrateListing(fallbackListings[0], { updateTitle: false });
  }
};

const handleAuthChanged = () => {
  updateBidFormAvailability();
  if (currentListing) {
    updateEditButton(currentListing);
  }
};

window.addEventListener("auth:changed", handleAuthChanged);

if (bidForm) {
  bidForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (bidForm.dataset.submitting === "true") {
      return;
    }

    if (!listingId || !currentListing || currentListing.id !== listingId) {
      setBidStatus(
        "Bidding is unavailable right now. Please refresh and try again.",
        "error",
      );
      return;
    }

    const formData = new FormData(bidForm);
    const rawAmount = Number(formData.get("amount"));

    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      setBidStatus("Enter a valid bid amount in credits.", "error");
      return;
    }

    const amount = Math.floor(rawAmount);
    const minimum = getNextMinimumBidAmount(currentListing);

    if (amount < minimum) {
      setBidStatus(
        `Your bid must be at least ${formatCredits(minimum)}.`,
        "error",
      );
      return;
    }

    try {
      bidForm.dataset.submitting = "true";
      setBidStatus("Placing your bid…", "info");

      await createBid(listingId, { amount });

      setBidStatus("Bid placed! Good luck.", "success");
      bidForm.reset();
      await loadListing({ silent: true });
      await refreshStoredAuthProfile();
    } catch (error) {
      console.error(error);
      setBidStatus(
        error.message ||
          "We couldn't place your bid right now. Please try again.",
        "error",
      );
    } finally {
      delete bidForm.dataset.submitting;
      updateBidSummary();
      updateBidFormAvailability();
    }
  });
}

const handleBidInput = () => {
  if (bidStatus && bidStatus.dataset.tone === "error") {
    setBidStatus("");
  }
};

bidAmountInput?.addEventListener("input", handleBidInput);

loadListing();

const handlePageHide = () => {
  window.removeEventListener("auth:changed", handleAuthChanged);
  bidAmountInput?.removeEventListener("input", handleBidInput);
  closeGalleryModal();
  if (typeof teardown === "function") {
    teardown();
  }
};

window.addEventListener("pagehide", handlePageHide, { once: true });
