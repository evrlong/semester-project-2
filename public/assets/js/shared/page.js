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
    const credits = auth?.credits;
    const formatted =
      typeof credits === "number"
        ? new Intl.NumberFormat().format(credits)
        : "";

    creditElements.forEach((element) => {
      if (formatted) {
        element.textContent = `${formatted} credits`;
        element.hidden = false;
      } else {
        element.textContent = "";
        element.hidden = true;
      }
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
