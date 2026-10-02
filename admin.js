// ===== DEFAULT AGENDA =====
// Only used to pre-fill the agenda editor the first time (nothing is saved until you press "Save agenda").
const DEFAULT_ITEMS = [
  { id: "checkin", stage: "before-hall", time: "8:30 AM", title: "Arrival & check-in", subtitle: "Games, activities, glitter face paint" },
  { id: "quran", stage: "in-hall", time: "", title: "Quran recitation", subtitle: "" },
  { id: "anthem", stage: "in-hall", time: "", title: "National anthem", subtitle: "" },
  { id: "ceo", stage: "in-hall", time: "", title: "CEO speech", subtitle: "" },
  { id: "dean", stage: "in-hall", time: "", title: "Dean's speech", subtitle: "" },
  { id: "deputies", stage: "in-hall", time: "", title: "Deputy deans' speeches", subtitle: "" },
  { id: "war", stage: "in-hall", time: "", title: "October 6 War commemoration", subtitle: "" },
  { id: "theatre", stage: "in-hall", time: "", title: "A theatrical performance", subtitle: "" }
];

const auth = firebase.auth();
const liveRef = db.collection("live").doc("event");

function $(id) {
  return document.getElementById(id);
}

let unsubscribeRegs = null;
let unsubscribeLive = null;
let allRegs = []; // newest first
let liveItems = [];
let liveData = null;
let agendaDraft = []; // the rows being edited in the agenda editor
let controlsInitialized = false;
let agendaDirty = false;
let labelAutoFilled = false;

// ===== SIGN IN / OUT =====
function authMessage(error) {
  switch (error.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "Wrong email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes and try again.";
    case "auth/network-request-failed":
      return "No connection. Check your internet and try again.";
    case "auth/unauthorized-domain":
      return "This website address is not authorized in Firebase Authentication yet.";
    default:
      return "Sign-in failed (" + error.code + ").";
  }
}

$("loginForm").addEventListener("submit", function (event) {
  event.preventDefault();
  const loginBtn = $("loginBtn");
  const loginError = $("loginError");
  loginBtn.disabled = true;
  loginError.classList.add("hidden");

  auth
    .signInWithEmailAndPassword($("emailInput").value.trim(), $("passwordInput").value)
    .then(function () {
      $("passwordInput").value = "";
    })
    .catch(function (error) {
      loginError.textContent = authMessage(error);
      loginError.classList.remove("hidden");
    })
    .finally(function () {
      loginBtn.disabled = false;
    });
});

$("signOutBtn").addEventListener("click", function () {
  auth.signOut();
});

auth.onAuthStateChanged(function (user) {
  if (user) {
    $("lockScreen").classList.add("hidden");
    $("adminContent").classList.remove("hidden");
    $("navUser").classList.remove("hidden");
    $("userEmail").textContent = user.email;
    startRegistrations();
    startLive();
  } else {
    stopListeners();
    $("adminContent").classList.add("hidden");
    $("navUser").classList.add("hidden");
    $("lockScreen").classList.remove("hidden");
  }
});

function stopListeners() {
  if (unsubscribeRegs) unsubscribeRegs();
  if (unsubscribeLive) unsubscribeLive();
  unsubscribeRegs = null;
  unsubscribeLive = null;
  allRegs = [];
  liveItems = [];
  liveData = null;
  controlsInitialized = false;
  agendaDirty = false;
  agendaDraft = [];
  $("agendaRows").replaceChildren();
  $("regTableBody").replaceChildren();
}

// ===== REGISTRATIONS (live table, search, headcount) =====
function fmtTime(date) {
  if (!date) return "just now";
  return date.toLocaleString("en-GB", { timeZone: "Africa/Cairo", dateStyle: "medium", timeStyle: "short" });
}

