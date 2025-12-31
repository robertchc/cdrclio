/* global document, Office, fetch */

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

  // Accordion logic
  document.querySelectorAll(".cdr-group-toggle").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      toggle.classList.toggle("expanded");
      const content = toggle.nextElementSibling;
      if (content) content.classList.toggle("expanded");
    });
  });

  // Insertion logic
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

// --- CORE SEARCH LOGIC ---

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

    showMessage("Loading field definitions...");
    customFieldsById = await loadCustomFields(cachedAccessToken);

    showMessage("Searching Clio for " + matterNumber + "...");
    const fieldBag = await fetchMatterFieldBagByMatterNumber(cachedAccessToken, matterNumber, customFieldsById);

    if (!fieldBag) {
      currentMatter = null;
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

// --- DATA FETCHING ---

async function fetchMatterFieldBagByMatterNumber(accessToken, matterNumber, cfMap) {
  // 1. Search for Matter ID by Number
  const listUrl = `${LIST_FN}?query=${encodeURIComponent(matterNumber)}`;
  const listResp = await fetch(listUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });

  if (!listResp.ok) throw new Error(`Search failed: ${listResp.status}`);
  const listJson = await listResp.json();
  const matterId = listJson?.data?.[0]?.id;
  
  if (!matterId) return null;

  // 2. Fetch the full Matter details including Custom Fields
  const detailUrl = `${DETAIL_FN}?id=${matterId}`;
  const detailResp = await fetch(detailUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });

  if (!detailResp.ok) throw new Error(`Detail fetch failed: ${detailResp.status}`);
  const detailJson = await detailResp.json();
  
  // Update the debug pane with raw JSON
  debugRaw(detailJson);

  return buildFieldBag(detailJson.data, cfMap);
}

function buildFieldBag(matter, cfMap) {
  if (!matter) return null;

  const custom = Object.create(null);
  const cfvs = Array.isArray(matter.custom_field_values) ? matter.custom_field_values : [];

  cfvs.forEach((cfv) => {
    const cfId = cfv?.custom_field?.id;
    if (!cfId) return;

    const sid = String(cfId);
    const meta = cfMap ? cfMap[sid] : null;

    if (meta && meta.name) {
      const key = meta.name.toLowerCase().trim();
      let val = cfv.value;

      if (cfv.picklist_option && cfv.picklist_option.option) {
        val = cfv.picklist_option.option;
      } 
      
      if (val === null || val === undefined) val = "";
      custom[key] = String(val).trim();
    }
  });

  const getCf = (name) => {
    const found = custom[name.toLowerCase().trim()];
    return (found && found !== "") ? found : "—";
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
    date_of_marriage: getCf("Date of Marriage"),
    date_of_divorce: getCf("Date of Divorce"),
    date_of_most_recent_order: getCf("Date of Most Recent Order"),
    type_of_most_recent_order: getCf("Type of Most Recent Order"),
    judge_name: getCf("Judge Name ie. Justice Jim Doe"),
    your_honour: getCf("My Lord/Lady/Your Honour"),
    matter_stage: getCf("Matter stage"),
    responsible_attorney: getCf("Responsible Attorney"),
    originating_attorney: getCf("Originating Attorney"),
    opposing_counsel: getCf("Opposing Counsel"),
    matrimonial_status: getCf("Matrimonial Status"),
    cohabitation_begin_date: getCf("Co-Habitation Begin Date"),
    common_law_begin_date: getCf("Spousal Common-Law Begin Date"),
    place_of_marriage: getCf("Place of Marriage"),
    adverse_dob: getCf("Adverse DOB")
  };
}

// --- ORIGINAL AUTHENTICATION FLOW ---

function authenticateClio() {
  return new Promise((resolve, reject) => {
    Office.context.ui.displayDialogAsync(
      DIALOG_START_URL,
      { height: 60, width: 40 },
      (result) => {
        if (result.status === Office.AsyncResultStatus.Failed) {
          reject(new Error(result.error.message));
          return;
        }
        const dialog = result.value;
        dialog.addEventHandler(Office.EventType.DialogMessageReceived, async (arg) => {
          try {
            const tokenResponse = await exchangeCodeForToken(arg.message);
            if (!tokenResponse?.access_token) throw new Error("No access_token returned.");
            resolve(tokenResponse.access_token);
          } catch (e) {
            reject(e);
          } finally {
            dialog.close();
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
      client_secret: CLIENT_SECRET
    }),
  });
  if (!resp.ok) throw new Error("Token exchange failed.");
  return resp.json();
}

// --- UI HELPERS ---

async function loadCustomFields(token) {
  if (customFieldsById) return customFieldsById;
  const resp = await fetch(CUSTOM_FIELDS_FN, { 
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } 
  });
  if (!resp.ok) return {};
  const json = await resp.json();
  const map = Object.create(null);
  (json.data || []).forEach(cf => {
    if (cf?.id) map[String(cf.id)] = cf;
  });
  customFieldsById = map;
  return map;
}

function renderFields() {
  document.querySelectorAll(".cdr-field").forEach((el) => {
    const key = el.getAttribute("data-field");
    if (!key) return;

    if (!el.dataset.label) el.dataset.label = el.textContent.trim();
    const label = el.dataset.label;
    const value = currentMatter?.[key];
    const display = value == null || String(value).trim() === "" ? "—" : String(value);

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

function insertTextAtCursor(text) {
  Office.context.document.setSelectedDataAsync(text, { coercionType: Office.CoercionType.Text });
}

function showMessage(text) {
  const status = document.getElementById("status");
  if (status) { status.style.display = "block"; status.textContent = text; }
}

function clearMessage() {
  const status = document.getElementById("status");
  if (status) status.style.display = "none";
}

function debugRaw(obj) {
  const pre = document.getElementById("debug-raw");
  if (pre) pre.textContent = JSON.stringify(obj, null, 2);
}
