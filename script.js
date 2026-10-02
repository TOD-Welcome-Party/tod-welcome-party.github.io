// ===== EVENT TIMES (Cairo, UTC+3) =====
const EVENT_START = new Date("2026-10-11T09:00:00+03:00");
const EVENT_DAY_START = new Date("2026-10-11T00:00:00+03:00");

// ===== MOBILE NAV TOGGLE =====
const navToggle = document.getElementById("navToggle");
const navLinks = document.querySelector(".nav-links");

if (navToggle && navLinks) {
  function setMenu(open) {
    navLinks.classList.toggle("open", open);
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }

  navToggle.addEventListener("click", function () {
    setMenu(!navLinks.classList.contains("open"));
  });

  // Close the menu once a link is clicked, when tapping outside it, or on Escape (mobile)
  navLinks.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      setMenu(false);
    });
  });

  document.addEventListener("click", function (event) {
    if (!event.target.closest(".navbar")) setMenu(false);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") setMenu(false);
  });
}

// ===== ACTIVE LINK WHILE SCROLLING =====
const sections = document.querySelectorAll("section[id]");
const navAnchors = document.querySelectorAll(".nav-links a");

if (sections.length && navAnchors.length) {
  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute("id");
          navAnchors.forEach(function (link) {
            link.classList.toggle("active", link.getAttribute("href") === "#" + id);
          });
        }
      });
    },
    { rootMargin: "-50% 0px -50% 0px" }
  );

  sections.forEach(function (section) {
    observer.observe(section);
  });
}

// ===== COUNTDOWN TIMER =====
function updateCountdown() {
  const diff = EVENT_START - new Date();

  if (diff <= 0) {
    document.getElementById("days").textContent = "00";
    document.getElementById("hours").textContent = "00";
    document.getElementById("minutes").textContent = "00";
    return;
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);

  document.getElementById("days").textContent = String(days).padStart(2, "0");
  document.getElementById("hours").textContent = String(hours).padStart(2, "0");
  document.getElementById("minutes").textContent = String(minutes).padStart(2, "0");
}

if (document.getElementById("days")) {
  updateCountdown();
  setInterval(updateCountdown, 60 * 1000);
}

// ===== LIVE AGENDA + LIVE BANNER =====
// One Firestore document (live/event) holds the agenda items and what is happening now.
// Everyone listens to that single document, so the cost stays flat as attendees grow.
const STAGE_LABELS = { "before-hall": "Before the hall", "in-hall": "Inside the hall" };
const agendaList = document.getElementById("agendaList");
const liveBanner = document.getElementById("liveBanner");

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function renderAgenda(items, currentItemId) {
  if (!agendaList) return;

  const frag = document.createDocumentFragment();
  let timeline = null;
  let lastStage = null;

  // Everything before the current item (in list order) is finished.
  const currentIndex = currentItemId
    ? items.findIndex(function (item) { return item.id === currentItemId; })
    : -1;

  items.forEach(function (item, index) {
    const stage = item.stage || "in-hall";
    if (stage !== lastStage) {
      frag.appendChild(el("p", "stage-label", STAGE_LABELS[stage] || stage));
      timeline = el("div", "timeline");
      frag.appendChild(timeline);
      lastStage = stage;
    }

    const row = el("div", "timeline-item");
    row.setAttribute("data-item-id", item.id);
    if (index === currentIndex) row.classList.add("is-live");
    else if (currentIndex !== -1 && index < currentIndex) row.classList.add("is-done");
    if (item.time) row.appendChild(el("span", "time", item.time));

    const content = el("div", "timeline-content");
    const title = el("b", "", item.title);
    title.setAttribute("dir", "auto");
    content.appendChild(title);
    if (item.subtitle) {
      const sub = el("p", "", item.subtitle);
      sub.setAttribute("dir", "auto");
      content.appendChild(sub);
    }
    row.appendChild(content);
    timeline.appendChild(row);
  });

  agendaList.replaceChildren(frag);
}

function renderBanner(data, items) {
  if (!liveBanner) return;

  let label = data && data.label ? String(data.label).trim() : "";
  const location = data && data.location ? String(data.location).trim() : "";

  if (!label && data && data.currentItemId) {
    const current = items.find(function (item) { return item.id === data.currentItemId; });
    if (current) label = current.title;
  }

  const tag = document.getElementById("liveTag");
  const labelEl = document.getElementById("liveLabel");
  const locationEl = document.getElementById("liveLocation");

  if (label) {
    tag.textContent = "LIVE NOW";
    labelEl.textContent = label;
    locationEl.textContent = location;
  } else if (Date.now() >= EVENT_DAY_START) {
    tag.textContent = "STARTING SOON";
    labelEl.textContent = "Stay tuned - live updates will appear here";
    locationEl.textContent = "";
  } else {
    liveBanner.classList.add("hidden");
    syncBannerHeight();
    return;
  }

  liveBanner.classList.remove("hidden");
  syncBannerHeight();
}

