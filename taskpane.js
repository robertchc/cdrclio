/* global document, Office, fetch */

const BASE_URL = "https://meek-seahorse-afd241.netlify.app";
const LIST_FN = `${BASE_URL}/.netlify/functions/clioMatters`;
const DETAIL_FN = `${BASE_URL}/.netlify/functions/clioMatterById`;
const CUSTOM_FIELDS_FN = `${BASE_URL}/.netlify/functions/clioCustomFields`;

let cachedAccessToken = null;
let currentMatter = null;
let customFieldsById = null;

Office.onReady((info) => {
  if (info.host !== Office.HostType.Word) return;

  document.getElementById("app-body").style.display = "block";
  document.getElementById("searchButton").onclick = searchMatter;

  // Accordion Toggles
  document.querySelectorAll(".cdr-group-toggle").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      toggle.classList.toggle("expanded");
      const content = toggle.nextElementSibling;
      if (content) content.classList.toggle("expanded");
    });
  });

  // Click-to-Insert Logic
  document.querySelectorAll(".cdr-field").forEach((el) => {
    el.addEventListener("click", () => {
      const key = el.getAttribute("data-field");
      const value = currentMatter?.[key];
      if (!value || value === "—") {
        showMessage("No value available to insert.");
        return;
      }
      insertTextAtCursor(String(value));
    });
  });
});

async function searchMatter() {
  const input = document.getElementById("matterNumber");
  const matterNumber = (input?.value || "").trim();
  if (!matterNumber) return showMessage("Please enter a matter number.");

  try {
    if (!cachedAccessToken) {
      showMessage("Authenticating...");
      // For this implementation, we assume your auth flow sets cachedAccessToken
      // or triggers the dialog. Replace with your auth logic if needed.
    }

    showMessage("Loading mapping...");
    customFieldsById = await loadCustomFields(cachedAccessToken);

    showMessage("Searching...");
    const fieldBag = await fetchMatterFieldBagByMatterNumber(cachedAccessToken, matterNumber, customFieldsById);

    if (!fieldBag) {
      showMessage("No matter found.");
      currentMatter = null;
    } else {
      currentMatter = fieldBag;
      clearMessage();
    }
    renderFields();
  } catch (error) {
    console.error(error);
    showMessage("Error: " + error.message);
  }
}

async function fetchMatterFieldBagByMatterNumber(accessToken, matterNumber, cfMap) {
  // 1. Search for Matter ID
  const listResp = await fetch(`${LIST_FN}?query=${encodeURIComponent(matterNumber)}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  
  const listData = await listResp.json(); // Defined here
  const matterId = listData?.data?.[0]?.id;
  if (!matterId) return null;

  // 2. Get Details
  const detailResp = await fetch(`${DETAIL_FN}?id=${matterId}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  
  const detailData = await detailResp.json();
  
  // Update the debug box so you can see the raw data!
  debugRaw(detailData);

  return buildFieldBag(detailData.data, cfMap);
}

function buildFieldBag(matter, cfMap) {
  if (!matter) return null;
  const custom = {};
  const cfvs = matter.custom_field_values || [];

  cfvs.forEach((cfv) => {
    const cfId = cfv?.custom_field?.id;
    if (!cfId) return;

    const meta = cfMap ? cfMap[String(cfId)] : null;
    if (meta && meta.name) {
      const key = meta.name.toLowerCase().trim();
      let val = cfv.value;
      if (cfv.picklist_option) val = cfv.picklist_option.option;
      custom[key] = val;
    }
  });

  const getCf = (name) => {
    const val = custom[name.toLowerCase().trim()];
    return (val !== undefined && val !== null) ? String(val) : "—";
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
    date_of_separation: getCf("Date of Separation"),
    judge_name: getCf("Judge Name ie. Justice Jim Doe"),
    // ... add other fields here following the same pattern
  };
}

// UI HELPERS
function renderFields() {
  document.querySelectorAll(".cdr-field").forEach((el) => {
    const key = el.getAttribute("data-field");
    const val = currentMatter?.[key] || "—";
    
    // Simple UI update: find or create value span
    let valSpan = el.querySelector(".cdr-field-value");
    if (!valSpan) {
      el.innerHTML = `<span class="cdr-field-label">${el.textContent}</span><span class="cdr-field-value"></span>`;
      valSpan = el.querySelector(".cdr-field-value");
    }
    valSpan.textContent = val;
  });
}

function debugRaw(obj) {
  const pre = document.getElementById("debug-raw");
  if (pre) pre.textContent = JSON.stringify(obj, null, 2);
}

function showMessage(msg) {
  const status = document.getElementById("status");
  status.style.display = "block";
  status.textContent = msg;
}

function clearMessage() {
  document.getElementById("status").style.display = "none";
}

function insertTextAtCursor(text) {
  Office.context.document.setSelectedDataAsync(text, { coercionType: Office.CoercionType.Text });
}

// Ensure loadCustomFields is defined or imported
async function loadCustomFields(token) {
    const resp = await fetch(CUSTOM_FIELDS_FN, { headers: { Authorization: `Bearer ${token}` } });
    const json = await resp.json();
    const map = {};
    (json.data || []).forEach(cf => { map[String(cf.id)] = cf; });
    return map;
}
