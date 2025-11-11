// ----- Firebase Config -----
const firebaseConfig = {
  apiKey: "AIzaSyDYHS1cnWFkqJgIHXghInwr73ZodFg722M",
  authDomain: "knottybynaturecrafts-a0874.firebaseapp.com",
  projectId: "knottybynaturecrafts-a0874",
  storageBucket: "knottybynaturecrafts-a0874.firebasestorage.app",
  messagingSenderId: "444510301516",
  appId: "1:444510301516:web:a95c44136ca65adef8f3e9",
  measurementId: "G-Q1SJDXNMHW",
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
firebase.analytics();

const auth = firebase.auth();
const functions = firebase.functions();

// Stripe setup
const STRIPE_PUBLISHABLE_KEY = "pk_test_XXXXXXXXXXXXXXXX";
let stripe = null;
if (STRIPE_PUBLISHABLE_KEY?.startsWith("pk_")) {
  stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
}

// ----- PRODUCTS -----
const PRODUCTS = [
  {
    id: "hat1",
    title: "Cozy Crochet Hat",
    price_cents: 1500,
    image: "https://via.placeholder.com/300/FFC0CB/FFFFFF?text=Hat",
  },
  {
    id: "scarf1",
    title: "Soft Crochet Scarf",
    price_cents: 2000,
    image: "https://via.placeholder.com/300/FFB6C1/FFFFFF?text=Scarf",
  },
  {
    id: "amigurumi1",
    title: "Mini Amigurumi",
    price_cents: 1200,
    image: "https://via.placeholder.com/300/FFD6E3/FFFFFF?text=Amigurumi",
  },
];

// ----- CART -----
function loadCart() {
  try {
    return JSON.parse(localStorage.getItem("knotty_cart") || "[]");
  } catch {
    return [];
  }
}
function saveCart(cart) {
  localStorage.setItem("knotty_cart", JSON.stringify(cart));
}
function cartCount() {
  return loadCart().length;
}

// ----- RENDER PRODUCTS -----
function renderProducts() {
  const area = document.getElementById("productsArea");
  if (!area) return;
  area.innerHTML = "";
  PRODUCTS.forEach((p) => {
    const d = document.createElement("div");
    d.className = "product";
    d.innerHTML = `
        <img src="${p.image}" alt="${p.title}">
        <h3>${p.title}</h3>
        <p>$${(p.price_cents / 100).toFixed(2)}</p>
        <button class="addToCart" data-id="${p.id}">Add to cart</button>
      `;
    area.appendChild(d);
  });

  document.querySelectorAll(".addToCart").forEach((btn) => {
    btn.onclick = () => {
      const user = auth.currentUser;
      if (!user) {
        alert("Please log in with Google to add items to your cart.");
        window.location = "login.html";
        return;
      }
      const id = btn.dataset.id;
      const cart = loadCart();
      cart.push(id);
      saveCart(cart);
      document.getElementById("cartCount").textContent = cartCount();
      alert("Added to cart!");
    };
  });
}

function updateCartUI() {
  const el = document.getElementById("cartCount");
  if (el) el.textContent = cartCount();
}

// ----- AUTH UI -----
const authLink = document.getElementById("authLink");
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) logoutBtn.onclick = () => auth.signOut();

auth.onAuthStateChanged((user) => {
  if (user) {
    if (authLink) {
      authLink.textContent = user.displayName || "Account";
      authLink.href = "products.html";
    }
    if (logoutBtn) logoutBtn.classList.remove("hidden");
  } else {
    if (authLink) {
      authLink.textContent = "Login";
      authLink.href = "login.html";
    }
    if (logoutBtn) logoutBtn.classList.add("hidden");
  }
});

// ----- LOGIN PAGE -----
const loginBtn = document.getElementById("googleLogin");
if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      await auth.signInWithPopup(provider);
      window.location = "products.html";
    } catch (err) {
      alert("Login failed: " + err.message);
    }
  });
}

// ----- CHECKOUT -----
const checkoutBtn = document.getElementById("checkoutBtn");
if (checkoutBtn) checkoutBtn.addEventListener("click", startCheckout);

const viewCartBtn = document.getElementById("viewCart");
if (viewCartBtn)
  viewCartBtn.addEventListener("click", () => {
    const cart = loadCart();
    if (!cart.length) {
      alert("Cart is empty");
      return;
    }
    const lines = cart.map((id) => {
      const p = PRODUCTS.find((x) => x.id === id);
      return `${p.title} — $${(p.price_cents / 100).toFixed(2)}`;
    });
    alert("Cart:\n\n" + lines.join("\n"));
  });

async function startCheckout() {
  const user = auth.currentUser;
  if (!user) {
    alert("Please sign in to checkout");
    window.location = "login.html";
    return;
  }

  const cart = loadCart();
  if (!cart.length) {
    alert("Your cart is empty");
    return;
  }

  const items = {};
  cart.forEach((id) => (items[id] = (items[id] || 0) + 1));
  const line_items = Object.entries(items).map(([id, qty]) => {
    const p = PRODUCTS.find((x) => x.id === id);
    return {
      price_data: {
        currency: "usd",
        product_data: { name: p.title },
        unit_amount: p.price_cents,
      },
      quantity: qty,
    };
  });

  try {
    const endpoint =
      "https://us-central1-YOUR_PROJECT.cloudfunctions.net/createStripeCheckout";
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        line_items,
        customer_email: user.email,
        success_url: `${location.origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${location.origin}/products.html`,
      }),
    });
    const data = await resp.json();
    if (data.sessionId && stripe) {
      const { error } = await stripe.redirectToCheckout({
        sessionId: data.sessionId,
      });
      if (error) alert(error.message);
    } else {
      alert("Payment failed: " + (data.error || "No session ID returned"));
    }
  } catch (err) {
    alert("Checkout error: " + err.message);
  }
}

window.addEventListener("load", () => {
  renderProducts();
  updateCartUI();
});
