/* ReverseKart minimal auth client (no frameworks) */

const STORAGE_KEY = "reversekart_auth";
const REQUESTS_KEY = "reversekart_requests";
const DEFAULT_API_ORIGIN = "http://localhost:5000";
let PRODUCT_CACHE = [];
let requestRefreshTimer = null;
let activeCategory = "";
let CATEGORY_DATA = {};
let currentDealProduct = null;

const CATEGORY_FALLBACK_DATA = {
  mobiles: [
    { _id: "m1", name: "iPhone 13 (128GB) - Blue", price: 52999, category: "Mobiles", image: "./assets/iphone13.jpg", description: "Buyer wants: Like New • Delivery in 3 days" },
    { _id: "m2", name: "Samsung Galaxy S21", price: 55999, category: "Mobiles", image:"./assets/samsungs21.jpg", description: "Buyer wants: New • Original bill preferred" },
  
  ],
  fashion: [
    { _id: "f1", name: "Running Sneakers - Size 9", price: 2499, category: "Fashion", image: "./assets/sneakers.svg", description: "Buyer wants: New • Preferred brand Nike/Adidas" },
  ],
  electronics: [
    { _id: "e1", name: "Gaming Laptop - i7 / 16GB / RTX", price: 74990, category: "Electronics", image: "./assets/laptop.svg", description: "Buyer wants: Used • Warranty preferred" },
  ],
  home: [
    { _id: "h1", name: "Sofa Set - 3+1+1", price: 18500, category: "Home", image: "./assets/sofa.svg", description: "Buyer wants: Used • Nearby pickup" },
  ],
  appliances: [
    { _id: "a1", name: "Front Load Washing Machine", price: 19999, category: "Appliances", image: "./assets/washing-machine.svg", description: "Buyer wants: Like New • Installation required" },
  ],
};

function apiOrigin() {
  // If opened from file://, we must use an absolute backend URL.
  if (window.location.protocol === "file:") return DEFAULT_API_ORIGIN;
  return window.location.origin;
}

function apiUrl(path) {
  const p = String(path || "");
  const base = apiOrigin().replace(/\/+$/, "");
  const suffix = p.startsWith("/") ? p : `/${p}`;
  return `${base}${suffix}`;
}

function $(id) {
  return document.getElementById(id);
}

function setButtonLoading(buttonId, isLoading, loadingText, defaultText) {
  const btn = $(buttonId);
  if (!btn) return;
  btn.disabled = isLoading;
  btn.textContent = isLoading ? loadingText : defaultText;
}

function showError(targetId, message) {
  const el = $(targetId);
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = message;
}

function getFallbackImage(category) {
  const key = String(category || "").toLowerCase();
  if (key === "mobiles") return "./assets/mobile-phone.svg";
  if (key === "fashion") return "./assets/sneakers.svg";
  if (key === "electronics") return "./assets/laptop.svg";
  if (key === "home") return "./assets/sofa.svg";
  if (key === "appliances") return "./assets/washing-machine.svg";
  return "./assets/laptop.svg";
}

function saveAuth(auth) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

function getAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setNavState() {
  const auth = getAuth();
  const login = $("navLogin");
  const logout = $("navLogout");

  if (!login || !logout) return;

  if (auth?.token) {
    const name = auth?.user?.name || "Account";
    login.textContent = name;
    login.href = "#"; // clicking name doesn't open modal when logged in
    logout.hidden = false;
  } else {
    login.textContent = "Login";
    login.href = "#login-modal";
    logout.hidden = true;
  }
}

