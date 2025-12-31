/* global document, Office */

const CLIENT_ID = "L7275gMi9MT75hiBh8SoUDSIXbt2SgSg6jSbpg1e";
const CLIENT_SECRET = "Si5nz9zY4MlWEkNkjHTHewdd4t2aPhC7UxdDjkcF";

const BASE_URL = "https://meek-seahorse-afd241.netlify.app";
const REDIRECT_URI = `${BASE_URL}/auth.html`;
const DIALOG_START_URL = `${BASE_URL}/auth-start.html`;

const LIST_FN = `${BASE_URL}/.netlify/functions/clioMatters`;
const DETAIL_FN = `${BASE_URL}/.netlify/functions/clioMatterById`;
const CUSTOM_FIELDS_FN = `${BASE_URL}/.netlify/functions/clioCustomFields`;

let cachedAccessToken = null;
let currentMatter = null;
let customFieldsById = null;

Office.onReady((info) => {
  if (info.host !== Office.HostType.Word) return;

  const appBody = document.getElementById("app-body");
  if (appBody) appBody.style.display = "block";

  const btn = document.getElementById("searchButton");
  if (btn) btn.onclick = searchMatter;

  document.querySelectorAll(".cdr-group-toggle").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      toggle.classList.toggle("expanded");
      const content = toggle.nextElementSibling;
      if (content) content.classList.toggle("expanded");
    });
  });

  document.querySelectorAll(".cdr-field").forEach((el) => {
    el.addEventListener("click", () => {
      const key = el.getAttribute("data-field");
      if (!key) return;

      const value = currentMatter?.[key];
      if (value == null || String(value).trim() === "" || String(value).trim() === "—") {
        showMessage("No value available for that field on this matter.");
        return;
      }

      insertTextAtCursor(String(value));
    });
  });

  renderFields();
});

// --- DATA LOADING FUNCTIONS ---

async function loadCustomFields(accessToken) {
  if (customFieldsById) return customFieldsById;

  const resp = await fetch(CUSTOM_FIELDS_FN, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });

  if (!resp.ok) throw new Error(`Custom fields lookup failed (${resp.status})`);

  const json = await resp.json();
  const rows = Array.isArray(json?.data) ? json.data : [];

  const map = Object.create(null);
  for (const cf of rows) {
    if (cf?.id == null) continue;
    const cleanId = String(cf.id).replace(/\D/g, "");
    map[cleanId] = {
      name: cf?.name ? String(cf.name).trim() : null,
      field_type: cf?.field_type || null,
    };
  }

  customFieldsById = map;
  return map;
}

async function searchMatter() {
  const input = document.getElementById("matterNumber");
  const matterNumber = (input?.value || "").trim();
  if (!matterNumber) return showMessage("Please enter a matter number.");

  currentMatter = null;

  try {
    if (!cachedAccessToken) {
      showMessage("Signing in to Clio...");
      cachedAccessToken = await authenticateClio();
    }

    customFieldsById = await loadCustomFields(cachedAccessToken);
    const fieldBag = await fetchMatterFieldBagByMatterNumber(
      cachedAccessToken,
      matterNumber,
      customFieldsById
    );

    if (!fieldBag) {
      renderFields();
      return showMessage(`No match found for matter # ${matterNumber}.`);
    }

    currentMatter = fieldBag;
    renderFields();
    clearMessage();
  } catch (e) {
    cachedAccessToken = null;
    customFieldsById = null;
    renderFields();
    showMessage(e.message || "Search failed");
  }
}

async function fetchMatterFieldBagByMatterNumber(accessToken, matterNumber, cfMap) {
  const listFields =
    "id,display_number,status,client{name,first_name,last_name},practice_area{name}";
  const listUrl = `${LIST_FN}?query=${encodeURIComponent(
    matterNumber
  )}&fields=${encodeURIComponent(listFields)}`;

  const listResp = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const listJson = await listResp.json();
  const match = listJson?.data?.[0];
  if (!match?.id) return null;

  const detailFields =
    "id,display_number,number,status,client{name},practice_area{name}," +
    "custom_field_values{id,value,picklist_option,custom_field{id}}";

  const detailUrl = `${DETAIL_FN}?id=${match.id}&fields=${encodeURIComponent(
    detailFields
  )}`;

  const detailResp = await fetch(detailUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const detailJson = await detailResp.json();
  return buildFieldBag(detailJson?.data, cfMap);
}

// --- FIELD MAPPING ---

function buildFieldBag(matter, cfMap) {
  if (!matter) return null;

  const custom = {};
  (matter.custom_field_values || []).forEach((cfv) => {
    const id = String(cfv?.custom_field?.id || "").replace(/\D/g, "");
    const name = cfMap?.[id]?.name;
    if (!name) return;
    custom[name.toLowerCase()] =
      typeof cfv.value === "object" ? JSON.stringify(cfv.value) : String(cfv.value ?? "").trim();
  });

  const getCf = (n) => custom[n.toLowerCase()] || "—";

  return {
    client_name: matter.client?.name || "—",
    matter_number: matter.display_number || "—",
    practice_area: matter.practice_area?.name || "—",
    matter_status: matter.status || "—",

    adverse_party_name: getCf("Adverse Party Name"),
    case_name: getCf("Case Name (a v. b)"),
    court_file_no: getCf("Court File No. (Pleadings)"),
    court_name: getCf("Court (pleadings)"),
    date_of_separation: getCf("Date of Separation"),
    date_of_marriage: getCf("Date of Marriage"),
    date_of_divorce: getCf("Date of Divorce"),
    judge_name: getCf("Judge Name ie. Justice Jim Doe"),
  };
}

// --- UI HELPERS ---

function renderFields() {
  document.querySelectorAll(".cdr-field").forEach((el) => {
    const key = el.dataset.field;
    const val = currentMatter?.[key];
    el.querySelector(".cdr-field-value").textContent = val || "—";
  });
}

function insertTextAtCursor(text) {
  Office.context.document.setSelectedDataAsync(text);
}

function authenticateClio() {
  return new Promise((resolve, reject) => {
    Office.context.ui.displayDialogAsync(
      DIALOG_START_URL,
      { height: 60, width: 40 },
      (r) => {
        const d = r.value;
        d.addEventHandler(Office.EventType.DialogMessageReceived, async (arg) => {
          try {
            const tok = await exchangeCodeForToken(arg.message);
            resolve(tok.access_token);
          } catch (e) {
            reject(e);
          } finally {
            d.close();
          }
        });
      }
    );
  });
}

async function exchangeCodeForToken(code) {
  const resp = await fetch(`${BASE_URL}/.netlify/functions/clioToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  return resp.json();
}

function showMessage(t) {
  document.getElementById("cdr-message").textContent = t;
}
function clearMessage() {
  document.getElementById("cdr-message").textContent = "";
}
