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

// --- DATA LOADING ---

async function loadCustomFields(accessToken) {
  if (customFieldsById) return customFieldsById;
  const resp = await fetch(CUSTOM_FIELDS_FN, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  const json = await resp.json();
  const rows = json.data || [];
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
  try {
    if (!cachedAccessToken) {
      showMessage("Signing in to Clio...");
      cachedAccessToken = await authenticateClio();
    }
    showMessage("Loading custom fields...");
    customFieldsById = await loadCustomFields(cachedAccessToken);

    showMessage("Searching Clio...");
    const fieldBag = await fetchMatterFieldBagByMatterNumber(cachedAccessToken, matterNumber, customFieldsById);
    
    if (!fieldBag) {
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
  const listUrl = `${LIST_FN}?query=${encodeURIComponent(matterNumber)}`;
  const listResp = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const listJson = await listResp.json();
  const records = listJson?.data || [];
  if (!records.length) return null;

  const matterId = records[0]?.id;
  const detailUrl = `${DETAIL_FN}?id=${matterId}`;

  const detailResp = await fetch(detailUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const detailJson = await detailResp.json();
  
  const debugEl = document.getElementById("debug-raw");
  if (debugEl) debugEl.textContent = JSON.stringify(detailJson, null, 2);

  return buildFieldBag(detailJson.data, cfMap);
}

function buildFieldBag(matter, cfMap) {
  if (!matter) return null;
  const custom = Object.create(null);
  const cfvs = Array.isArray(matter.custom_field_values) ? matter.custom_field_values : [];

  cfvs.forEach(cfv => {
    // This is the logic that handles the ID prefix and the Map
    const rawId = String(cfv.id || "");
    const cleanId = rawId.includes("-") ? rawId.split("-")[1] : rawId;
    const meta = cfMap ? cfMap[cleanId] : null;
    const name = meta?.name || cfv.custom_field?.name;

    if (name) {
      const key = name.toLowerCase().trim();
      let val = cfv.value;
      if (!val && cfv.picklist_option) {
        val = cfv.picklist_option.option || cfv.picklist_option.name;
      }
      if (val && typeof val === "object") {
        val = val.name || val.display_name;
      }
      if (val !== null && val !== undefined) {
        custom[key] = String(val).trim();
      }
    }
  });

  const getCf = (name) => custom[name.toLowerCase().trim()] || "—";

  return {
    client_name: matter.client?.name || "—",
    matter_number: matter.display_number || "—",
    practice_area: matter.practice_area?.name || "—",
    matter_status: matter.status || "—",
    adverse_party_name: getCf("Adverse Party Name"),
    case_name: getCf("Case Name (a v. b)"),
    court_file_no: getCf("Court File No. (Pleadings)"),
    court_name: getCf("Court (pleadings)"),
    judge_name: getCf("Judge Name")
  };
}

function renderFields() {
  document.querySelectorAll(".cdr-field").forEach((el) => {
    const key = el.getAttribute("data-field");
    const value = currentMatter?.[key];
    const display = (value == null || value === "—") ? "—" : value;

    if (!el.dataset.label) el.dataset.label = el.textContent.trim();
    
    el.innerHTML = `<div class="cdr-field-label">${el.dataset.label}</div><div class="cdr-field-value">${display}</div>`;
    
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
          const resp = await fetch(`${BASE_URL}/.netlify/functions/clioToken`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: arg.message, redirect_uri: REDIRECT_URI, client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
          });
          const tokenData = await resp.json();
          resolve(tokenData.access_token);
        } catch (e) { reject(e); } finally { dialog.close(); }
      });
    });
  });
}

function showMessage(text) {
  const details = document.getElementById("details-section");
  if (!details) return;
  clearMessage();
  const msg = document.createElement("div");
  msg.id = "cdr-message";
  msg.style.padding = "8px";
  msg.textContent = text;
  details.prepend(msg);
}

function clearMessage() {
  const msg = document.getElementById("cdr-message");
  if (msg) msg.remove();
}

Office.onReady((info) => {
  if (info.host !== Office.HostType.Word) return;
  const appBody = document.getElementById("app-body");
  if (appBody) appBody.style.display = "block";
  document.getElementById("searchButton").onclick = searchMatter;
});