async function login(email, password) {
  const res = await fetch(apiUrl("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || "Login failed.");
  }

  return data; // { token, user, message }
}

async function register(name, email, password, role) {
  const res = await fetch(apiUrl("/api/auth/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password, role }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || "Registration failed.");
  }

  return data; // { token, user, message }
}

async function createProduct(payload, token) {
  const res = await fetch(apiUrl("/api/products"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || "Could not post item.");
  }
  return data;
}

async function createRequest(payload, token) {
  const res = await fetch(apiUrl("/api/requests"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || "Could not send request.");
  }
  return data;
}

async function fetchProducts() {
  const res = await fetch(apiUrl("/api/products"));
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Could not load products.");
  return data?.products || [];
}

async function fetchBuyerRequests(token) {
  const res = await fetch(apiUrl("/api/requests/buyer"), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Could not load buyer requests.");
  return data?.requests || [];
}

async function fetchSellerRequests(token) {
  const res = await fetch(apiUrl("/api/requests/seller"), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Could not load seller requests.");
  return data?.requests || [];
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function categoryTagClass(category) {
  const c = String(category || "").toLowerCase();
  if (c === "mobiles") return "tag--mobiles";
  if (c === "fashion") return "tag--fashion";
  if (c === "electronics") return "tag--electronics";
  if (c === "home") return "tag--home";
  if (c === "appliances") return "tag--appliances";
  return "tag--electronics";
}

function buildProductCard(product) {
  const name = escapeHtml(product?.name || "Untitled Item");
  const price = Number(product?.price || 0);
  const category = escapeHtml(product?.category || "General");
  const image = escapeHtml(product?.image || getFallbackImage(product?.category));
  const description = escapeHtml(product?.description || "New item posted by seller.");
  const tagClass = categoryTagClass(product?.category);
  const inr = `₹ ${price.toLocaleString("en-IN")}`;
  const productId = escapeHtml(product?._id || "");

  return `
    <article class="card" role="listitem">
      <div class="card__media">
        <img class="card__img" src="${image}" alt="${name}" loading="lazy" />
      </div>
      <div class="card__body">
        <header class="card__top">
          <h3 class="card__title">${name}</h3>
          <span class="tag ${tagClass}">${category}</span>
        </header>
        <p class="card__price">${inr}</p>
        <p class="card__hint">${description}</p>
        <div class="card__actions">
          <a class="btn btn--primary btn--block request-deal-btn" href="#" data-product-id="${productId}">Request Deal</a>
        </div>
      </div>
    </article>
  `;
}

function prependProductCard(product) {
  const grid = $("content");
  if (!grid) return;
  grid.insertAdjacentHTML("afterbegin", buildProductCard(product));
}

function setProducts(products) {
  const grid = $("content");
  if (!grid || !Array.isArray(products) || products.length === 0) return;
  grid.innerHTML = products.map((p) => buildProductCard(p)).join("");
}

function clearContent() {
  const grid = $("content");
  if (!grid) return;
  grid.innerHTML = "";
}

function showPlaceholder() {
  const placeholder = $("logoSection");
  const filters = $("filtersSection");
  const buyer = $("buyerSection");
  const incoming = $("incomingSection");
  if (placeholder) placeholder.style.display = "grid";
  if (filters) filters.style.display = "none";
  if (buyer) buyer.style.display = "none";
  if (incoming) incoming.style.display = "none";
}

function showLoader() {
  const placeholder = $("logoSection");
  const filters = $("filtersSection");
  const buyer = $("buyerSection");
  const incoming = $("incomingSection");
  const loader = $("gridLoader");
  if (placeholder) placeholder.style.display = "none";
  if (filters) filters.style.display = "block";
  if (buyer) buyer.style.display = "grid";
  if (incoming) incoming.style.display = "block";
  if (loader) loader.style.display = "grid";
}

function buildCategoryData(products) {
  const map = {
    mobiles: [],
    fashion: [],
    electronics: [],
    home: [],
    appliances: [],
  };

  products.forEach((p) => {
    const key = String(p.category || "").toLowerCase();
    if (map[key]) map[key].push(p);
  });
  return map;
}

function showGridWithAnimation(items) {
  const grid = $("content");
  const placeholder = $("logoSection");
  const filters = $("filtersSection");
  const buyer = $("buyerSection");
  const incoming = $("incomingSection");
  const loader = $("gridLoader");
  if (!grid) return;

  clearContent();
  if (placeholder) placeholder.style.display = "none";
  if (filters) filters.style.display = "block";
  if (buyer) buyer.style.display = "grid";
  if (incoming) incoming.style.display = "block";
  if (loader) loader.style.display = "none";
  grid.style.display = "grid";
  setProducts(items);
  grid.classList.remove("is-entering");
  // Force reflow to retrigger animation.
  // eslint-disable-next-line no-unused-expressions
  grid.offsetHeight;
  grid.classList.add("is-entering");
}

function renderItems(category) {
  const key = String(category || "").toLowerCase();
  const items = CATEGORY_DATA[key] || [];
  if (!items.length) {
    clearContent();
    showGridWithAnimation([]);
    return;
  }
  showGridWithAnimation(items);
}

function showHome() {
  activeCategory = "";
  const buttons = Array.from(document.querySelectorAll(".category-btn"));
  buttons.forEach((b) => b.classList.remove("is-active"));
  clearContent();
  showPlaceholder();
}

function showCategory(category) {
  activeCategory = category;
  const buttons = Array.from(document.querySelectorAll(".category-btn"));
  buttons.forEach((b) => b.classList.toggle("is-active", (b.dataset.category || "") === category));
  showLoader();
  setTimeout(() => renderItems(category), 300);
}

function showRequestsTab() {
  activeCategory = "";
  const placeholder = $("logoSection");
  const filters = $("filtersSection");
  const buyer = $("buyerSection");
  const incoming = $("incomingSection");
  const loader = $("gridLoader");
  const grid = $("content");

  if (placeholder) placeholder.style.display = "none";
  if (filters) filters.style.display = "block";
  if (buyer) buyer.style.display = "grid";
  if (incoming) incoming.style.display = "block";
  if (loader) loader.style.display = "none";
  if (grid) grid.style.display = "grid";

  const buttons = Array.from(document.querySelectorAll(".category-btn"));
  buttons.forEach((b) => b.classList.remove("is-active"));

  renderRequestsCards();
  renderRequests();
}

function wireCategoryButtons() {
  const buttons = Array.from(document.querySelectorAll(".category-btn"));
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const category = btn.dataset.category || "";
      showCategory(category);
    });
  });
}

function wireHomeButton() {
  const homeBtn = $("navHomeBtn");
  if (!homeBtn) return;
  homeBtn.addEventListener("click", showHome);
}

function wireRequestsButton() {
  const btn = $("navRequestsBtn");
  if (!btn) return;
  btn.addEventListener("click", showRequestsTab);
}

function setRequestDealMessage(message, isError) {
  const el = $("requestDealMessage");
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    el.classList.remove("form-error");
    el.classList.add("form-success");
    return;
  }
  el.hidden = false;
  el.textContent = message;
  if (isError) {
    el.classList.remove("form-success");
    el.classList.add("form-error");
  } else {
    el.classList.remove("form-error");
    el.classList.add("form-success");
  }
}

