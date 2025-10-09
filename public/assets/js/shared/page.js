const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");

const syncThemeWithPreference = () => {
  document.body.classList.toggle("theme--dark", prefersDarkScheme.matches);
};

const registerThemeListeners = () => {
  if (typeof prefersDarkScheme.addEventListener === "function") {
    prefersDarkScheme.addEventListener("change", syncThemeWithPreference);
    return () =>
      prefersDarkScheme.removeEventListener("change", syncThemeWithPreference);
  }

  if (typeof prefersDarkScheme.addListener === "function") {
    prefersDarkScheme.addListener(syncThemeWithPreference);
    return () => prefersDarkScheme.removeListener(syncThemeWithPreference);
  }

  return undefined;
};

const updateCurrentYear = () => {
  const yearElement = document.querySelector("[data-year]");

  if (yearElement) {
    yearElement.textContent = String(new Date().getFullYear());
  }
};

export const initPageChrome = () => {
  syncThemeWithPreference();
  const unregister = registerThemeListeners();
  updateCurrentYear();

  return () => {
    if (typeof unregister === "function") {
      unregister();
    }
  };
};

export const renderCount = (element, count) => {
  if (!element) {
    return;
  }

  element.textContent = new Intl.NumberFormat().format(count);
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
  }).format(date);
};
