/* eslint-env browser */

import { getListing } from "./shared/api.js";
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
const statusElement = document.querySelector("[data-listing-status]");
const imageElement = document.querySelector("[data-listing-image]");
const bidsContainer = document.querySelector("[data-bid-list]");

const params = new URLSearchParams(window.location.search);
const listingId = params.get("id");

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

const renderBids = (bids = []) => {
  if (!bidsContainer) {
    return;
  }

  bidsContainer.innerHTML = "";

  if (!bids.length) {
    const empty = document.createElement("li");
    empty.className = "listing-bid listing-bid--empty";
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
      item.className = "listing-bid";
      const bidder = bid.bidder?.name || "Anonymous";
      item.innerHTML = `
        <span>${bidder}</span>
        <strong>${new Intl.NumberFormat().format(bid.amount)} credits</strong>
        <time datetime="${bid.created}">${formatDate(bid.created)}</time>
      `;
      fragment.append(item);
    });

  bidsContainer.append(fragment);
};

const hydrateListing = (listing, { updateTitle = true } = {}) => {
  if (!listing) {
    return;
  }

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
  assignTextContent(bidCountElements, new Intl.NumberFormat().format(bids));

  if (imageElement) {
    const media = listing.media?.[0];
    if (media?.url) {
      imageElement.src = media.url;
      imageElement.alt = media.alt || listing.title;
      imageElement.hidden = false;
    } else {
      imageElement.hidden = true;
      imageElement.removeAttribute("src");
      imageElement.removeAttribute("alt");
    }
  }

  renderBids(listing.bids || []);
};

const loadListing = async () => {
  if (!listingId) {
    setStatus(
      "We couldn't find that listing. Showing an example instead.",
      "warning",
    );
    hydrateListing(fallbackListings[0], { updateTitle: false });
    return;
  }

  setStatus("Loading listing details…", "info");

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

loadListing();

window.addEventListener("unload", () => {
  if (typeof teardown === "function") {
    teardown();
  }
});