function startRegistrations() {
  if (unsubscribeRegs) return;

  unsubscribeRegs = db
    .collection("registrations")
    .orderBy("createdAt", "desc")
    .onSnapshot(
      function (snapshot) {
        const total = snapshot.size;
        allRegs = snapshot.docs.map(function (doc, index) {
          const data = doc.data();
          return {
            seq: total - index,
            fullName: String(data.fullName || ""),
            department: String(data.department || ""),
            phone: String(data.phone || doc.id),
            friends: Number(data.friends) || 0,
            createdAt: data.createdAt ? data.createdAt.toDate() : null
          };
        });
        renderRegs();
      },
      function (error) {
        console.error("Could not load registrations:", error);
        $("regCount").textContent = "Could not load registrations (" + error.code + ")";
      }
    );
}

function cell(text) {
  const td = document.createElement("td");
  td.textContent = text;
  return td;
}

function renderRegs() {
  const query = $("searchInput").value.trim().toLowerCase();
  const visible = query
    ? allRegs.filter(function (r) {
        return (r.fullName + " " + r.phone + " " + r.department).toLowerCase().indexOf(query) !== -1;
      })
    : allRegs;

  const people = allRegs.reduce(function (sum, r) { return sum + 1 + r.friends; }, 0);
  let countText = allRegs.length + " registered · " + people + " people expected (including friends)";
  if (query) countText = "Showing " + visible.length + " of " + allRegs.length + " · " + people + " people expected";
  $("regCount").textContent = countText;

  $("emptyMsg").classList.toggle("hidden", allRegs.length > 0);

  const friendsLabel = ["No", "1 friend", "2 friends"];
  const frag = document.createDocumentFragment();
  visible.forEach(function (r) {
    const row = document.createElement("tr");
    const nameCell = cell(r.fullName);
    nameCell.setAttribute("dir", "auto");
    row.appendChild(cell(String(r.seq)));
    row.appendChild(nameCell);
    row.appendChild(cell(r.department));
    row.appendChild(cell(r.phone));
    row.appendChild(cell(friendsLabel[r.friends] || String(r.friends)));
    row.appendChild(cell(fmtTime(r.createdAt)));
    frag.appendChild(row);
  });
  $("regTableBody").replaceChildren(frag);
}

$("searchInput").addEventListener("input", renderRegs);

// ===== EXCEL EXPORT (runs entirely in the browser) =====
function loadScript(src) {
  return new Promise(function (resolve, reject) {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = function () { reject(new Error("Could not load " + src)); };
    document.head.appendChild(script);
  });
}

function ensureSheetJS() {
  if (window.XLSX) return Promise.resolve();
  return loadScript("vendor/xlsx.full.min.js").catch(function () {
    return loadScript("https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js");
  });
}

function setMsg(id, text, kind) {
  const node = $(id);
  node.textContent = text;
  node.classList.remove("error", "ok");
  if (kind) node.classList.add(kind);
}

$("exportBtn").addEventListener("click", function () {
  if (!allRegs.length) {
    setMsg("exportMsg", "There are no registrations to export yet.", "error");
    return;
  }

  const button = $("exportBtn");
  button.disabled = true;
  setMsg("exportMsg", "Preparing the Excel file...", "");

  ensureSheetJS()
    .then(function () {
      // Oldest first, so row numbers follow the order people registered.
      const rows = allRegs.slice().reverse().map(function (r) {
        return {
          "#": r.seq,
          "Full name": r.fullName,
          "Department": r.department,
          "Phone": r.phone,
          "Friends": r.friends,
          "Total people": 1 + r.friends,
          "Registered at (Cairo)": fmtTime(r.createdAt)
        };
      });

      const sheet = XLSX.utils.json_to_sheet(rows);
      sheet["!cols"] = [{ wch: 6 }, { wch: 28 }, { wch: 28 }, { wch: 14 }, { wch: 9 }, { wch: 13 }, { wch: 24 }];
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Registrations");

      const day = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
      XLSX.writeFile(book, "registrations-" + day + ".xlsx");
      setMsg("exportMsg", "Downloaded " + rows.length + " registrations.", "ok");
    })
    .catch(function (error) {
      console.error("Export failed:", error);
      setMsg("exportMsg", "Could not create the Excel file. Check your connection and try again.", "error");
    })
    .finally(function () {
      button.disabled = false;
    });
});

