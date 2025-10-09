import { profileSeedData } from "./shared/data.js";
import { initPageChrome, renderCount } from "./shared/page.js";

const teardown = initPageChrome();

const nameElement = document.querySelector("[data-profile-name]");
const emailElement = document.querySelector("[data-profile-email]");
const activeElement = document.querySelector("[data-profile-active]");
const completedElement = document.querySelector("[data-profile-completed]");

if (nameElement) {
  nameElement.textContent = profileSeedData.name;
}

if (emailElement) {
  emailElement.textContent = profileSeedData.email;
}

renderCount(activeElement, profileSeedData.stats.active);
renderCount(completedElement, profileSeedData.stats.completed);

window.addEventListener("unload", () => {
  if (typeof teardown === "function") {
    teardown();
  }
});
