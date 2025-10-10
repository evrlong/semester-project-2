/* eslint-env browser */

const API_BASE_URL = "https://v2.api.noroff.dev";
const API_KEY = "ec37bd36-f4e0-48b8-915f-f96d6f959477";
const STORAGE_KEY = "auction-house-auth";

const readJSON = (value) => {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn("Unable to parse stored auth payload", error);
    return undefined;
  }
};

export const getStoredAuth = () => {
  if (typeof localStorage === "undefined") {
    return undefined;
  }

  return readJSON(localStorage.getItem(STORAGE_KEY));
};

export const setStoredAuth = (payload) => {
  if (typeof localStorage === "undefined") {
    return;
  }

  if (!payload) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

export const clearStoredAuth = () => {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
};

const extractErrorMessage = async (response) => {
  try {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return response.statusText || "Request failed";
    }

    const body = await response.json();

    if (body?.errors?.length) {
      return body.errors.map((item) => item.message).join(". ");
    }

    if (body?.error?.message) {
      return body.error.message;
    }

    if (body?.message) {
      return body.message;
    }

    return response.statusText || "Request failed";
  } catch {
    return response.statusText || "Request failed";
  }
};

const getToken = () => getStoredAuth()?.accessToken;

export const request = async (
  path,
  { method = "GET", body, signal, headers = {}, requireAuth = false } = {},
) => {
  const token = getToken();

  if (requireAuth && !token) {
    throw new Error("You must be logged in to perform this action.");
  }

  const requestHeaders = new Headers({
    "X-Noroff-API-Key": API_KEY,
    ...headers,
  });

  if (body && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: requestHeaders,
    signal,
  });

  if (!response.ok) {
    const message = await extractErrorMessage(response);
    throw new Error(message || "Request failed");
  }

  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return undefined;
  }

  return response.json();
};

const buildQuery = (params) => {
  if (!params) {
    return "";
  }

  if (typeof params === "string") {
    return params.startsWith("?") ? params : `?${params}`;
  }

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, item));
      return;
    }

    searchParams.set(key, value);
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
};

export const registerUser = (payload) =>
  request("/auth/register", {
    method: "POST",
    body: payload,
    requireAuth: false,
  });

export const loginUser = (payload) =>
  request("/auth/login", { method: "POST", body: payload, requireAuth: false });

export const getListings = (params) =>
  request(`/auction/listings${buildQuery(params)}`, { requireAuth: false });

export const searchListings = (query, params) => {
  const queryString =
    typeof params === "string" || !params ? params : { ...params };
  const suffix = buildQuery(queryString);
  const connector = suffix ? `&${suffix.replace(/^[?&]/, "")}` : "";
  return request(
    `/auction/listings/search?q=${encodeURIComponent(query)}${connector}`,
    {
      requireAuth: false,
    },
  );
};

export const getListing = (id, params) =>
  request(`/auction/listings/${encodeURIComponent(id)}${buildQuery(params)}`, {
    requireAuth: false,
  });

export const getProfile = (name, params) =>
  request(`/auction/profiles/${encodeURIComponent(name)}${buildQuery(params)}`);

export const updateProfile = (name, payload) =>
  request(`/auction/profiles/${encodeURIComponent(name)}`, {
    method: "PUT",
    body: payload,
    requireAuth: true,
  });

export const getProfileListings = (name, params) =>
  request(
    `/auction/profiles/${encodeURIComponent(name)}/listings${buildQuery(params)}`,
  );

export const getProfileWins = (name, params) =>
  request(
    `/auction/profiles/${encodeURIComponent(name)}/wins${buildQuery(params)}`,
  );

export const createListing = (payload) =>
  request("/auction/listings", {
    method: "POST",
    body: payload,
    requireAuth: true,
  });

export const updateListing = (id, payload) =>
  request(`/auction/listings/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: payload,
    requireAuth: true,
  });

export const deleteListing = (id) =>
  request(`/auction/listings/${encodeURIComponent(id)}`, {
    method: "DELETE",
    requireAuth: true,
  });

export const createBid = (id, payload) =>
  request(`/auction/listings/${encodeURIComponent(id)}/bids`, {
    method: "POST",
    body: payload,
    requireAuth: true,
  });

export const emitAuthChanged = () => {
  window.dispatchEvent(new CustomEvent("auth:changed"));
};