// ===== LIVE CONTROL =====
// Every push is delivered to every attendee who has the page open (1 Firestore read each),
// so we keep a per-device counter as a reminder to stay inside the free daily quota.
function todayKey() {
  return "wp_pushes_" + new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
}

function readPushCount() {
  try {
    return Number(localStorage.getItem(todayKey())) || 0;
  } catch (e) {
    return 0;
  }
}

function bumpPushCount() {
  try {
    localStorage.setItem(todayKey(), String(readPushCount() + 1));
  } catch (e) {
    // storage unavailable - the counter is only a convenience
  }
  showPushCount();
}

function showPushCount() {
  $("pushCount").textContent = "Updates sent today from this device: " + readPushCount() + " (keep under about 80)";
}

function startLive() {
  if (unsubscribeLive) return;
  showPushCount();

  unsubscribeLive = liveRef.onSnapshot(
    function (snapshot) {
      liveData = snapshot.exists ? snapshot.data() : null;
      liveItems = liveData && Array.isArray(liveData.items) ? liveData.items : [];
      renderLiveControls();
    },
    function (error) {
      console.error("Could not load live data:", error);
      setMsg("liveMsg", "Could not load live data (" + error.code + ").", "error");
    }
  );
}

function renderLiveControls() {
  // Dropdown of agenda items (keeps the admin's current choice if it still exists)
  const select = $("liveItem");
  const previous = controlsInitialized ? select.value : (liveData && liveData.currentItemId) || "";
  select.replaceChildren(new Option("None", ""));
  liveItems.forEach(function (item) {
    select.add(new Option((item.time ? item.time + " - " : "") + item.title, item.id));
  });
  select.value = liveItems.some(function (item) { return item.id === previous; }) ? previous : "";

  // Fill the text boxes once, from what is currently live
  if (!controlsInitialized) {
    $("inputLabel").value = (liveData && liveData.label) || "";
    $("inputLocation").value = (liveData && liveData.location) || "";
    controlsInitialized = true;
  }

  // What attendees see right now
  const current = liveItems.find(function (item) { return liveData && item.id === liveData.currentItemId; });
  const label = (liveData && liveData.label) || (current && current.title) || "";
  const location = (liveData && liveData.location) || "";
  $("liveNow").textContent = label ? label + (location ? " - " + location : "") : "nothing (banner is empty)";

  // Fill the agenda editor from what is saved, unless the admin has started editing it
  if (!agendaDirty) setDraft(liveItems.length ? liveItems : DEFAULT_ITEMS);
}

$("liveItem").addEventListener("change", function () {
  const item = liveItems.find(function (i) { return i.id === $("liveItem").value; });
  const labelInput = $("inputLabel");
  if (item && (!labelInput.value.trim() || labelAutoFilled)) {
    labelInput.value = item.title;
    labelAutoFilled = true;
  } else if (!item && labelAutoFilled) {
    labelInput.value = "";
    labelAutoFilled = false;
  }
});

$("inputLabel").addEventListener("input", function () {
  labelAutoFilled = false;
});

function pushLive(fields, successText) {
  const buttons = [$("pushBtn"), $("clearBtn"), $("nextBtn")];
  buttons.forEach(function (b) { b.disabled = true; });
  setMsg("liveMsg", "Sending...", "");

  liveRef
    .set(Object.assign({}, fields, { updatedAt: firebase.firestore.FieldValue.serverTimestamp() }), { merge: true })
    .then(function () {
      bumpPushCount();
      setMsg("liveMsg", successText, "ok");
    })
    .catch(function (error) {
      console.error("Live update failed:", error);
      setMsg("liveMsg", "Could not send the update (" + error.code + "). Check your connection and try again.", "error");
    })
    .finally(function () {
      buttons.forEach(function (b) { b.disabled = false; });
    });
}

