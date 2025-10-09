/* eslint-env browser */

import { getListings, searchListings } from "./shared/api.js";
import { fallbackListings } from "./shared/data.js";
import { formatDate, initPageChrome, renderCount } from "./shared/page.js";

const teardown = initPageChrome();

const listElement = document.querySelector("[data-listings]");
const resultsCount = document.querySelector("[data-results-count]");
const statusElement = document.querySelector("[data-listings-status]");
const searchForm = document.querySelector("[data-search-form]");
const initialParams = new URLSearchParams(window.location.search);
const initialQuery = initialParams.get("query");

const DEFAULT_QUERY = {
  sort: "created",
  sortOrder: "desc",
  _seller: true,
  _bids: true,
  limit: 40,
};

const createListingCard = (listing) => {
  const listItem = document.createElement("li");
  listItem.className = "listing-card";

  const media = listing.media?.[0];
  const bids = listing._count?.bids ?? 0;
  const sellerName = listing.seller?.name || "Unknown seller";

  listItem.innerHTML = `
    <div class="listing-card__header">
      <h3 class="listing-card__title">
        <a href="./listing.html?id=${encodeURIComponent(listing.id)}">${listing.title}</a>
      </h3>
      <p class="listing-card__seller">${sellerName}</p>
    </div>
    <p class="listing-card__description">${listing.description || "No description provided."}</p>
    <div class="listing-card__meta">
      <span><strong>${bids}</strong> bids</span>
      <span>Ends ${formatDate(listing.endsAt)}</span>
    </div>
  `;

  if (media?.url) {
    const figure = document.createElement("figure");
    figure.className = "listing-card__media";

    const image = document.createElement("img");
    image.src = media.url;
    image.alt = media.alt || listing.title;
    figure.append(image);

    listItem.prepend(figure);
  }

  return listItem;
};

const renderListings = (items) => {
  if (!listElement) {
    return;
  }

  listElement.innerHTML = "";

  if (!items.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "listing-card listing-card--empty";
    emptyItem.textContent = "No listings found. Try a different search.";
    listElement.append(emptyItem);
    renderCount(resultsCount, 0);
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach((item) => {
    fragment.append(createListingCard(item));
  });

  listElement.append(fragment);
  renderCount(resultsCount, items.length);
};

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

const loadListings = async (query) => {
  setStatus("Loading listings…", "info");

  try {
    const response = query
      ? await searchListings(query, DEFAULT_QUERY)
      : await getListings(DEFAULT_QUERY);

    const items =
      Array.isArray(response?.data) && response.data.length
        ? response.data
        : [];

    if (!items.length) {
      setStatus("No listings matched your search.", "warning");
      renderListings([]);
      return;
    }

    setStatus("");
    renderListings(items);
  } catch (error) {
    console.error(error);
    setStatus(
      error.message ||
        "We couldn't load listings right now. Showing examples instead.",
      "error",
    );
    renderListings(fallbackListings);
  }
};

if (searchForm) {
  if (initialQuery) {
    const input = searchForm.querySelector('input[name="query"]');
    if (input) {
      input.value = initialQuery;
    }
  }

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(searchForm);
    const query = String(formData.get("query") || "").trim();

    if (!query) {
      loadListings();
      return;
    }

    loadListings(query);
  });
}

if (initialQuery) {
  loadListings(initialQuery);
} else {
  loadListings();
}

window.addEventListener("unload", () => {
  if (typeof teardown === "function") {
    teardown();
  }
});
