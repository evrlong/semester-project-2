/* eslint-env browser */

import {
  emitAuthChanged,
  getProfile,
  getStoredAuth,
  setStoredAuth,
} from "./api.js";

const STORAGE_KEY = "auction-house-credit-balance";
const SYNC_STALE_MS = 60_000;

const creditDefaults = () => ({
  amount: 0,
  updatedAt: null,
});

const reservations = new Map();

let creditState = creditDefaults();
let loaded = false;
let initialized = false;
let suppressAuthEvent = false;
let syncPromise;

const sanitizeAmount = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.floor(numeric));
};

const hasStorage = () => {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
};

const ensureLoaded = () => {
  if (loaded) {
    return;
  }

  loaded = true;

  if (!hasStorage()) {
    return;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return;
    }

    creditState = {
      amount: sanitizeAmount(parsed.amount),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    };
  } catch (error) {
    console.warn("Unable to read stored credits", error);
    creditState = creditDefaults();
  }
};

const persistState = () => {
  if (!hasStorage()) {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(creditState));
  } catch (error) {
    console.warn("Unable to persist credits", error);
  }
};

const broadcastCreditUpdate = (amount = creditState.amount) => {
  window.dispatchEvent(
    new CustomEvent("credits:updated", { detail: { available: amount } }),
  );
};

const updateAuthCredits = (amount) => {
  const auth = getStoredAuth();

  if (!auth?.accessToken) {
    broadcastCreditUpdate(amount);
    return;
  }

  const storedAmount = sanitizeAmount(auth.credits);

  if (storedAmount === amount) {
    broadcastCreditUpdate(amount);
    return;
  }

  suppressAuthEvent = true;
  setStoredAuth({ ...auth, credits: amount });
  emitAuthChanged();
  suppressAuthEvent = false;
};

const setLocalCredits = (amount, { updateAuth = true } = {}) => {
  ensureLoaded();

  const normalized = sanitizeAmount(amount);
  creditState = {
    amount: normalized,
    updatedAt: new Date().toISOString(),
  };

  persistState();

  if (updateAuth) {
    updateAuthCredits(normalized);
  } else {
    broadcastCreditUpdate(normalized);
  }

  return normalized;
};

const adjustLocalCredits = (delta, options) => {
  ensureLoaded();
  const target = creditState.amount + delta;
  return setLocalCredits(target, options);
};

const resetState = () => {
  creditState = creditDefaults();
  loaded = true;
  reservations.clear();

  if (hasStorage()) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn("Unable to clear stored credits", error);
    }
  }

  broadcastCreditUpdate(0);
};

export const getAvailableCredits = () => {
  ensureLoaded();
  return creditState.amount;
};

export const setBaseCredits = (value) => {
  setLocalCredits(value);
};

export const getReservationAmount = (listingId) => {
  if (!listingId || !reservations.has(listingId)) {
    return 0;
  }
  return sanitizeAmount(reservations.get(listingId).amount);
};

export const canAffordBid = (listingId, amount) => {
  ensureLoaded();

  const normalized = sanitizeAmount(amount);
  const reservation = listingId ? reservations.get(listingId) : undefined;
  const previousAmount = reservation ? sanitizeAmount(reservation.amount) : 0;
  const delta = normalized - previousAmount;
  const available = getAvailableCredits();

  return {
    ok: normalized > 0 && delta <= available,
    available,
    required: normalized,
    deficit: delta > available ? delta - available : 0,
    delta,
  };
};

export const applyBidReservation = ({ listingId, amount, listingTitle }) => {
  ensureLoaded();

  const normalized = sanitizeAmount(amount);

  if (!listingId || !normalized) {
    return { ok: false, reason: "invalid" };
  }

  const affordability = canAffordBid(listingId, normalized);
  if (!affordability.ok) {
    return {
      ok: false,
      reason: "insufficient",
      deficit: affordability.deficit,
    };
  }

  const reservation = reservations.get(listingId) || {
    amount: 0,
    status: "pending",
    title: "",
  };

  const previousAmount = sanitizeAmount(reservation.amount);
  const delta = normalized - previousAmount;

  if (delta !== 0) {
    adjustLocalCredits(-delta);
  }

  reservations.set(listingId, {
    amount: normalized,
    status: "pending",
    title: listingTitle || reservation.title || "",
    updatedAt: new Date().toISOString(),
  });

  return { ok: true, delta };
};

export const releaseReservation = ({ listingId }) => {
  if (!listingId || !reservations.has(listingId)) {
    return { ok: false };
  }

  const reservation = reservations.get(listingId);
  reservations.delete(listingId);

  const amount = sanitizeAmount(reservation.amount);
  if (amount) {
    adjustLocalCredits(amount);
  }

  return { ok: true, amount };
};

export const markReservationAsWon = ({ listingId }) => {
  if (!listingId || !reservations.has(listingId)) {
    return { ok: false };
  }

  const reservation = reservations.get(listingId);
  reservations.set(listingId, {
    ...reservation,
    status: "won",
    updatedAt: new Date().toISOString(),
  });

  return { ok: true };
};

