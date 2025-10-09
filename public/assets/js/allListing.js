import { listingSeedData } from "./shared/data.js";
import { formatDate, initPageChrome, renderCount } from "./shared/page.js";

const teardown = initPageChrome();

const listings = listingSeedData;

const listElement = document.querySelector("[data-listings]");
const filterForm = document.querySelector("[data-filter-form]");
const resultsCount = document.querySelector("[data-results-count]");

const renderListings = (items) => {
  if (!listElement) {
    return;
  }

  listElement.innerHTML = "";

  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const listItem = document.createElement("li");
    listItem.innerHTML = `
      <article>
        <header class="card__header">
          <h3>${item.title}</h3>
          <span class="card__meta">${item.status}</span>
        </header>
        <p>${item.description}</p>
        <dl class="definition-list">
          <div>
            <dt>Category</dt>
            <dd>${item.category}</dd>
          </div>
          <div>
            <dt>Deadline</dt>
            <dd>${formatDate(item.deadline)}</dd>
          </div>
        </dl>
        <p><a href="./listing.html?id=${encodeURIComponent(item.id)}">View details</a></p>
      </article>
    `;

    fragment.append(listItem);
  });

  listElement.append(fragment);
  renderCount(resultsCount, items.length);
};

const applyFilters = () => {
  if (!filterForm) {
    renderListings(listings);
    return;
  }

  const formData = new FormData(filterForm);
  const query = String(formData.get("query") ?? "").toLowerCase();
  const category = String(formData.get("category") ?? "");

  const filtered = listings.filter((listing) => {
    const matchesQuery = query
      ? listing.title.toLowerCase().includes(query) ||
        listing.description.toLowerCase().includes(query)
      : true;
    const matchesCategory = category ? listing.category === category : true;

    return matchesQuery && matchesCategory;
  });

  renderListings(filtered);
};

if (filterForm) {
  filterForm.addEventListener("input", applyFilters);
  filterForm.addEventListener("change", applyFilters);
}

renderListings(listings);

window.addEventListener("unload", () => {
  if (typeof teardown === "function") {
    teardown();
  }
});
