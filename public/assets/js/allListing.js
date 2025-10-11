/* eslint-env browser */

import { getListings, searchListings } from "./shared/api.js";
import { fallbackListings } from "./shared/data.js";
import { initPageChrome, renderCount } from "./shared/page.js";

const teardown = initPageChrome();

const listElement = document.querySelector("[data-listings]");
const resultsCount = document.querySelector("[data-results-count]");
const statusElement = document.querySelector("[data-listings-status]");
const searchForm = document.querySelector("[data-search-form]");
const paginationElement = document.querySelector("[data-pagination]");
const paginationStatus = document.querySelector("[data-pagination-status]");
const paginationPrev = document.querySelector("[data-pagination-prev]");
const paginationNext = document.querySelector("[data-pagination-next]");
const sortSelect = document.querySelector("[data-sort]");
const activeToggle = document.querySelector("[data-filter-active]");

const initialParams = new URLSearchParams(window.location.search);
const initialQuery = initialParams.get("query") || "";
const initialPage = Math.max(Number(initialParams.get("page")) || 1, 1);
const initialSort = initialParams.get("sort") || "";
const initialActive = initialParams.get("active");

const numberFormatter = new Intl.NumberFormat();

const DEFAULT_LIMIT = 50;
const SORT_KEYS = ["endingSoon", "price", "priceLow", "added"];
const DEFAULT_SORT_KEY = SORT_KEYS[0];
const normalizeSortKey = (value) =>
  SORT_KEYS.includes(String(value)) ? String(value) : DEFAULT_SORT_KEY;
const parseActiveFlag = (value) => {
  if (value === null || value === undefined || value === "") {
    return true;
  }
  const normalized = String(value).toLowerCase();
  return normalized !== "false" && normalized !== "0";
};
const DEFAULT_QUERY_BASE = {
  _seller: true,
  _bids: true,
  limit: DEFAULT_LIMIT,
};

const state = {
  query: String(initialQuery).trim(),
  page: initialPage,
  sort: normalizeSortKey(initialSort),
  activeOnly: parseActiveFlag(initialActive),
};

const listingCardClass =
  "group relative flex h-full cursor-pointer flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors transition-shadow hover:border-indigo-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500";
const listingCardBodyClass = "flex flex-col gap-3";
const listingCardTitleClass =
  "m-0 text-lg font-semibold text-slate-900 transition-colors group-hover:text-indigo-600";
const listingCardMetaPrimaryClass = "m-0 text-sm text-slate-600";
const listingCardMetaSecondaryClass =
  "m-0 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500";
const listingCardMediaClass =
  "aspect-[4/3] overflow-hidden rounded-xl bg-slate-100";
const emptyListingCardClass =
  "flex h-full min-h-[200px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500";
const listingStatusBaseClass = "mt-4 text-sm";
const listingStatusToneClasses = {
  info: "text-slate-600",
  warning: "text-amber-600",
  error: "text-red-600",
};

const updateControls = () => {
  if (!searchForm) {
    return undefined;
  }

  const input = searchForm.querySelector('input[name="query"]');
  if (input) {
    input.value = state.query;
  }

  if (sortSelect) {
    sortSelect.value = state.sort;
  }

  if (activeToggle) {
    activeToggle.checked = Boolean(state.activeOnly);
  }

  return undefined;
};

updateControls();

