/* eslint-env browser */

import { emitAuthChanged, getStoredAuth, setStoredAuth } from "./api.js";

const LEDGER_STORAGE_KEY = "auction-house-credit-ledger";
const MAX_TRANSACTIONS = 100;

const ledgerDefaults = () => ({
  base: 0,
  serverBase: 0,
  reservations: {},
  pendingRefunds: {},
  transactions: [],
  lastUpdated: null,
});

let ledger = ledgerDefaults();
let loaded = false;
let initializedUI = false;
let modalElement;

const hasStorage = () => {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
};

const normalizeReservation = (value = {}) => {
  const amount = Math.max(0, Number(value.amount) || 0);
  let serverHeld = Math.max(0, Number(value.serverHeld) || 0);
  if (serverHeld > amount) {
    serverHeld = amount;
  }

  let status;
  switch (value.status) {
    case "won":
      status = "won";
      break;
    case "held":
    case "server":
      status = "held";
      break;
    case "local":
    case "pending":
    case "active":
    default:
      status = serverHeld >= amount ? "held" : "local";
      break;
  }

  return {
    amount,
    serverHeld,
    title: String(value.title || ""),
    status,
    createdAt: value.createdAt || null,
    updatedAt: value.updatedAt || null,
  };
};

const normalizePendingRefund = (value = {}) => ({
  amount: Math.max(0, Number(value.amount) || 0),
  title: String(value.title || ""),
  createdAt: value.createdAt || new Date().toISOString(),
  updatedAt: value.updatedAt || new Date().toISOString(),
});

const ensureLedgerLoaded = () => {
  if (loaded) {
    return;
  }

  if (!hasStorage()) {
    loaded = true;
    return;
  }

  try {
    const raw = localStorage.getItem(LEDGER_STORAGE_KEY);
    if (!raw) {
      loaded = true;
      return;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      loaded = true;
      return;
    }

    const reservations =
      parsed.reservations && typeof parsed.reservations === "object"
        ? Object.fromEntries(
            Object.entries(parsed.reservations).map(([key, value]) => [
              key,
              normalizeReservation(value),
            ]),
          )
        : {};

    const pendingRefunds =
      parsed.pendingRefunds && typeof parsed.pendingRefunds === "object"
        ? Object.fromEntries(
            Object.entries(parsed.pendingRefunds).map(([key, value]) => [
              key,
              normalizePendingRefund(value),
            ]),
          )
        : {};

    const transactions = Array.isArray(parsed.transactions)
      ? parsed.transactions.slice(0, MAX_TRANSACTIONS)
      : [];

    ledger = {
      base: Math.max(0, Number(parsed.base) || 0),
      serverBase: Math.max(0, Number(parsed.serverBase) || 0),
      reservations,
      pendingRefunds,
      transactions,
      lastUpdated: parsed.lastUpdated || null,
    };
  } catch (error) {
    console.warn("Unable to read stored credit ledger", error);
  } finally {
    loaded = true;
  }
};

const reservationEntries = () => {
  ensureLedgerLoaded();
  return Object.values(ledger.reservations || {});
};

const localReservationTotal = () =>
  reservationEntries().reduce((sum, item) => {
    if (!item) {
      return sum;
    }
    const amount = Math.max(0, Number(item.amount) || 0);
    const held = Math.max(0, Number(item.serverHeld) || 0);
    const local = Math.max(0, amount - held);
    return sum + local;
  }, 0);

const pendingRefundEntries = () => {
  ensureLedgerLoaded();
  return Object.values(ledger.pendingRefunds || {});
};

const pendingRefundTotal = () =>
  pendingRefundEntries().reduce(
    (sum, item) => sum + (Number(item?.amount) || 0),
    0,
  );

const updateLedgerBase = () => {
  ledger.base = Math.max(
    0,
    Math.max(0, Number(ledger.serverBase) || 0) + pendingRefundTotal(),
  );
};

const saveLedger = () => {
  if (!hasStorage()) {
    return;
  }

  updateLedgerBase();

  try {
    localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(ledger));
  } catch (error) {
    console.warn("Unable to persist credit ledger", error);
  }
};

export const getAvailableCredits = () => {
  ensureLedgerLoaded();
  return Math.max(
    Number(ledger.serverBase) + pendingRefundTotal() - localReservationTotal(),
    0,
  );
};