// Lets anchor jumps (#program, #register...) stop below the sticky banner instead of under it.
function syncBannerHeight() {
  if (!liveBanner) return;
  const height = liveBanner.classList.contains("hidden") ? 0 : liveBanner.offsetHeight;
  document.documentElement.style.setProperty("--banner-h", height + "px");
}

window.addEventListener("resize", syncBannerHeight);

// ===== WHATSAPP GROUP INVITE =====
// Shown after registering. The admin can change it from the dashboard (live/event -> inviteLink).
const DEFAULT_INVITE_LINK = "https://chat.whatsapp.com/LrsBsB3s27wBHXUk3UT2Dy";
let inviteUrl = DEFAULT_INVITE_LINK;

// Points a link at the invite, or hides it when there is no valid https link.
function setInviteLink(anchor) {
  const valid = /^https:\/\/\S+$/.test(inviteUrl);
  if (valid) anchor.href = inviteUrl;
  anchor.classList.toggle("hidden", !valid);
}

if (agendaList && liveBanner) {
  db.collection("live")
    .doc("event")
    .onSnapshot(
      function (snapshot) {
        const data = snapshot.exists ? snapshot.data() : null;
        const items = data && Array.isArray(data.items) ? data.items : [];
        inviteUrl = data && typeof data.inviteLink === "string" ? data.inviteLink.trim() : DEFAULT_INVITE_LINK;

        if (items.length) renderAgenda(items, data.currentItemId || null);
        renderBanner(data, items);
      },
      function (error) {
        console.error("Live updates unavailable:", error);
      }
    );
}

// ===== REGISTER FORM =====
const registerForm = document.getElementById("registerForm");

// Accepts Arabic-Indic digits, spaces, dashes and the +20 / 0020 / 20 prefixes.
function normalizePhone(raw) {
  let phone = raw
    .replace(/[٠-٩]/g, function (d) { return "٠١٢٣٤٥٦٧٨٩".indexOf(d); })
    .replace(/[^\d+]/g, "");
  if (phone.indexOf("+20") === 0) phone = "0" + phone.slice(3);
  else if (phone.indexOf("0020") === 0) phone = "0" + phone.slice(4);
  else if (/^20\d{10}$/.test(phone)) phone = "0" + phone.slice(2);
  else if (/^1[0-9]{9}$/.test(phone)) phone = "0" + phone; // typed without the leading 0
  return phone;
}

if (registerForm) {
  const formStatus = document.getElementById("formStatus");
  const inviteAlt = document.getElementById("inviteAlt");
  const submitButton = registerForm.querySelector("button[type='submit']");

  function setStatus(message, isError) {
    formStatus.textContent = message;
    formStatus.classList.toggle("error", Boolean(isError));
    inviteAlt.classList.add("hidden");
  }

  registerForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const fullName = document.getElementById("fullName").value.trim().replace(/\s+/g, " ");
    const department = document.getElementById("department").value;
    const phone = normalizePhone(document.getElementById("phone").value);
    const friends = document.querySelector('input[name="friends"]:checked').value;

    if (!fullName) {
      setStatus("Please enter your full name.", true);
      return;
    }
    if (!department) {
      setStatus("Please select your department.", true);
      return;
    }
    if (!/^01[0-9]{9}$/.test(phone)) {
      setStatus("Please enter a valid Egyptian mobile number (11 digits, e.g. 01012345678).", true);
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Sending...";
    setStatus("", false);

    // On a weak connection the save can take a while - tell the person to wait.
    const slowTimer = setTimeout(function () {
      setStatus("Slow connection - still trying. Please keep this page open.", false);
    }, 8000);

    // The phone number is the document ID, so the same number can only register once.
    db.collection("registrations")
      .doc(phone)
      .set({
        fullName: fullName,
        department: department,
        phone: phone,
        friends: friends,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      })
      .then(function () {
        const successMessage = document.getElementById("successMessage");
        document.getElementById("successText").textContent =
          Date.now() >= EVENT_DAY_START
            ? "Welcome! You're checked in."
            : "You're registered. See you on Sunday, October 11.";
        setInviteLink(document.getElementById("inviteLink"));
        successMessage.classList.remove("hidden");
        registerForm.reset();
        registerForm.classList.add("hidden");
      })
      .catch(function (error) {
        console.error("Error saving registration:", error);
        if (error.code === "permission-denied") {
          setStatus("This phone number is already registered. / هذا الرقم مسجل بالفعل.", true);
          setInviteLink(inviteAlt);
        } else {
          setStatus("Could not save your registration. Check your connection and try again.", true);
        }
        submitButton.disabled = false;
        submitButton.textContent = "Confirm registration";
      })
      .finally(function () {
        clearTimeout(slowTimer);
      });
  });
}
