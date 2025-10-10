/* eslint-env browser */

import { getListings, searchListings } from "./shared/api.js";
import { fallbackListings } from "./shared/data.js";
import { formatDate, initPageChrome, renderCount } from "./shared/page.js";

const teardown = initPageChrome();

const listElement = document.querySelector("[data-listings]");
const resultsCount = document.querySelector("[data-results-count]");
const statusElement = document.querySelector("[data-listings-status]");
const searchForm = document.querySelector("[data-search-form]");
const paginationElement = document.querySelector("[data-pagination]");
const paginationStatus = document.querySelector("[data-pagination-status]");
const paginationPrev = document.querySelector("[data-pagination-prev]");
const paginationNext = document.querySelector("[data-pagination-next]");

const initialParams = new URLSearchParams(window.location.search);
const initialQuery = initialParams.get("query") || "";
const initialPage = Math.max(Number(initialParams.get("page")) || 1, 1);

const numberFormatter = new Intl.NumberFormat();

const DEFAULT_LIMIT = 50;
const DEFAULT_QUERY = {
  sort: "created",
  sortOrder: "desc",
  _seller: true,
  _bids: true,
  limit: DEFAULT_LIMIT,
};

const state = {
  query: String(initialQuery).trim(),
  page: initialPage,
};

const updateSearchField = () => {
  if (!searchForm) {
    return;
  }

  const input = searchForm.querySelector('input[name="query"]');
  if (input) {
    input.value = state.query;
  }
};

updateSearchField();

const updateQueryString = () => {
  const params = new URLSearchParams();
  if (state.query) {
    params.set("query", state.query);
  }
  if (state.page > 1) {
    params.set("page", String(state.page));
  }
  const queryString = params.toString();
  const url = `${window.location.pathname}${
    queryString ? `?${queryString}` : ""
  }${window.location.hash}`;
  window.history.replaceState({}, "", url);
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

const updatePagination = (meta, itemsLength) => {
  if (!paginationElement) {
    return;
  }

  const limit = Number(meta?.limit) || DEFAULT_LIMIT;
  const page = Number(meta?.page) || state.page || 1;
  const total = Number(meta?.total);
  const hasTotal = Number.isFinite(total) && total >= 0;
  const hasResults = hasTotal ? total > 0 : itemsLength > 0;

  if (!hasResults) {
    paginationElement.hidden = true;
    return;
  }

  const totalPages = hasTotal
    ? Math.max(1, Math.ceil(total / limit))
    : itemsLength < limit
      ? page
      : undefined;
  const isFirstPage = page <= 1;
  const isLastPage = totalPages ? page >= totalPages : itemsLength < limit;

  if (paginationStatus) {
    const pageLabel = totalPages
      ? `Page ${page} of ${totalPages}`
      : `Page ${page}`;
    const resultLabel = hasTotal
      ? `${numberFormatter.format(total)} results`
      : `${itemsLength} results`;
    paginationStatus.textContent = `${pageLabel} · ${resultLabel}`;
  }

  if (paginationPrev) {
    paginationPrev.disabled = isFirstPage;
  }

  if (paginationNext) {
    paginationNext.disabled = isLastPage;
  }

  paginationElement.hidden = false;
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
      <span><strong>${numberFormatter.format(bids)}</strong> bids</span>
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

const renderListings = (items, meta) => {
  if (!listElement) {
    return;
  }

  listElement.innerHTML = "";

  if (!items.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "listing-card listing-card--empty";
    emptyItem.textContent = "No listings found. Try a different search.";
    listElement.append(emptyItem);
    renderCount(resultsCount, meta?.total ?? 0);
    updatePagination(meta, 0);
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach((item) => {
    fragment.append(createListingCard(item));
  });

  listElement.append(fragment);
  renderCount(resultsCount, meta?.total ?? items.length);
  updatePagination(meta, items.length);
};

const loadListings = async ({
  query = state.query,
  page = state.page,
} = {}) => {
  state.query = String(query || "").trim();
  state.page = Math.max(Number(page) || 1, 1);
  updateSearchField();
  updateQueryString();

  setStatus("Loading listings…", "info");

  const params = { ...DEFAULT_QUERY, page: state.page };

  try {
    const response = state.query
      ? await searchListings(state.query, params)
      : await getListings(params);

    const items = Array.isArray(response?.data) ? response.data : [];
    const meta = {
      page: Number(response?.meta?.page) || state.page,
      limit: Number(response?.meta?.limit) || params.limit,
      total:
        response?.meta?.total !== undefined
          ? Number(response.meta.total)
          : response?.meta?.total,
    };

    state.page = meta.page;

    if (!items.length) {
      const message = state.query
        ? "No listings matched your search."
        : "No listings available right now.";
      setStatus(message, "warning");
      renderListings([], { ...meta, total: meta.total ?? 0 });
      return;
    }

    setStatus("");
    renderListings(items, meta);
  } catch (error) {
    console.error(error);
    setStatus(
      error.message ||
        "We couldn't load listings right now. Showing examples instead.",
      "error",
    );
    renderListings(fallbackListings, {
      page: 1,
      limit: DEFAULT_LIMIT,
      total: fallbackListings.length,
    });
  }
};

if (searchForm) {
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(searchForm);
    const query = String(formData.get("query") || "").trim();

    loadListings({ query, page: 1 });
  });
}

paginationPrev?.addEventListener("click", () => {
  if (state.page <= 1) {
    return;
  }
  loadListings({ page: state.page - 1 });
});

paginationNext?.addEventListener("click", () => {
  loadListings({ page: state.page + 1 });
});

loadListings();

window.addEventListener("unload", () => {
  if (typeof teardown === "function") {
    teardown();
  }
});