const updateStoredAuthCredits = () => {
  ensureLedgerLoaded();
  const auth = getStoredAuth();
  if (!auth?.accessToken) {
    return;
  }

  const available = getAvailableCredits();
  if (auth.credits === available) {
    window.dispatchEvent(
      new CustomEvent("credits:updated", { detail: { available } }),
    );
    return;
  }

  setStoredAuth({ ...auth, credits: available });
  emitAuthChanged();
};

const recordTransaction = ({
  type,
  amount = 0,
  listingId,
  listingTitle,
  description,
}) => {
  ensureLedgerLoaded();

  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: String(type || "update"),
    amount: Number(amount) || 0,
    listingId: listingId || null,
    listingTitle: listingTitle || "",
    description: description || "",
    balanceAfter: getAvailableCredits(),
    timestamp: new Date().toISOString(),
  };

  ledger.transactions = [entry, ...(ledger.transactions || [])].slice(
    0,
    MAX_TRANSACTIONS,
  );
  saveLedger();
};

const describeBalanceSyncReason = (reason) =>
  reason ? String(reason) : "Balance synchronized";

const ensureReservationRecord = (listingId) => {
  ensureLedgerLoaded();
  if (!listingId) {
    return undefined;
  }

  if (!ledger.reservations[listingId]) {
    const now = new Date().toISOString();
    ledger.reservations[listingId] = {
      amount: 0,
      serverHeld: 0,
      title: "",
      status: "local",
      createdAt: now,
      updatedAt: now,
    };
  }

  return ledger.reservations[listingId];
};

const ensurePendingRefundRecord = (listingId) => {
  ensureLedgerLoaded();
  if (!listingId) {
    return undefined;
  }

  if (!ledger.pendingRefunds || typeof ledger.pendingRefunds !== "object") {
    ledger.pendingRefunds = {};
  }

  if (!ledger.pendingRefunds[listingId]) {
    const now = new Date().toISOString();
    ledger.pendingRefunds[listingId] = {
      amount: 0,
      title: "",
      createdAt: now,
      updatedAt: now,
    };
  }

  return ledger.pendingRefunds[listingId];
};

const clearPendingRefund = (listingId) => {
  if (!listingId || !ledger.pendingRefunds) {
    return;
  }
  if (ledger.pendingRefunds[listingId]) {
    delete ledger.pendingRefunds[listingId];
  }
};

export const setBaseCredits = (value, { reason } = {}) => {
  ensureLedgerLoaded();

  const previousAvailable = getAvailableCredits();

  const newServer = Math.max(0, Number(value) || 0);
  const previousServer = Math.max(0, Number(ledger.serverBase) || 0);
  const deltaServer = newServer - previousServer;
  const now = new Date().toISOString();

  if (deltaServer < 0) {
    let remaining = Math.abs(deltaServer);
    const entries = Object.entries(ledger.reservations || {})
      .filter(([, res]) => res)
      .sort(([, a], [, b]) =>
        String(a.updatedAt || a.createdAt || "").localeCompare(
          String(b.updatedAt || b.createdAt || ""),
        ),
      );

    for (const [, res] of entries) {
      if (remaining <= 0) {
        break;
      }
      const amount = Math.max(0, Number(res?.amount) || 0);
      const held = Math.max(0, Number(res?.serverHeld) || 0);
      const localPending = Math.max(0, amount - held);
      if (!localPending) {
        continue;
      }
      const consume = Math.min(localPending, remaining);
      res.serverHeld = Math.min(amount, held + consume);
      if (res.status !== "won") {
        res.status = res.serverHeld >= amount ? "held" : "local";
      }
      res.updatedAt = now;
      remaining -= consume;
    }
  } else if (deltaServer > 0) {
    let remaining = deltaServer;
    const entries = Object.entries(ledger.pendingRefunds || {}).sort(
      ([, a], [, b]) =>
        String(a.createdAt || "").localeCompare(String(b.createdAt || "")),
    );

    for (const [listingId, entry] of entries) {
      if (remaining <= 0) {
        break;
      }
      const current = Math.max(0, Number(entry?.amount) || 0);
      if (!current) {
        delete ledger.pendingRefunds[listingId];
        continue;
      }
      const consume = Math.min(current, remaining);
      const updated = current - consume;
      remaining -= consume;
      if (updated <= 0.0001) {
        delete ledger.pendingRefunds[listingId];
      } else {
        ledger.pendingRefunds[listingId] = {
          ...entry,
          amount: updated,
          updatedAt: now,
        };
      }
    }
  }

  ledger.serverBase = newServer;
  ledger.lastUpdated = now;

  const newAvailable = getAvailableCredits();
  const delta = newAvailable - previousAvailable;

  if (delta !== 0 || !ledger.transactions.length) {
    recordTransaction({
      type: "balance-sync",
      amount: delta,
      description: describeBalanceSyncReason(reason),
    });
  } else {
    saveLedger();
  }

  updateStoredAuthCredits();
};