const deriveHighestBid = (listing) => {
  if (!listing) {
    return undefined;
  }

  const bids = Array.isArray(listing.bids) ? listing.bids : [];
  let highestAmount = 0;
  let highestBidder = "";

  bids.forEach((bid) => {
    const amount = sanitizeAmount(bid?.amount);
    if (!amount) {
      return;
    }

    const bidderName =
      typeof bid?.bidder === "string"
        ? bid.bidder
        : bid?.bidder?.name || bid?.bidderName;

    if (amount >= highestAmount && bidderName) {
      highestAmount = amount;
      highestBidder = bidderName;
    }
  });

  if (
    listing.highestBid &&
    Number.isFinite(Number(listing.highestBid?.amount ?? listing.highestBid))
  ) {
    const amount = sanitizeAmount(
      listing.highestBid.amount ?? listing.highestBid,
    );
    const bidderName =
      typeof listing.highestBid === "object"
        ? listing.highestBid.bidderName || listing.highestBid.bidder?.name
        : "";

    if (amount >= highestAmount && bidderName) {
      highestAmount = amount;
      highestBidder = bidderName;
    }
  }

  if (!highestAmount || !highestBidder) {
    return undefined;
  }

  return { amount: highestAmount, bidder: highestBidder };
};

const listingHasEnded = (listing) => {
  if (!listing?.endsAt) {
    return false;
  }

  const end = new Date(listing.endsAt);
  if (Number.isNaN(end.getTime())) {
    return false;
  }

  return end.getTime() <= Date.now();
};

export const reconcileListingCredits = (listing, currentUserName) => {
  if (!listing?.id) {
    return listing;
  }

  const reservation = reservations.get(listing.id);

  if (!currentUserName) {
    if (reservation) {
      releaseReservation({ listingId: listing.id });
    }
    return listing;
  }

  const highest = deriveHighestBid(listing);

  if (!highest || highest.bidder !== currentUserName) {
    if (reservation) {
      releaseReservation({ listingId: listing.id });
    }
    return listing;
  }

  const normalizedAmount = sanitizeAmount(highest.amount);
  if (!reservation || reservation.amount !== normalizedAmount) {
    reservations.set(listing.id, {
      amount: normalizedAmount,
      status: reservation?.status ?? "pending",
      title: reservation?.title || listing.title || "",
      updatedAt: new Date().toISOString(),
    });
  }

  if (listingHasEnded(listing)) {
    markReservationAsWon({ listingId: listing.id });
  }

  return listing;
};

export const reconcileListingsCredits = (listings, currentUserName) => {
  if (!Array.isArray(listings)) {
    return listings;
  }

  listings.forEach((listing) =>
    reconcileListingCredits(listing, currentUserName),
  );

  return listings;
};

export const getCreditTransactions = () => [];

const maybeSyncFromServer = ({ force = false } = {}) => {
  const auth = getStoredAuth();

  if (!auth?.accessToken || !auth?.name) {
    return undefined;
  }

  ensureLoaded();

  if (syncPromise) {
    return syncPromise;
  }

  if (!force && creditState.updatedAt) {
    const updated = Date.parse(creditState.updatedAt);
    if (!Number.isNaN(updated) && Date.now() - updated < SYNC_STALE_MS) {
      return undefined;
    }
  }

  syncPromise = (async () => {
    try {
      const response = await getProfile(auth.name);
      const credits = sanitizeAmount(response?.data?.credits ?? auth.credits);
      setLocalCredits(credits);
    } catch (error) {
      console.warn("Unable to synchronize credits from API", error);
    } finally {
      syncPromise = undefined;
    }
  })();

  return syncPromise;
};

export const initCreditSystem = () => {
  ensureLoaded();

  if (initialized) {
    maybeSyncFromServer();
    return () => {};
  }

  const auth = getStoredAuth();
  if (!auth?.accessToken) {
    resetState();
  } else if (Number.isFinite(Number(auth.credits))) {
    setLocalCredits(auth.credits, { updateAuth: false });
    maybeSyncFromServer({ force: true });
  } else {
    maybeSyncFromServer({ force: true });
  }

  const handleAuthChanged = () => {
    if (suppressAuthEvent) {
      return;
    }

    const authState = getStoredAuth();
    if (!authState?.accessToken) {
      resetState();
      return;
    }

    if (Number.isFinite(Number(authState.credits))) {
      setLocalCredits(authState.credits, { updateAuth: false });
    }

    maybeSyncFromServer({ force: true });
  };

  const handleExternalSync = (event) => {
    const value = Number(event?.detail?.credits);
    if (!Number.isFinite(value)) {
      return;
    }
    setBaseCredits(value);
  };

  window.addEventListener("auth:changed", handleAuthChanged);
  window.addEventListener("credits:sync:base", handleExternalSync);

  initialized = true;

  return () => {
    window.removeEventListener("auth:changed", handleAuthChanged);
    window.removeEventListener("credits:sync:base", handleExternalSync);
    initialized = false;
  };
};
