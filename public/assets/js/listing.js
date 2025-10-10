/* eslint-env browser */

import { createBid, getListing, getStoredAuth } from "./shared/api.js";
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
const bidBlock = document.querySelector("[data-bid-block]");
const bidForm = document.querySelector("[data-bid-form]");
const bidMessage = document.querySelector("[data-bid-message]");
const bidStatus = document.querySelector("[data-bid-status]");
const bidAmountInput = bidForm?.querySelector('[name="amount"]');

const params = new URLSearchParams(window.location.search);
const listingId = params.get("id");
let activeListing;
let biddingEnabled = false;

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

const getHighestBid = (listing) => {
  if (!listing?.bids?.length) {
    return 0;
  }

  return listing.bids.reduce((highest, bid) => {
    const amount = Number(bid.amount);
    if (!Number.isFinite(amount)) {
      return highest;
    }

    return Math.max(highest, amount);
  }, 0);
};

const getMinimumBid = (listing) => {
  const highestBid = getHighestBid(listing);
  return highestBid > 0 ? highestBid + 1 : 1;
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

const updateBidUI = () => {
  if (!bidBlock) {
    return;
  }

  if (!activeListing || !biddingEnabled || !listingId) {
    bidBlock.hidden = true;
    return;
  }

  bidBlock.hidden = false;

  const auth = getStoredAuth();
  const signedIn = Boolean(auth?.accessToken);
  const isSeller =
    signedIn && auth?.name && auth.name === activeListing?.seller?.name;
  const endsAt = activeListing?.endsAt
    ? new Date(activeListing.endsAt)
    : undefined;
  const hasEnded =
    endsAt instanceof Date && !Number.isNaN(endsAt.getTime())
      ? endsAt.getTime() <= Date.now()
      : false;

  const minimumBid = getMinimumBid(activeListing);

  if (bidAmountInput) {
    bidAmountInput.min = String(minimumBid);
    bidAmountInput.step = "1";
  }

  const setMessage = (message) => {
    if (bidMessage) {
      bidMessage.textContent = message;
      bidMessage.hidden = false;
    }
  };

  if (!signedIn) {
    if (bidForm) {
      bidForm.hidden = true;
    }
    setMessage("Log in to place a bid on this listing.");
    return;
  }

  if (isSeller) {
    if (bidForm) {
      bidForm.hidden = true;
    }
    setMessage("You cannot bid on your own listing.");
    return;
  }

  if (hasEnded) {
    if (bidForm) {
      bidForm.hidden = true;
    }
    setMessage("This listing has ended. You can no longer place bids.");
    return;
  }

  if (bidForm) {
    bidForm.hidden = false;
  }

  if (bidStatus && !bidStatus.hidden && bidStatus.dataset.tone !== "error") {
    bidStatus.hidden = true;
    delete bidStatus.dataset.tone;
    bidStatus.textContent = "";
  }

  if (bidAmountInput) {
    bidAmountInput.placeholder = `Minimum bid: ${new Intl.NumberFormat().format(
      minimumBid,
    )} credits`;
  }

  setMessage(
    `Enter an amount of at least ${new Intl.NumberFormat().format(
      minimumBid,
    )} credits.`,
  );
};

const setListingContext = (
  listing,
  { allowBid = false, updateTitle = true },
) => {
  activeListing = listing;
  biddingEnabled = allowBid;
  hydrateListing(listing, { updateTitle });
  updateBidUI();
};

const loadListing = async ({ showLoading = true } = {}) => {
  if (!listingId) {
    setStatus(
      "We couldn't find that listing. Showing an example instead.",
      "warning",
    );
    setListingContext(fallbackListings[0], {
      allowBid: false,
      updateTitle: false,
    });
    return;
  }

  if (showLoading) {
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
    setListingContext(listing, { allowBid: true, updateTitle: true });
  } catch (error) {
    console.error(error);
    setStatus(
      error.message ||
        "We couldn't load this listing right now. Showing an example instead.",
      "error",
    );
    setListingContext(fallbackListings[0], {
      allowBid: false,
      updateTitle: false,
    });
  }
};

const showBidStatus = (message, tone = "info") => {
  if (!bidStatus) {
    return;
  }

  bidStatus.textContent = message;
  bidStatus.hidden = !message;
  if (!message) {
    delete bidStatus.dataset.tone;
    return;
  }

  bidStatus.dataset.tone = tone;
};

if (bidForm) {
  bidForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!activeListing || !biddingEnabled) {
      return;
    }

    if (bidForm.dataset.submitting === "true") {
      return;
    }

    const formData = new FormData(bidForm);
    const amountValue = Number(formData.get("amount"));
    const minimumBid = getMinimumBid(activeListing);

    if (!Number.isFinite(amountValue) || amountValue < minimumBid) {
      showBidStatus(
        `Enter a valid amount of at least ${new Intl.NumberFormat().format(
          minimumBid,
        )} credits.`,
        "error",
      );
      return;
    }

    try {
      bidForm.dataset.submitting = "true";
      showBidStatus("Submitting your bid…", "info");
      await createBid(activeListing.id, { amount: amountValue });
      showBidStatus("Bid placed successfully! Refreshing details…", "success");
      bidForm.reset();
      await loadListing({ showLoading: false });
    } catch (error) {
      console.error(error);
      showBidStatus(error.message || "Unable to place bid.", "error");
    } finally {
      bidForm.dataset.submitting = "false";
    }
  });
}

loadListing();

window.addEventListener("auth:changed", () => {
  updateBidUI();
});

window.addEventListener("unload", () => {
  if (typeof teardown === "function") {
    teardown();
  }
});