export const getReservationAmount = (listingId) => {
  ensureLedgerLoaded();
  if (!listingId) {
    return 0;
  }

  const reservation = ledger.reservations[listingId];
  return Number(reservation?.amount) || 0;
};

export const canAffordBid = (listingId, amount) => {
  ensureLedgerLoaded();

  const normalized = Math.max(0, Number(amount) || 0);
  const reservation = listingId ? ledger.reservations[listingId] : undefined;
  const serverHeld = Math.max(0, Number(reservation?.serverHeld) || 0);
  const previousAmount = Math.max(0, Number(reservation?.amount) || 0);
  const previousLocal = Math.max(0, previousAmount - serverHeld);
  const newLocal = Math.max(0, normalized - serverHeld);
  const deltaLocal = newLocal - previousLocal;
  const available = getAvailableCredits();

  return {
    ok: deltaLocal <= available && normalized > 0,
    available,
    required: normalized,
    deficit: deltaLocal > available ? deltaLocal - available : 0,
    delta: deltaLocal,
  };
};

export const applyBidReservation = ({ listingId, amount, listingTitle }) => {
  ensureLedgerLoaded();

  const normalized = Math.max(0, Math.floor(Number(amount) || 0));
  if (!listingId || !normalized) {
    return { ok: false, reason: "invalid" };
  }

  const reservation = ensureReservationRecord(listingId);
  if (!reservation) {
    return { ok: false, reason: "invalid" };
  }

  if (reservation.status === "won") {
    return { ok: true, locked: true };
  }

  const now = new Date().toISOString();
  const previousAmount = Math.max(0, Number(reservation.amount) || 0);
  const previousHeld = Math.max(0, Number(reservation.serverHeld) || 0);
  const previousLocal = Math.max(0, previousAmount - previousHeld);

  reservation.amount = normalized;
  reservation.title = listingTitle || reservation.title || "";
  reservation.updatedAt = now;
  if (!reservation.createdAt) {
    reservation.createdAt = now;
  }

  reservation.serverHeld = Math.min(
    reservation.amount,
    Math.max(0, Number(reservation.serverHeld) || 0),
  );

  const newLocal = Math.max(0, reservation.amount - reservation.serverHeld);
  const deltaLocal = newLocal - previousLocal;

  reservation.status =
    reservation.serverHeld >= reservation.amount ? "held" : "local";

  clearPendingRefund(listingId);

  if (deltaLocal !== 0) {
    recordTransaction({
      type: "bid-reserve",
      amount: -deltaLocal,
      listingId,
      listingTitle: reservation.title,
      description: deltaLocal > 0 ? "Bid placed" : "Bid adjusted",
    });
  } else {
    saveLedger();
  }

  updateStoredAuthCredits();
  return { ok: true, delta: deltaLocal };
};

export const releaseReservation = ({ listingId, reason, listingTitle }) => {
  ensureLedgerLoaded();
  if (!listingId || !ledger.reservations[listingId]) {
    return { ok: false };
  }

  const reservation = ledger.reservations[listingId];
  if (reservation.status === "won") {
    return { ok: false, reason: "locked" };
  }

  const amount = Math.max(0, Number(reservation.amount) || 0);
  const serverHeld = Math.max(0, Number(reservation.serverHeld) || 0);
  const localPending = Math.max(0, amount - serverHeld);
  const totalReturn = serverHeld + localPending;
  const title = listingTitle || reservation.title || "";
  delete ledger.reservations[listingId];

  if (serverHeld > 0) {
    const pending = ensurePendingRefundRecord(listingId);
    pending.amount = Math.max(0, Number(pending.amount) || 0) + serverHeld;
    pending.title = title;
    pending.updatedAt = new Date().toISOString();
  }

  recordTransaction({
    type: "bid-refund",
    amount: totalReturn,
    listingId,
    listingTitle: title,
    description: reason || "Bid refunded",
  });

  updateStoredAuthCredits();
  return { ok: true, amount: totalReturn };
};

