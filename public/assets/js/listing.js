import { listingSeedData } from "./shared/data.js";
import { formatDate, initPageChrome } from "./shared/page.js";

const teardown = initPageChrome();

const titleElement = document.querySelector("[data-listing-title]");
const statusElement = document.querySelector("[data-listing-status]");
const descriptionElement = document.querySelector("[data-listing-description]");
const ownerElement = document.querySelector("[data-listing-owner]");
const deadlineElement = document.querySelector("[data-listing-deadline]");
const categoryElement = document.querySelector("[data-listing-category]");

const params = new URLSearchParams(window.location.search);
const listingId = params.get("id");

const listing =
  listingSeedData.find((item) => item.id === listingId) ?? listingSeedData[0];

if (listing) {
  if (titleElement) {
    titleElement.textContent = listing.title;
  }

  if (statusElement) {
    statusElement.textContent = listing.status;
  }

  if (descriptionElement) {
    descriptionElement.textContent = listing.description;
  }

  if (ownerElement) {
    ownerElement.textContent = listing.owner;
  }

  if (deadlineElement) {
    deadlineElement.textContent = formatDate(listing.deadline);
  }

  if (categoryElement) {
    categoryElement.textContent = listing.category;
  }
}

window.addEventListener("unload", () => {
  if (typeof teardown === "function") {
    teardown();
  }
});