function prependBuyerRequest(request, product) {
  const list = $("buyerRequestList");
  if (!list) return;

  const p = product || request?.productId || {};
  const name = escapeHtml(p?.name || "Requested item");
  const category = escapeHtml(p?.category || "General");
  const price = Number(p?.price || 0);
  const status = escapeHtml(request?.status || "pending");
  const badgeClass = status === "accepted" ? "badge badge--active" : "badge";
  const label = status.charAt(0).toUpperCase() + status.slice(1);

  const html = `
    <li class="request">
      <div class="request__main">
        <p class="request__name">${name}</p>
        <p class="request__meta">₹ ${price.toLocaleString("en-IN")} • ${category}</p>
      </div>
      <span class="${badgeClass}">${label}</span>
    </li>
  `;
  list.insertAdjacentHTML("afterbegin", html);
}

function paymentLabel(value) {
  if (!value) return "N/A";
  if (value === "upi") return "UPI";
  if (value === "card") return "Card";
  if (value === "bank_transfer") return "Bank Transfer";
  if (value === "cash_on_delivery") return "Cash on Delivery";
  return value;
}

function setRequestsPanelMeta(title, subtitle) {
  const t = $("requestsPanelTitle");
  const s = $("requestsPanelSubtitle");
  if (t) t.textContent = title;
  if (s) s.textContent = subtitle;
}

