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

// --- DATA LOADING FUNCTIONS ---

async function loadCustomFields(accessToken) {
  if (customFieldsById) return customFieldsById;
  const resp = await fetch(CUSTOM_FIELDS_FN, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  const json = await resp.json();
  const rows = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);
  const map = Object.create(null);
  for (const cf of rows) {
    if (!cf?.id) continue;
    map[String(cf.id)] = { name: cf.name, type: cf.field_type };
  }
  customFieldsById = map;
  return map;
}

async function searchMatter() {
  const input = document.getElementById("matterNumber");
  const matterNumber = (input?.value || "").trim();
  if (!matterNumber) {
    showMessage("Please enter a matter number.");
    return;
  }
  currentMatter = null;
  try {
    if (!cachedAccessToken) {
      showMessage("Signing in to Clio...");
      cachedAccessToken = await authenticateClio();
    }
    showMessage("Loading custom fields...");
    try {
      customFieldsById = await loadCustomFields(cachedAccessToken);
    } catch (cfError) {
      customFieldsById = {};
    }
    showMessage("Searching Clio for " + matterNumber + "...");
    const fieldBag = await fetchMatterFieldBagByMatterNumber(cachedAccessToken, matterNumber, customFieldsById);
    if (!fieldBag) {
      renderFields();
      showMessage(`No match found for matter # ${matterNumber}.`);
      return;
    }
    currentMatter = fieldBag;
    renderFields();
    clearMessage();
  } catch (error) {
    console.error("Search failed:", error);
    showMessage("Search failed: " + (error.message || "Unknown error"));
  }
}

async function fetchMatterFieldBagByMatterNumber(accessToken, matterNumber, cfMap) {
  const listFields = "id,display_number";
  const listUrl = `${LIST_FN}?query=${encodeURIComponent(matterNumber)}&fields=${encodeURIComponent(listFields)}`;
  const listResp = await fetch(listUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  const listJson = await listResp.json();
  const records = listJson?.data || [];
  if (!records.length) return null;

  const matterId = records[0]?.id;
  const detailFields = "id,display_number,status,client{name},practice_area{name},custom_field_values{id,value,picklist_option,custom_field{id,name}}";
  const detailUrl = `${DETAIL_FN}?id=${encodeURIComponent(matterId)}&fields=${encodeURIComponent(detailFields)}`;

  const detailResp = await fetch(detailUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  const detailJson = await detailResp.json();
  
  const debugEl = document.getElementById("debug-raw");
  if (debugEl) debugEl.textContent = JSON.stringify(detailJson, null, 2);

  const matterData = detailJson?.data;
  if (!matterData) return null;

  return buildFieldBag(matterData, cfMap);
} // <--- THIS BRACE WAS MISSING

function buildFieldBag(matter, cfMap) {
  if (!matter) return null;
  const custom = Object.create(null);
  const cfvs = Array.isArray(matter.custom_field_values) ? matter.custom_field_values : [];

  cfvs.forEach(cfv => {
    const defId = String(cfv?.custom_field?.id || "");
    const instanceId = String(cfv?.id || "");
    const meta = cfMap ? (cfMap[defId] || cfMap[instanceId]) : null;
    const name = meta?.name || cfv?.custom_field?.name;

    if (name) {
      const key = name.toLowerCase().trim();
      let val = cfv.value;
      if (val && typeof val === "object") {
        val = val.name || val.display_name || val.option || JSON.stringify(val);
      }
      if ((val === null || val === undefined) && cfv.picklist_option) {
        val = cfv.picklist_option.option || cfv.picklist_option.name;
      }
      if (val !== null && val !== undefined) {
        custom[key] = String(val).trim();
      }
    }
  });

  const getCf = (name) => {
    const s = name.toLowerCase().trim();
    return custom[s] || "—";
  };

  return {
    client_name: matter.client?.name || "—",
    matter_number: matter.display_number || "—",
    practice_area: matter.practice_area?.name || "—",
    matter_status: matter.status || "—",
    adverse_party_name: getCf("Adverse Party Name"),
    case_name: getCf("Case Name (a v. b)"),
    court_file_no: getCf("Court File No. (Pleadings)"),
    court_name: getCf("Court (pleadings)"),
    judge_name: getCf("Judge Name ie. Justice Jim Doe")
  };
}

function renderFields() {
  document.querySelectorAll(".cdr-field").forEach((el) => {
    const key = el.getAttribute("data-field");
    if (!key) return;
    if (!el.dataset.label) el.dataset.label = el.textContent.trim();
    const label = el.dataset.label;
    const value = currentMatter?.[key];
    const display = (value == null || String(value).trim() === "" || value === "—") ? "—" : String(value);

    el.innerHTML = "";
    const labelDiv = document.createElement("div");
    labelDiv.className = "cdr-field-label";
    labelDiv.textContent = label;
    const valueDiv = document.createElement("div");
    valueDiv.className = "cdr-field-value";
    valueDiv.textContent = display;
    el.appendChild(labelDiv);
    el.appendChild(valueDiv);

    if (display === "—") el.classList.add("cdr-field-empty");
    else el.classList.remove("cdr-field-empty");
  });
}

function authenticateClio() {
  return new Promise((resolve, reject) => {
    Office.context.ui.displayDialogAsync(DIALOG_START_URL, { height: 60, width: 40 }, (result) => {
      if (result.status === Office.AsyncResultStatus.Failed) { reject(result.error); return; }
      const dialog = result.value;
      dialog.addEventHandler(Office.EventType.DialogMessageReceived, async (arg) => {
        try {
          const tokenResponse = await exchangeCodeForToken(arg.message);
          resolve(tokenResponse.access_token);
        } catch (e) { reject(e); } finally { dialog.close(); }
      });
    });
  });
}

async function exchangeCodeForToken(code) {
  const resp = await fetch(`${BASE_URL}/.netlify/functions/clioToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirect_uri: REDIRECT_URI, client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  return resp.json();
}

function clearMessage() {
  const msg = document.getElementById("cdr-message");
  if (msg) msg.remove();
}

function showMessage(text) {
  const detailsSection = document.getElementById("details-section");
  if (!detailsSection) return;
  clearMessage();
  const msg = document.createElement("div");
  msg.id = "cdr-message";
  msg.style.padding = "8px";
  msg.textContent = text;
  detailsSection.prepend(msg);
}

// --- BOOTSTRAP ---
Office.onReady((info) => {
  if (info.host !== Office.HostType.Word) return;
  const appBody = document.getElementById("app-body");
  if (appBody) appBody.style.display = "block";

  const btn = document.getElementById("searchButton");
  if (btn) btn.onclick = searchMatter;

  document.querySelectorAll(".cdr-group-toggle").forEach((toggle) => {
    toggle.onclick = () => {
      toggle.classList.toggle("expanded");
      const content = toggle.nextElementSibling;
      if (content) content.classList.toggle("expanded");
    };
  });
});