const updateQueryString = () => {
  const params = new URLSearchParams();
  if (state.query) {
    params.set("query", state.query);
  }
  if (state.page > 1) {
    params.set("page", String(state.page));
  }
  if (state.sort && state.sort !== DEFAULT_SORT_KEY) {
    params.set("sort", state.sort);
  }
  if (!state.activeOnly) {
    params.set("active", "false");
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
    statusElement.className = `${listingStatusBaseClass} ${listingStatusToneClasses.info}`;
    return;
  }

  statusElement.hidden = false;
  const toneKey = tone && listingStatusToneClasses[tone] ? tone : "info";
  statusElement.className = `${listingStatusBaseClass} ${listingStatusToneClasses[toneKey]}`;
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

const getTimeUntilEnd = (listing) => {
  const endsAt = listing?.endsAt;
  if (!endsAt) {
    return Number.POSITIVE_INFINITY;
  }

  const endTime = new Date(endsAt).getTime();
  if (!Number.isFinite(endTime)) {
    return Number.POSITIVE_INFINITY;
  }

  return endTime - Date.now();
};

const getCreatedTime = (listing) => {
  const created = new Date(listing?.created ?? "").getTime();
  return Number.isFinite(created) ? created : 0;
};

const compareByCreatedDesc = (a, b) => getCreatedTime(b) - getCreatedTime(a);

const SORT_CONFIG = {
  endingSoon: {
    query: { sort: "created", sortOrder: "desc" },
    clientSort: (items) =>
      [...items].sort((a, b) => getTimeUntilEnd(a) - getTimeUntilEnd(b)),
  },
  price: {
    query: { sort: "created", sortOrder: "desc" },
    clientSort: (items) =>
      [...items].sort((a, b) => {
        const amountDiff = getHighestBidAmount(b) - getHighestBidAmount(a);
        if (amountDiff !== 0) {
          return amountDiff;
        }
        return compareByCreatedDesc(a, b);
      }),
  },
  priceLow: {
    query: { sort: "created", sortOrder: "desc" },
    clientSort: (items) =>
      [...items].sort((a, b) => {
        const amountDiff = getHighestBidAmount(a) - getHighestBidAmount(b);
        if (amountDiff !== 0) {
          return amountDiff;
        }
        return compareByCreatedDesc(a, b);
      }),
  },
  added: {
    query: { sort: "created", sortOrder: "desc" },
  },
};

const getSortConfig = (key) =>
  SORT_CONFIG[key] || SORT_CONFIG[DEFAULT_SORT_KEY];

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

const isListingActive = (listing) => getTimeUntilEnd(listing) > 0;

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
  listItem.className = "relative h-full";

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
  listItem.append(link);

  return listItem;
};

const renderListings = (items, meta, emptyMessage) => {
  if (!listElement) {
    return;
  }

  listElement.innerHTML = "";

  if (!items.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = emptyListingCardClass;
    emptyItem.textContent =
      emptyMessage || "No listings found. Try a different search.";
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
  sort = state.sort,
  activeOnly = state.activeOnly,
} = {}) => {
  state.query = String(query || "").trim();
  state.page = Math.max(Number(page) || 1, 1);
  state.sort = normalizeSortKey(sort);
  state.activeOnly = Boolean(activeOnly);
  updateControls();
  updateQueryString();

  setStatus("Loading listings...", "info");

  const sortConfig = getSortConfig(state.sort);
  const params = {
    ...DEFAULT_QUERY_BASE,
    page: state.page,
    ...sortConfig.query,
  };

  try {
    const response = state.query
      ? await searchListings(state.query, params)
      : await getListings(params);

    const items = Array.isArray(response?.data) ? response.data : [];
    const meta = {
      page: Number(response?.meta?.page) || state.page,
      limit: Number(response?.meta?.limit) || params.limit,
      total:
        response?.meta?.total !== undefined && response?.meta?.total !== null
          ? Number(response.meta.total)
          : response?.meta?.total,
    };

    state.page = meta.page;

    const baseList = state.activeOnly
      ? items.filter(isListingActive)
      : items.slice();

    const processedItems =
      typeof sortConfig.clientSort === "function"
        ? sortConfig.clientSort(baseList)
        : baseList;

    const effectiveMeta = { ...meta, total: processedItems.length };

    if (!items.length) {
      const message = state.query
        ? "No listings matched your search."
        : "No listings available right now.";
      setStatus(message, "warning");
      renderListings([], effectiveMeta, message);
      return;
    }

    if (!processedItems.length) {
      const message = state.query
        ? "No active listings matched your search."
        : "No active listings available right now. Clear the filter to see ended auctions.";
      setStatus(message, "warning");
      renderListings([], effectiveMeta, message);
      return;
    }

    setStatus("");
    renderListings(processedItems, effectiveMeta);
  } catch (error) {
    console.error(error);
    setStatus(
      error.message ||
        "We couldn't load listings right now. Showing examples instead.",
      "error",
    );
    const fallbackBase = state.activeOnly
      ? fallbackListings.filter(isListingActive)
      : fallbackListings.slice();
    const fallbackItems =
      typeof sortConfig.clientSort === "function"
        ? sortConfig.clientSort(fallbackBase)
        : fallbackBase;

    renderListings(
      fallbackItems,
      {
        page: 1,
        limit: DEFAULT_LIMIT,
        total: fallbackItems.length,
      },
      fallbackItems.length
        ? undefined
        : "No listings available right now. Try again later.",
    );
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

sortSelect?.addEventListener("change", () => {
  loadListings({ sort: sortSelect.value, page: 1 });
});

activeToggle?.addEventListener("change", () => {
  loadListings({ activeOnly: activeToggle.checked, page: 1 });
});

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

const handlePageHide = () => {
  if (typeof teardown === "function") {
    teardown();
  }
};

window.addEventListener("pagehide", handlePageHide, { once: true });