$("pushBtn").addEventListener("click", function () {
  const itemId = $("liveItem").value || null;
  const label = $("inputLabel").value.trim();
  const location = $("inputLocation").value.trim();

  if (!label && !itemId) {
    setMsg("liveMsg", "Choose an agenda item or type an announcement first (or use Clear banner).", "error");
    return;
  }
  pushLive({ currentItemId: itemId, label: label, location: location }, "Live update sent. Attendees see it now.");
});

$("clearBtn").addEventListener("click", function () {
  $("liveItem").value = "";
  $("inputLabel").value = "";
  $("inputLocation").value = "";
  labelAutoFilled = false;
  pushLive({ currentItemId: null, label: "", location: "" }, "Banner cleared.");
});

// ===== NEXT ITEM (one tap moves the live event forward) =====
$("nextBtn").addEventListener("click", function () {
  const currentIndex = liveItems.findIndex(function (item) {
    return liveData && item.id === liveData.currentItemId;
  });
  const next = liveItems[currentIndex + 1];

  if (!next) {
    setMsg("liveMsg", liveItems.length ? "That was the last item in the agenda." : "There is no agenda yet. Save one first.", "error");
    return;
  }

  $("liveItem").value = next.id;
  $("inputLabel").value = next.title;
  $("inputLocation").value = "";
  labelAutoFilled = true;
  pushLive({ currentItemId: next.id, label: next.title, location: "" }, "Moved on to: " + next.title);
});

// ===== AGENDA EDITOR (one row per item) =====
const STAGES = [
  ["before-hall", "Before the hall"],
  ["in-hall", "Inside the hall"]
];
const MAX_ITEMS = 40;