export const markReservationAsWon = ({ listingId, listingTitle, reason }) => {
  ensureLedgerLoaded();
  if (!listingId || !ledger.reservations[listingId]) {
    return { ok: false };
  }

  const reservation = ledger.reservations[listingId];
  if (reservation.status === "won") {
    return { ok: true, unchanged: true };
  }

  reservation.status = "won";
  reservation.updatedAt = new Date().toISOString();
  if (!reservation.title && listingTitle) {
    reservation.title = listingTitle;
  }

  recordTransaction({
    type: "bid-won",
    amount: 0,
    listingId,
    listingTitle: reservation.title || listingTitle,
    description: reason || "Auction won",
  });
  updateStoredAuthCredits();

  return { ok: true };
};

const highestBidInfo = (listing) => {
  if (!listing) {
    return undefined;
  }

  const bids = Array.isArray(listing.bids) ? listing.bids : [];
  let highestAmount = 0;
  let highestBidder = "";

  bids.forEach((bid) => {
    const amount = Number(bid?.amount);
    if (!Number.isFinite(amount)) {
      return;
    }

    if (amount >= highestAmount) {
      highestAmount = amount;
      const bidderName =
        bid?.bidder?.name || bid?.bidderName || bid?.bidder?.username || "";
      highestBidder = bidderName;
    }
  });

  if (
    Number.isFinite(Number(listing?.highestBid?.amount)) &&
    Number(listing.highestBid.amount) > highestAmount
  ) {
    highestAmount = Number(listing.highestBid.amount);
    highestBidder =
      listing.highestBid.bidderName || listing.highestBid.bidder?.name || "";
  }

  return {
    amount: highestAmount,
    bidderName: highestBidder,
  };
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
  ensureLedgerLoaded();
  if (!listing?.id) {
    return;
  }

  const auth = getStoredAuth();
  const userName = currentUserName || auth?.name || "";
  const listingId = listing.id;
  const reservation = ledger.reservations[listingId];
  const highest = highestBidInfo(listing);
  const ended = listingHasEnded(listing);

  if (!userName) {
    if (reservation) {
      releaseReservation({
        listingId,
        listingTitle: reservation.title || listing.title,
        reason: "Signed out",
      });
    }
    return;
  }

  if (!highest?.amount || !highest.bidderName) {
    if (reservation) {
      releaseReservation({
        listingId,
        listingTitle: reservation.title || listing.title,
        reason: ended ? "Auction ended" : "No active bids",
      });
    }
    return;
  }

  if (highest.bidderName === userName) {
    applyBidReservation({
      listingId,
      amount: highest.amount,
      listingTitle: listing.title,
    });

    if (ended) {
      markReservationAsWon({
        listingId,
        listingTitle: listing.title,
        reason: "Auction won",
      });
    }

    return;
  }

  if (reservation) {
    releaseReservation({
      listingId,
      listingTitle: reservation.title || listing.title,
      reason: ended ? "Auction ended" : "Outbid",
    });
  }
};

export const reconcileListingsCredits = (listings, currentUserName) => {
  if (!Array.isArray(listings) || !listings.length) {
    return;
  }

  listings.forEach((listing) =>
    reconcileListingCredits(listing, currentUserName),
  );
};

export const getCreditTransactions = () => {
  ensureLedgerLoaded();
  return (ledger.transactions || []).slice();
};

const describeTransaction = (entry) => {
  switch (entry.type) {
    case "bid-reserve":
      return entry.description || "Bid reserved";
    case "bid-refund":
      return entry.description || "Bid refunded";
    case "bid-won":
      return entry.description || "Auction won";
    case "balance-sync":
      return entry.description || "Balance synchronization";
    default:
      return entry.description || "Balance update";
  }
};

const formatAmount = (value) => {
  const formatter = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const formatted = formatter.format(Math.abs(Math.round(value)));
  return `${value >= 0 ? "+" : "−"}${formatted} credits`;
};

