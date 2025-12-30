/* global document, Office */

const CLIENT_ID = "L7275gMi9MT75hiBh8SoUDSIXbt2SgSg6jSbpg1e";
const CLIENT_SECRET = "Si5nz9zY4MlWEkNkjHTHewdd4t2aPhC7UxdDjkcF";
const BASE_URL = "https://meek-seahorse-afd241.netlify.app";
const DETAIL_FN = `${BASE_URL}/.netlify/functions/clioMatterById`;
const LIST_FN = `${BASE_URL}/.netlify/functions/clioMatters`;
const CUSTOM_FIELDS_FN = `${BASE_URL}/.netlify/functions/clioCustomFields`;

let cachedAccessToken = null;
let customFieldsById = null;
let currentMatter = null;

// --- INITIALIZATION ---
Office.onReady((info) => {
  if (info.host !== Office.HostType.Word) return;
  
  const appBody = document.getElementById("app-body");
  if (appBody) appBody.style.display = "block";

  const btn = document.getElementById("searchButton");
  if (btn) {
    btn.onclick = async () => {
      try {
        await searchMatter();
      } catch (err) {
        showMessage("Click Error: " + err.message);
      }
    };
  }

  // Bind toggles
  document.querySelectorAll(".cdr-group-toggle").forEach((toggle) => {
    toggle.onclick = () => {
      toggle.classList.toggle("expanded");
      const content = toggle.nextElementSibling;
      if (content) content.classList.toggle("expanded");
    };
  });
});

async function searchMatter() {
  const input = document.getElementById("matterNumber");
  const matterNumber = (input?.value || "").trim();
  
  if (!matterNumber) {
    showMessage("Please enter a matter number.");
    return;
  }

  try {
    if (!cachedAccessToken) {
      showMessage("Signing in...");
      cachedAccessToken = await authenticateClio();
    }

    // Load definitions if we don't have them
    if (!customFieldsById) {
      showMessage("Loading field definitions...");
      const resp = await fetch(CUSTOM_FIELDS_FN, {
        headers: { Authorization: `Bearer ${cachedAccessToken}` }
      });
      const json = await resp.json();
      const rows = json.data || [];
      customFieldsById = {};
      rows.forEach(r => { customFieldsById[String(r.id)] = r; });
    }

    showMessage("Searching...");
    // 1. Get ID from search
    const listUrl = `${LIST_FN}?query=${encodeURIComponent(matterNumber)}`;
    const lResp = await fetch(listUrl, { headers: { Authorization: `Bearer ${cachedAccessToken}` } });
    const lJson = await lResp.json();
    const matterId = lJson.data?.[0]?.id;

    if (!matterId) {
      showMessage("Matter not found.");
      return;
    }

    // 2. Get Details
    const dUrl = `${DETAIL_FN}?id=${matterId}`;
    const dResp = await fetch(dUrl, { headers: { Authorization: `Bearer ${cachedAccessToken}` } });
    const dJson = await dResp.json();
    
    // DEBUG OUTPUT
    const debugEl = document.getElementById("debug-raw");
    if (debugEl) debugEl.textContent = JSON.stringify(dJson, null, 2);

    if (dJson.error) {
      showMessage("API Error: " + dJson.error.message);
      return;
    }

    currentMatter = buildFieldBag(dJson.data, customFieldsById);
    renderFields();
    clearMessage();
  } catch (err) {
    showMessage("Search Error: " + err.message);
  }
}

function buildFieldBag(matter, cfMap) {
  const bag = {};
  const cfvs = matter.custom_field_values || [];
  
  cfvs.forEach(cfv => {
    // Attempt to get name from the value object first, then the map
    const name = cfv.custom_field?.name || cfMap[String(cfv.custom_field?.id)]?.name;
    if (name) {
      const key = name.toLowerCase().trim();
      bag[key] = cfv.value || cfv.picklist_option?.option || "—";
    }
  });

  const get = (k) => bag[k.toLowerCase().trim()] || "—";

  return {
    client_name: matter.client?.name || "—",
    matter_number: matter.display_number || "—",
    practice_area: matter.practice_area?.name || "—",
    adverse_party_name: get("Adverse Party Name"),
    case_name: get("Case Name (a v. b)"),
    court_file_no: get("Court File No. (Pleadings)"),
    court_name: get("Court (pleadings)"),
    judge_name: get("Judge Name")
  };
}

function renderFields() {
  document.querySelectorAll(".cdr-field").forEach((el) => {
    const key = el.getAttribute("data-field");
    const val = currentMatter?.[key] || "—";
    
    if (!el.dataset.label) el.dataset.label = el.textContent.trim();
    
    el.innerHTML = `<div class="cdr-field-label">${el.dataset.label}</div><div class="cdr-field-value">${val}</div>`;
    if (val === "—") el.classList.add("cdr-field-empty");
    else el.classList.remove("cdr-field-empty");
  });
}

// ... (Keep your existing authenticateClio, exchangeCodeForToken, showMessage, clearMessage functions here)
