/* eslint-env browser */

import { clearStoredAuth, emitAuthChanged, getStoredAuth } from "./api.js";
import { initCreditSystem } from "./credits.js";

const updateCurrentYear = () => {
  const yearElement = document.querySelector("[data-year]");

  if (yearElement) {
    yearElement.textContent = String(new Date().getFullYear());
  }
};

const toggleElements = (selector, shouldShow) => {
  document.querySelectorAll(selector).forEach((element) => {
    element.hidden = !shouldShow;
  });
};

const updateProfileLinks = (auth) => {
  const profileLinks = document.querySelectorAll("[data-profile-link]");

  profileLinks.forEach((link) => {
    const href = link.getAttribute("href") || "./profile.html";
    const url = new URL(href, window.location.href);

    if (auth?.name) {
      url.searchParams.set("name", auth.name);
    } else {
      url.searchParams.delete("name");
    }

    link.setAttribute("href", `${url.pathname}${url.search}${url.hash}`);
  });
};

const updateUserBadges = (auth) => {
  const nameElements = document.querySelectorAll("[data-user-name]");
  nameElements.forEach((element) => {
    element.textContent = auth?.name ?? "";
  });

  const creditElements = document.querySelectorAll("[data-user-credits]");
  if (creditElements.length) {
    const credits = Number(auth?.credits);
    const amount = Number.isFinite(credits) ? Math.max(0, credits) : 0;
    const formatted = new Intl.NumberFormat().format(amount);

    creditElements.forEach((element) => {
      element.hidden = false;
      element.innerHTML = [
        `<span class="text-sm font-semibold text-[#B7791F]">${formatted}</span>`,
        '<span class="relative inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 via-amber-300 to-amber-500 shadow-inner shadow-amber-600/40">',
        '  <span class="absolute inset-[2px] rounded-full bg-gradient-to-br from-amber-50 via-amber-200 to-amber-400"></span>',
        '  <span class="relative text-xs font-semibold text-[#6B3F00]">&cent;</span>',
        "</span>",
        '<span class="sr-only">credits</span>',
      ].join("");
      element.classList.add("inline-flex", "items-center", "gap-2");
    });
  }
};

const updateAuthUI = () => {
  const auth = getStoredAuth();
  const signedIn = Boolean(auth?.accessToken);

  toggleElements('[data-auth="signed-in"]', signedIn);
  toggleElements('[data-auth="signed-out"]', !signedIn);
  updateProfileLinks(auth);
  updateUserBadges(auth);
};

const bindLogoutButtons = () => {
  const buttons = Array.from(document.querySelectorAll("[data-logout]"));

  const handleClick = (event) => {
    event.preventDefault();
    clearStoredAuth();
    emitAuthChanged();
  };

  buttons.forEach((button) => button.addEventListener("click", handleClick));

  return () => {
    buttons.forEach((button) =>
      button.removeEventListener("click", handleClick),
    );
  };
};

const bindNavigationToggle = () => {
  const toggles = Array.from(document.querySelectorAll("[data-nav-toggle]"));
  const navigation = document.querySelector("[data-nav]");

  if (!navigation || !toggles.length) {
    return () => {};
  }

  const mediaQuery = window.matchMedia("(min-width: 768px)");
  let expanded = false;

  const updateVisibility = () => {
    if (mediaQuery.matches || expanded) {
      navigation.classList.remove("hidden");
    } else {
      navigation.classList.add("hidden");
    }
  };

  const setExpanded = (value) => {
    expanded = Boolean(value);
    toggles.forEach((toggle) =>
      toggle.setAttribute("aria-expanded", expanded ? "true" : "false"),
    );
    updateVisibility();
  };

  const handleToggleClick = () => {
    setExpanded(!expanded);
  };

  const handleMediaChange = () => {
    if (mediaQuery.matches) {
      setExpanded(false);
    } else {
      updateVisibility();
    }
  };

  const addMediaListener = () => {
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleMediaChange);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(handleMediaChange);
    }
  };

  const removeMediaListener = () => {
    if (typeof mediaQuery.removeEventListener === "function") {
      mediaQuery.removeEventListener("change", handleMediaChange);
    } else if (typeof mediaQuery.removeListener === "function") {
      mediaQuery.removeListener(handleMediaChange);
    }
  };

  const handleNavigationClick = (event) => {
    if (mediaQuery.matches || !expanded) {
      return;
    }

    const trigger = event.target.closest("a, button");
    if (trigger) {
      setExpanded(false);
    }
  };

  toggles.forEach((toggle) =>
    toggle.addEventListener("click", handleToggleClick),
  );
  addMediaListener();
  navigation.addEventListener("click", handleNavigationClick);

  setExpanded(false);
  updateVisibility();

  return () => {
    toggles.forEach((toggle) =>
      toggle.removeEventListener("click", handleToggleClick),
    );
    removeMediaListener();
    navigation.removeEventListener("click", handleNavigationClick);
  };
};

export const initPageChrome = () => {
  updateCurrentYear();
  updateAuthUI();
  const unbindLogout = bindLogoutButtons();
  const unbindNavigation = bindNavigationToggle();
  const unbindCredits = initCreditSystem();

  const handleAuthChanged = () => {
    updateAuthUI();
  };

  window.addEventListener("auth:changed", handleAuthChanged);

  return () => {
    window.removeEventListener("auth:changed", handleAuthChanged);
    unbindLogout();
    unbindNavigation();
    if (typeof unbindCredits === "function") {
      unbindCredits();
    }
  };
};

export const renderCount = (target, count) => {
  if (!target) {
    return;
  }

  const formatted = new Intl.NumberFormat().format(count);
  const assign = (element) => {
    if (element) {
      element.textContent = formatted;
    }
  };

  if (typeof target.forEach === "function" && !target.nodeType) {
    target.forEach(assign);
    return;
  }

  assign(target);
};

export const formatDate = (value) => {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};