const formatTimestamp = (iso) => {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const renderHistoryList = (container, transactions) => {
  container.innerHTML = "";

  if (!transactions.length) {
    const empty = document.createElement("li");
    empty.className =
      "rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500";
    empty.textContent =
      "No credit activity yet. Place a bid to see it appear here.";
    container.append(empty);
    return;
  }

  transactions.forEach((entry) => {
    const item = document.createElement("li");
    item.className =
      "flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm";

    const main = document.createElement("div");
    main.className = "flex-1";

    const heading = document.createElement("p");
    heading.className = "text-sm font-semibold text-slate-900";
    heading.textContent = describeTransaction(entry);
    main.append(heading);

    if (entry.listingTitle) {
      const subtitle = document.createElement("p");
      subtitle.className = "text-xs text-slate-500";
      subtitle.textContent = entry.listingTitle;
      main.append(subtitle);
    }

    const timestamp = document.createElement("p");
    timestamp.className = "mt-1 text-xs text-slate-400";
    timestamp.textContent = formatTimestamp(entry.timestamp);
    main.append(timestamp);

    const metrics = document.createElement("div");
    metrics.className = "text-right";

    const amount = document.createElement("p");
    amount.className =
      entry.amount >= 0
        ? "text-sm font-semibold text-emerald-600"
        : "text-sm font-semibold text-rose-600";
    amount.textContent = formatAmount(entry.amount);
    metrics.append(amount);

    const balance = document.createElement("p");
    balance.className = "text-xs text-slate-500";
    balance.textContent = `Balance ${new Intl.NumberFormat().format(
      Math.max(0, Math.round(entry.balanceAfter)),
    )}`;
    metrics.append(balance);

    item.append(main);
    item.append(metrics);
    container.append(item);
  });
};

const closeHistoryModal = () => {
  if (!modalElement) {
    return;
  }

  modalElement.remove();
  modalElement = undefined;
  document.body.classList.remove("overflow-hidden");
};

const openHistoryModal = () => {
  ensureLedgerLoaded();
  closeHistoryModal();

  const overlay = document.createElement("div");
  overlay.className =
    "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");

  const container = document.createElement("div");
  container.className =
    "relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-lg";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className =
    "absolute right-4 top-4 inline-flex items-center justify-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500";
  closeButton.textContent = "Close";
  closeButton.addEventListener("click", closeHistoryModal);

  const title = document.createElement("h2");
  title.className = "text-lg font-semibold text-slate-900";
  title.textContent = "Credit activity";

  const subtitle = document.createElement("p");
  subtitle.className = "mt-1 text-sm text-slate-600";
  subtitle.textContent = `Available: ${new Intl.NumberFormat().format(
    getAvailableCredits(),
  )} credits`;

  const list = document.createElement("ul");
  list.className = "mt-4 flex max-h-80 flex-col gap-3 overflow-y-auto";
  renderHistoryList(list, ledger.transactions || []);

  container.append(closeButton, title, subtitle, list);
  overlay.append(container);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeHistoryModal();
    }
  });

  window.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        closeHistoryModal();
      }
    },
    { once: true },
  );

  document.body.append(overlay);
  document.body.classList.add("overflow-hidden");
  closeButton.focus();

  modalElement = overlay;
};

const creditElementKeydown = (event) => {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }
  event.preventDefault();
  openHistoryModal();
};

const enhanceCreditElements = () => {
  document
    .querySelectorAll("[data-user-credits], [data-profile-credits]")
    .forEach((element) => {
      if (element.dataset.creditHistoryBound === "true") {
        return;
      }

      element.dataset.creditHistoryBound = "true";
      element.setAttribute("role", "button");
      element.setAttribute("tabindex", "0");
      element.classList.add("cursor-pointer");
      element.setAttribute("title", "View credit activity");
      element.addEventListener("click", openHistoryModal);
      element.addEventListener("keydown", creditElementKeydown);
    });
};

const handleAuthChanged = () => {
  const auth = getStoredAuth();
  if (!auth?.accessToken) {
    ledger = ledgerDefaults();
    saveLedger();
    closeHistoryModal();
  }

  window.requestAnimationFrame(enhanceCreditElements);
};

const handleExternalCreditSync = (event) => {
  const value = Number(event?.detail?.credits);
  if (!Number.isFinite(value)) {
    return;
  }

  const reason = event?.detail?.source
    ? `Synced from ${event.detail.source}`
    : "External balance sync";

  setBaseCredits(value, { reason });
};

export const initCreditSystem = () => {
  ensureLedgerLoaded();

  if (initializedUI) {
    window.requestAnimationFrame(enhanceCreditElements);
    return () => {};
  }

  initializedUI = true;
  enhanceCreditElements();

  window.addEventListener("auth:changed", handleAuthChanged);
  window.addEventListener("credits:updated", enhanceCreditElements);
  window.addEventListener("credits:sync:base", handleExternalCreditSync);

  return () => {
    window.removeEventListener("auth:changed", handleAuthChanged);
    window.removeEventListener("credits:updated", enhanceCreditElements);
    window.removeEventListener("credits:sync:base", handleExternalCreditSync);
  };
};