function newItemId() {
  return "item-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

function setDraft(items) {
  agendaDraft = items.map(function (item) {
    return {
      id: String(item.id),
      stage: item.stage || "in-hall",
      time: item.time || "",
      title: item.title || "",
      subtitle: item.subtitle || ""
    };
  });
  renderAgendaRows();
}

function textInput(placeholder, value, onChange) {
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 140;
  input.placeholder = placeholder;
  input.value = value;
  input.setAttribute("dir", "auto");
  input.addEventListener("input", function () {
    onChange(input.value);
    agendaDirty = true;
  });
  return input;
}

function labelled(caption, control) {
  const wrap = document.createElement("label");
  wrap.className = "a-field";
  const span = document.createElement("span");
  span.textContent = caption;
  wrap.appendChild(span);
  wrap.appendChild(control);
  return wrap;
}

function miniButton(text, disabled, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn-mini";
  button.textContent = text;
  button.disabled = disabled;
  button.addEventListener("click", onClick);
  return button;
}

function moveItem(index, delta) {
  const target = index + delta;
  if (target < 0 || target >= agendaDraft.length) return;
  const moved = agendaDraft.splice(index, 1)[0];
  agendaDraft.splice(target, 0, moved);
  agendaDirty = true;
  renderAgendaRows();
}

function buildRow(item, index) {
  const row = document.createElement("div");
  row.className = "agenda-row";

  const head = document.createElement("div");
  head.className = "agenda-head";
  const number = document.createElement("b");
  number.textContent = "Item " + (index + 1);
  head.appendChild(number);

  const actions = document.createElement("div");
  actions.className = "agenda-actions";
  actions.appendChild(miniButton("Up", index === 0, function () { moveItem(index, -1); }));
  actions.appendChild(miniButton("Down", index === agendaDraft.length - 1, function () { moveItem(index, 1); }));
  const remove = miniButton("Delete", false, function () {
    agendaDraft.splice(index, 1);
    agendaDirty = true;
    renderAgendaRows();
  });
  remove.classList.add("danger");
  actions.appendChild(remove);
  head.appendChild(actions);

  const stage = document.createElement("select");
  const stages = STAGES.slice();
  if (!stages.some(function (s) { return s[0] === item.stage; })) stages.push([item.stage, item.stage]);
  stages.forEach(function (s) { stage.add(new Option(s[1], s[0])); });
  stage.value = item.stage;
  stage.addEventListener("change", function () {
    item.stage = stage.value;
    agendaDirty = true;
  });

  const fields = document.createElement("div");
  fields.className = "agenda-fields";
  fields.appendChild(labelled("Part of the day", stage));
  fields.appendChild(labelled("Time (optional)", textInput("e.g. 9:30 AM", item.time, function (v) { item.time = v; })));
  fields.appendChild(labelled("Title", textInput("e.g. CEO speech", item.title, function (v) { item.title = v; })));
  fields.appendChild(labelled("Details (optional)", textInput("e.g. Main hall", item.subtitle, function (v) { item.subtitle = v; })));

  row.appendChild(head);
  row.appendChild(fields);
  return row;
}

function renderAgendaRows() {
  const box = $("agendaRows");
  if (!agendaDraft.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = 'No items yet. Press "Add item".';
    box.replaceChildren(empty);
    return;
  }
  const frag = document.createDocumentFragment();
  agendaDraft.forEach(function (item, index) {
    frag.appendChild(buildRow(item, index));
  });
  box.replaceChildren(frag);
}

$("addItemBtn").addEventListener("click", function () {
  if (agendaDraft.length >= MAX_ITEMS) {
    setMsg("agendaMsg", "Maximum " + MAX_ITEMS + " items.", "error");
    return;
  }
  const last = agendaDraft[agendaDraft.length - 1];
  agendaDraft.push({ id: newItemId(), stage: last ? last.stage : "in-hall", time: "", title: "", subtitle: "" });
  agendaDirty = true;
  renderAgendaRows();

  const rows = $("agendaRows").querySelectorAll(".agenda-row");
  const lastRow = rows[rows.length - 1];
  lastRow.scrollIntoView({ block: "center" });
  lastRow.querySelectorAll("input")[1].focus();
});

$("defaultAgendaBtn").addEventListener("click", function () {
  if (agendaDirty && !confirm("Replace your edits with the default agenda?")) return;
  setDraft(DEFAULT_ITEMS);
  agendaDirty = true;
  setMsg("agendaMsg", 'Default agenda loaded. Press "Save agenda" to publish it.', "");
});

$("saveAgendaBtn").addEventListener("click", function () {
  if (!agendaDraft.length) {
    setMsg("agendaMsg", 'Add at least one item first (press "Add item").', "error");
    return;
  }

  const items = [];
  for (let i = 0; i < agendaDraft.length; i++) {
    const draft = agendaDraft[i];
    const title = draft.title.trim();
    if (!title) {
      setMsg("agendaMsg", "Item " + (i + 1) + " needs a title (or delete it).", "error");
      return;
    }
    items.push({ id: draft.id, stage: draft.stage, time: draft.time.trim(), title: title, subtitle: draft.subtitle.trim() });
  }

  const fields = { items: items, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
  const currentId = liveData && liveData.currentItemId;
  const removedCurrent = Boolean(currentId) && !items.some(function (item) { return item.id === currentId; });
  if (removedCurrent) fields.currentItemId = null;

  const button = $("saveAgendaBtn");
  button.disabled = true;
  setMsg("agendaMsg", "Saving...", "");

  liveRef
    .set(fields, { merge: true })
    .then(function () {
      agendaDirty = false;
      bumpPushCount();
      setMsg(
        "agendaMsg",
        removedCurrent
          ? "Agenda saved. The item that was live was removed, so nothing is marked live now."
          : "Agenda saved. Attendees see the new program now.",
        "ok"
      );
    })
    .catch(function (error) {
      console.error("Saving the agenda failed:", error);
      setMsg("agendaMsg", "Could not save (" + error.code + "). Check your connection and try again.", "error");
    })
    .finally(function () {
      button.disabled = false;
    });
});