function getRequests() {
  try {
    const raw = localStorage.getItem(REQUESTS_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function addRequest(requestData) {
  const all = getRequests();
  const entry = {
    id: `rq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    status: "open",
    ...requestData,
  };
  all.unshift(entry);
  localStorage.setItem(REQUESTS_KEY, JSON.stringify(all));
  return entry;
}

function renderRequestsList(requests, role) {
  const list = $("buyerRequestList");
  if (!list) return;
  if (!Array.isArray(requests) || requests.length === 0) {
    list.innerHTML = `
      <li class="request">
        <div class="request__main">
          <p class="request__name">No requests yet</p>
          <p class="request__meta">Your request activity will appear here.</p>
        </div>
        <span class="badge">Empty</span>
      </li>`;
    return;
  }

  list.innerHTML = requests
    .map((r) => {
      const status = String(r.status || "open").toLowerCase();
      const badgeClass = status === "accepted" ? "badge badge--active" : "badge";
      const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

      const line1 = role === "seller"
        ? `${escapeHtml(r.itemName || "Item")} • ${escapeHtml(r.buyerName || "Buyer")}`
        : `${escapeHtml(r.itemName || "Item")} • ${escapeHtml(r.category || "General")}`;

      const offered = r.offeredPrice ? `₹ ${Number(r.offeredPrice).toLocaleString("en-IN")}` : "N/A";
      const pay = paymentLabel(r.paymentMethod);
      const buyerMeta = role === "seller" ? ` • ${escapeHtml(r.buyerEmail || "No email")}` : "";
      const line2 = `Offer: ${offered} • ${pay}${buyerMeta}`;

      return `
        <li class="request">
          <div class="request__main">
            <p class="request__name">${line1}</p>
            <p class="request__meta">${line2}</p>
          </div>
          <span class="${badgeClass}">${statusLabel}</span>
        </li>
      `;
    })
    .join("");
}

function renderRequests() {
  const auth = getAuth();
  const all = getRequests();
  if (!auth?.user?.role) {
    renderRequestsList([], "buyer");
    return;
  }

  const role = auth.user.role;
  if (role === "seller") {
    setRequestsPanelMeta("Incoming Requests", "Buyer details and payment preferences");
    renderRequestsList(all, "seller");
  } else {
    setRequestsPanelMeta("Your Requests", "Items you've asked sellers for");
    renderRequestsList(all.filter((r) => r.buyerId === auth.user.id), "buyer");
  }
}

function renderRequestsCards() {
  const requests = getRequests();
  const cards = requests.map((r) => {
    const image = escapeHtml(r.image || getFallbackImage(r.category));
    const name = escapeHtml(r.itemName || "Requested item");
    const category = escapeHtml(r.category || "General");
    const price = Number(r.offeredPrice || r.price || 0);
    const status = String(r.status || "open").toLowerCase();
    const badge = status === "accepted" ? "tag tag--electronics" : "tag tag--mobiles";
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
    return `
      <article class="card" role="listitem">
        <div class="card__media"><img class="card__img" src="${image}" alt="${name}" loading="lazy" /></div>
        <div class="card__body">
          <header class="card__top">
            <h3 class="card__title">${name}</h3>
            <span class="${badge}">${statusLabel}</span>
          </header>
          <p class="card__price">₹ ${price.toLocaleString("en-IN")}</p>
          <p class="card__hint">${category} • ${paymentLabel(r.paymentMethod)}</p>
        </div>
      </article>
    `;
  });

  const grid = $("content");
  if (!grid) return;
  clearContent();
  grid.innerHTML = cards.length ? cards.join("") : `
    <article class="card" role="listitem">
      <div class="card__body">
        <h3 class="card__title">No requests found</h3>
        <p class="card__hint">Buyer deals will appear here once created.</p>
      </div>
    </article>`;
}

function closeModal() {
  // CSS modals are opened with :target (#login-modal, #register-modal, etc.)
  // Clear hash in a cross-browser-safe way.
  if (!location.hash) return;
  const cleanUrl = `${window.location.pathname}${window.location.search}`;
  if (history.replaceState) {
    history.replaceState(null, document.title, cleanUrl);
  } else {
    window.location.hash = "";
  }

  // Remove focus from active inputs/buttons inside modal for a cleaner close.
  if (document.activeElement && typeof document.activeElement.blur === "function") {
    document.activeElement.blur();
  }
}

function wireLoginForm() {
  const form = $("loginForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError("loginError", "");

    const email = $("loginEmail")?.value?.trim() || "";
    const password = $("loginPassword")?.value || "";

    if (!email || !password) {
      showError("loginError", "Please enter email and password.");
      return;
    }

    try {
      setButtonLoading("loginSubmit", true, "Logging in...", "Login");
      const result = await login(email, password);
      saveAuth({ token: result.token, user: result.user });
      setNavState();
      await loadRequestsByRole();
      startRequestAutoRefresh();
      // Small delay helps browsers repaint before hash update.
      setTimeout(closeModal, 60);
    } catch (err) {
      const msg = err?.message || "Login failed.";
      if (msg.toLowerCase().includes("failed to fetch")) {
        showError(
          "loginError",
          `Could not reach the API. Start the backend with "npm start" and open the site at ${DEFAULT_API_ORIGIN}/index.html`
        );
      } else {
        showError("loginError", msg);
      }
    } finally {
      setButtonLoading("loginSubmit", false, "Logging in...", "Login");
    }
  });
}

function wireRegisterForm() {
  const form = $("registerForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError("registerError", "");

    const name = $("regName")?.value?.trim() || "";
    const email = $("regEmail")?.value?.trim() || "";
    const password = $("regPassword")?.value || "";
    const role = $("regRole")?.value || "";

    if (!name || !email || !password || !role) {
      showError("registerError", "Please fill all fields.");
      return;
    }

    try {
      setButtonLoading("registerSubmit", true, "Creating account...", "Register");
      const result = await register(name, email, password, role);
      saveAuth({ token: result.token, user: result.user });
      setNavState();
      await loadRequestsByRole();
      startRequestAutoRefresh();
      setTimeout(closeModal, 60);
    } catch (err) {
      const msg = err?.message || "Registration failed.";
      if (msg.toLowerCase().includes("failed to fetch")) {
        showError(
          "registerError",
          `Could not reach the API. Start the backend with "npm start" and open the site at ${DEFAULT_API_ORIGIN}/index.html`
        );
      } else {
        showError("registerError", msg);
      }
    } finally {
      setButtonLoading("registerSubmit", false, "Creating account...", "Register");
    }
  });
}

function wireLogout() {
  const logout = $("navLogout");
  if (!logout) return;
  logout.addEventListener("click", () => {
    clearAuth();
    setNavState();
    setRequestsPanelMeta("Your Requests", "Items you've asked sellers for");
    renderRequests();
    if (requestRefreshTimer) {
      clearInterval(requestRefreshTimer);
      requestRefreshTimer = null;
    }
  });
}

function wirePostItemForm() {
  const form = $("postItemForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError("postItemError", "");
    showError("postItemSuccess", "");

    const auth = getAuth();
    if (!auth?.token) {
      showError("postItemError", "Please login first.");
      return;
    }
    if (auth?.user?.role !== "seller") {
      showError("postItemError", "Only seller accounts can post items.");
      return;
    }

    const payload = {
      name: $("itemName")?.value?.trim() || "",
      price: Number($("itemPrice")?.value || 0),
      category: $("itemCategory")?.value || "",
      image: $("itemImage")?.value?.trim() || "",
      description: $("itemDescription")?.value?.trim() || "",
    };

    if (!payload.name || !payload.category || !payload.price) {
      showError("postItemError", "Name, price and category are required.");
      return;
    }

    try {
      setButtonLoading("postItemSubmit", true, "Posting item...", "Post Item");
      const result = await createProduct(payload, auth.token);
      PRODUCT_CACHE = [result.product, ...PRODUCT_CACHE];
      CATEGORY_DATA = buildCategoryData(PRODUCT_CACHE);
      activeCategory = result.product.category;
      renderItems(activeCategory);
      showError("postItemSuccess", "Item posted successfully.");
      form.reset();
      setTimeout(closeModal, 500);
    } catch (err) {
      const msg = err?.message || "Could not post item.";
      if (msg.toLowerCase().includes("failed to fetch")) {
        showError(
          "postItemError",
          `Could not reach the API. Start backend with "npm start" and open ${DEFAULT_API_ORIGIN}/index.html`
        );
      } else {
        showError("postItemError", msg);
      }
    } finally {
      setButtonLoading("postItemSubmit", false, "Posting item...", "Post Item");
    }
  });
}

function showCardFeedback(btn, message, isError) {
  // Find or create a feedback element inside the card actions
  const actions = btn.closest(".card__actions");
  if (!actions) return;
  let fb = actions.querySelector(".card__feedback");
  if (!fb) {
    fb = document.createElement("p");
    fb.className = "card__feedback";
    fb.setAttribute("aria-live", "polite");
    actions.appendChild(fb);
  }
  if (!message) {
    fb.hidden = true;
    fb.textContent = "";
    return;
  }
  fb.hidden = false;
  fb.textContent = message;
  fb.className = "card__feedback " + (isError ? "form-error" : "form-success");
}

function wireRequestDealActions() {
  const grid = $("content");
  if (!grid) return;

  grid.addEventListener("click", async (e) => {
    const btn = e.target.closest(".request-deal-btn");
    if (!btn) return;
    e.preventDefault();

    // Reset any previous inline feedback on this card
    showCardFeedback(btn, "", false);
    setRequestDealMessage("", false);

    const auth = getAuth();
    if (!auth?.token) {
      showCardFeedback(btn, "Please login as a buyer to request a deal.", true);
      window.location.hash = "login-modal";
      return;
    }
    if (auth?.user?.role !== "buyer") {
      showCardFeedback(btn, "Only buyer accounts can request deals.", true);
      return;
    }

    const productId = btn.dataset.productId || "";
    if (!productId) {
      showCardFeedback(btn, "Item not synced with backend. Reload once API is running.", true);
      return;
    }
    const card = btn.closest(".card");
    $("dealProductId").value = productId;
    $("dealProductTitle").textContent = card?.querySelector(".card__title")?.textContent || "Selected item";
    $("dealOfferedPrice").value =
      (card?.querySelector(".card__price")?.textContent || "").replace(/[^\d]/g, "") || "";
    currentDealProduct = {
      id: productId,
      itemName: card?.querySelector(".card__title")?.textContent || "Requested item",
      category: card?.querySelector(".tag")?.textContent || "General",
      image: card?.querySelector(".card__img")?.getAttribute("src") || "",
      price: Number((card?.querySelector(".card__price")?.textContent || "0").replace(/[^\d]/g, "")),
    };
    $("dealMessage").value = "";
    showError("dealError", "");
    window.location.hash = "deal-modal";
  });
}

function wireDealForm() {
  const form = $("dealForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError("dealError", "");

    const auth = getAuth();
    if (!auth?.token || auth?.user?.role !== "buyer") {
      showError("dealError", "Only logged-in buyers can send requests.");
      return;
    }

    const payload = {
      productId: $("dealProductId")?.value || "",
      offeredPrice: Number($("dealOfferedPrice")?.value || 0),
      paymentMethod: $("dealPaymentMethod")?.value || "",
      message: $("dealMessage")?.value?.trim() || "",
    };

    if (!payload.productId || !payload.offeredPrice || !payload.paymentMethod) {
      showError("dealError", "Product, offered price and payment method are required.");
      return;
    }

    try {
      setButtonLoading("dealSubmit", true, "Sending request...", "Send Request");
      addRequest({
        buyerId: auth.user.id,
        buyerName: auth.user.name,
        buyerEmail: auth.user.email,
        productId: currentDealProduct?.id || payload.productId,
        itemName: currentDealProduct?.itemName || "Requested item",
        category: currentDealProduct?.category || "General",
        image: currentDealProduct?.image || getFallbackImage(currentDealProduct?.category),
        price: currentDealProduct?.price || payload.offeredPrice,
        offeredPrice: payload.offeredPrice,
        paymentMethod: payload.paymentMethod,
        message: payload.message,
      });
      closeModal();
      setRequestDealMessage("Request sent with payment and buyer details.", false);
      renderRequests();
    } catch (err) {
      const msg = err?.message || "Could not send request.";
      showError("dealError", msg);
    } finally {
      setButtonLoading("dealSubmit", false, "Sending request...", "Send Request");
    }
  });
}

async function loadRequestsByRole() {
  renderRequests();
}

function startRequestAutoRefresh() {
  if (requestRefreshTimer) clearInterval(requestRefreshTimer);
  requestRefreshTimer = setInterval(() => {
    loadRequestsByRole();
  }, 7000);
}

async function loadProductsOnStart() {
  try {
    const products = await fetchProducts();
    PRODUCT_CACHE = products;
    CATEGORY_DATA = buildCategoryData(products);
    clearContent();
    showPlaceholder();
  } catch {
    PRODUCT_CACHE = [
      ...CATEGORY_FALLBACK_DATA.mobiles,
      ...CATEGORY_FALLBACK_DATA.fashion,
      ...CATEGORY_FALLBACK_DATA.electronics,
      ...CATEGORY_FALLBACK_DATA.home,
      ...CATEGORY_FALLBACK_DATA.appliances,
    ];
    CATEGORY_DATA = buildCategoryData(PRODUCT_CACHE);
    clearContent();
    showPlaceholder();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setNavState();
  wireLoginForm();
  wireRegisterForm();
  wireLogout();
  wireRequestsButton();
  wirePostItemForm();
  wireRequestDealActions();
  wireDealForm();
  wireCategoryButtons();
  wireHomeButton();
  loadProductsOnStart();
  loadRequestsByRole();
  startRequestAutoRefresh();
});


/* ── Device Comparison ──────────────────────────────── */

// Each device has a unique real image URL + full specs
const DEVICE_SPECS = [
  {
    id: "iphone13",
    name: "iPhone 13 (128GB)",
    category: "Mobiles",
    price: 42999,
    image: "./assets/iphone13.jpg",
    specs: { "Display": "6.1\" Super Retina XDR OLED", "Processor": "Apple A15 Bionic", "RAM": "4 GB", "Storage": "128 GB", "Rear Camera": "12 MP + 12 MP (dual)", "Front Camera": "12 MP", "Battery": "3227 mAh", "OS": "iOS 15", "5G": "Yes", "Weight": "174 g" },
  },
  {
    id: "samsung-s21",
    name: "Samsung Galaxy S21 (8/128GB)",
    category: "Mobiles",
    price: 39999,
    image: "./assets/samsung.jpg",
    specs: { "Display": "6.2\" Dynamic AMOLED 2X", "Processor": "Exynos 2100", "RAM": "8 GB", "Storage": "128 GB", "Rear Camera": "12 MP + 64 MP + 12 MP", "Front Camera": "10 MP", "Battery": "4000 mAh", "OS": "Android 11", "5G": "Yes", "Weight": "169 g" },
  },
  {
    id: "oneplus9",
    name: "OnePlus 9 (8/128GB)",
    category: "Mobiles",
    price: 36999,
    image: "./assets/oneplus9.jpg",
    specs: { "Display": "6.55\" Fluid AMOLED 120Hz", "Processor": "Snapdragon 888", "RAM": "8 GB", "Storage": "128 GB", "Rear Camera": "48 MP + 50 MP + 2 MP", "Front Camera": "16 MP", "Battery": "4500 mAh", "OS": "Android 11 (OxygenOS)", "5G": "Yes", "Weight": "192 g" },
  },
  {
    id: "pixel7",
    name: "Google Pixel 7 (8/128GB)",
    category: "Mobiles",
    price: 44999,
    image: "./assets/pixel7.jpg",
    specs: { "Display": "6.3\" OLED 90Hz", "Processor": "Google Tensor G2", "RAM": "8 GB", "Storage": "128 GB", "Rear Camera": "50 MP + 12 MP", "Front Camera": "10.8 MP", "Battery": "4355 mAh", "OS": "Android 13", "5G": "Yes", "Weight": "197 g" },
  },
  {
    id: "macbook-air-m1",
    name: "MacBook Air M1 (8GB/256GB)",
    category: "Electronics",
    price: 79900,
    image: "./assets/mackbook.jpg",
    specs: { "Display": "13.3\" IPS Retina 2560×1600", "Processor": "Apple M1 (8-core)", "RAM": "8 GB Unified", "Storage": "256 GB SSD", "GPU": "7-core GPU", "Battery": "Up to 18 hrs", "OS": "macOS", "Weight": "1.29 kg", "Ports": "2× USB-C Thunderbolt" },
  },
  {
    id: "dell-xps15",
    name: "Dell XPS 15 (i7/16GB/512GB)",
    category: "Electronics",
    price: 149900,
    image: "./assets/dell.jpg",
    specs: { "Display": "15.6\" OLED 3.5K 60Hz", "Processor": "Intel Core i7-12700H", "RAM": "16 GB DDR5", "Storage": "512 GB NVMe SSD", "GPU": "NVIDIA RTX 3050 Ti", "Battery": "Up to 12 hrs", "OS": "Windows 11", "Weight": "1.86 kg", "Ports": "2× Thunderbolt 4, USB-A" },
  },
  {
    id: "sony-wh1000xm5",
    name: "Sony WH-1000XM5 Headphones",
    category: "Electronics",
    price: 29990,
    image: "./assets/sony.jpg",
    specs: { "Type": "Over-ear Wireless", "ANC": "Yes (industry-leading)", "Driver": "30 mm", "Battery Life": "30 hrs (ANC on)", "Charging": "USB-C", "Bluetooth": "5.2", "Codecs": "LDAC, AAC, SBC", "Weight": "250 g" },
  },
];

const COMPARE_PLACEHOLDER = "https://via.placeholder.com/200x160/f8f9fb/aaa?text=No+Image";
const HIGHER_IS_BETTER = new Set(["RAM", "Storage", "Battery", "Front Camera", "Rear Camera", "Battery Life"]);
const LOWER_IS_BETTER  = new Set(["Weight"]);

function extractNumber(str) {
  const m = String(str || "").match(/[\d.]+/);
  return m ? parseFloat(m[0]) : null;
}

function populateCompareSelects() {
  const selA = $("compareDeviceA"), selB = $("compareDeviceB");
  if (!selA || !selB) return;
  selA.innerHTML = `<option value="">— Select device —</option>`;
  selB.innerHTML = `<option value="">— Select device —</option>`;
  DEVICE_SPECS.forEach((d) => {
    selA.add(new Option(`${d.name}  (${d.category})`, d.id));
    selB.add(new Option(`${d.name}  (${d.category})`, d.id));
  });
  if (DEVICE_SPECS.length >= 2) {
    selA.value = DEVICE_SPECS[0].id;
    selB.value = DEVICE_SPECS[1].id;
  }
}

// Render one image card into a given element
function renderCompareCard(el, device, side) {
  if (!el) return;
  const imgSrc = device.image || COMPARE_PLACEHOLDER;
  el.innerHTML = `
    <div class="compare__card__img-wrap">
      <img
        src="${imgSrc}"
        alt="${escapeHtml(device.name)}"
        loading="lazy"
        onerror="this.src='${COMPARE_PLACEHOLDER}'"
      />
    </div>
    <div class="compare__card__body">
      <div class="compare__card__cat">${escapeHtml(device.category)} · Device ${escapeHtml(side)}</div>
      <div class="compare__card__name">${escapeHtml(device.name)}</div>
      <div class="compare__card__price">₹ ${device.price.toLocaleString("en-IN")}</div>
    </div>
  `;
}

function buildCompareRow(label, valA, valB) {
  let classB = "compare__td", classC = "compare__td", badgeA = "", badgeB = "";
  const numA = extractNumber(valA), numB = extractNumber(valB);
  if (numA !== null && numB !== null && numA !== numB) {
    const isPrice = label === "Price (₹)";
    let aWins = isPrice ? numA < numB : HIGHER_IS_BETTER.has(label) ? numA > numB : LOWER_IS_BETTER.has(label) ? numA < numB : false;
    let bWins = isPrice ? numB < numA : HIGHER_IS_BETTER.has(label) ? numB > numA : LOWER_IS_BETTER.has(label) ? numB < numA : false;
    if (aWins) { classB += " compare__td--win"; badgeA = `<span class="compare__badge">✓ Better</span>`; }
    else if (bWins) { classC += " compare__td--win-b"; badgeB = `<span class="compare__badge compare__badge--b">✓ Better</span>`; }
  }
  return `<tr>
    <td class="compare__td compare__td--spec">${escapeHtml(label)}</td>
    <td class="${classB}">${escapeHtml(valA)}${badgeA}</td>
    <td class="${classC}">${escapeHtml(valB)}${badgeB}</td>
  </tr>`;
}

// Main comparison renderer — called with two device objects
function renderComparison(devA, devB) {
  // Render image cards
  renderCompareCard($("compareCardA"), devA, "A");
  renderCompareCard($("compareCardB"), devB, "B");
  const cardsEl = $("compareCards");
  if (cardsEl) cardsEl.hidden = false;

  // Table header labels
  const labelA = $("compareLabelA"), labelB = $("compareLabelB");
  if (labelA) labelA.textContent = devA.name;
  if (labelB) labelB.textContent = devB.name;

  // Build spec rows
  const allKeys = Array.from(new Set([...Object.keys(devA.specs), ...Object.keys(devB.specs)]));
  const tbody = $("compareTableBody");
  if (tbody) {
    tbody.innerHTML = [
      buildCompareRow("Price (₹)", `₹ ${devA.price.toLocaleString("en-IN")}`, `₹ ${devB.price.toLocaleString("en-IN")}`),
      ...allKeys.map((k) => buildCompareRow(k, devA.specs[k] || "—", devB.specs[k] || "—")),
    ].join("");
  }

  // Affordability note
  const note = $("compareNote");
  if (note) note.textContent = `💡 ${devA.price <= devB.price ? devA.name : devB.name} is the more affordable option.`;

  // Show result table
  const resultEl = $("compareResult");
  if (resultEl) resultEl.hidden = false;
}

function runComparison() {
  const idA = $("compareDeviceA")?.value;
  const idB = $("compareDeviceB")?.value;

  showError("compareError", "");
  const cardsEl = $("compareCards");
  if (cardsEl) cardsEl.hidden = true;
  const resultEl = $("compareResult");
  if (resultEl) resultEl.hidden = true;

  if (!idA || !idB) { showError("compareError", "Please select both devices."); return; }
  if (idA === idB)  { showError("compareError", "Please select two different devices."); return; }

  const devA = DEVICE_SPECS.find((d) => d.id === idA);
  const devB = DEVICE_SPECS.find((d) => d.id === idB);
  if (!devA || !devB) { showError("compareError", "Device data not found."); return; }

  renderComparison(devA, devB);
}

function wireCompareModal() {
  populateCompareSelects();
  const btn = $("compareBtn");
  if (btn) btn.addEventListener("click", runComparison);
}

document.addEventListener("DOMContentLoaded", () => {
  wireCompareModal();
});
