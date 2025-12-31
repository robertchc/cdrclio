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

  if (!resp.ok) {
    const body = await safeReadText(resp);
    throw new Error(`Custom fields lookup failed (${resp.status}): ${body}`);
  }

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

  if (!matterNumber) {
    showMessage("Please enter a matter number.");
    return;
  }

  currentMatter = null;
  renderFields();

  try {
    if (!cachedAccessToken) {
      showMessage("Signing in to Clio...");
      cachedAccessToken = await authenticateClio();
    }

    showMessage("Loading custom fields...");
    try {
      customFieldsById = await loadCustomFields(cachedAccessToken);
    } catch (cfError) {
      console.warn("Field definitions failed, using fallback.", cfError);
      customFieldsById = {};
    }

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
    const msg = String(error || "");
    if (msg.includes("401") || msg.toLowerCase().includes("unauthorized")) {
      cachedAccessToken = null;
      customFieldsById = null;
    }
    currentMatter = null;
    renderFields();
    showMessage("Search failed: " + (error.message || "Unknown error"));
  }
}

async function fetchMatterFieldBagByMatterNumber(accessToken, matterNumber, cfMap) {
  // ... (previous search code) ...
  const matterId = listJson?.data?.[0]?.id;
  if (!matterId) return null;

  const detailUrl = `${DETAIL_FN}?id=${matterId}`;
  const detailResp = await fetch(detailUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });

  const detailJson = await detailResp.json();
  
  // ADD THIS LINE HERE:
  debugRaw(detailJson); 

  return buildFieldBag(detailJson.data, cfMap);
}


// --- LOGIC FUNCTIONS ---

function buildFieldBag(matter, cfMap) {
  if (!matter) return null;

  const custom = Object.create(null);
  const cfvs = Array.isArray(matter.custom_field_values) ? matter.custom_field_values : [];

  cfvs.forEach((cfv) => {
    // 1. Identify the field using the Definition ID
    const customFieldId = cfv?.custom_field?.id; 
    if (customFieldId == null) return;

    const numericId = String(customFieldId).replace(/\D/g, "");
    const meta = cfMap ? cfMap[numericId] : null;
    const name = meta ? meta.name : null;
    if (!name) return;

    const key = name.toLowerCase().trim();

    // 2. Extract the Value (Logic for Picklists vs. Text vs. Objects)
    let val = cfv?.value;

    // PRIORITY: If there is a picklist_option, use the user-friendly text (e.g., "Yes")
    if (cfv?.picklist_option && cfv.picklist_option.option) {
      val = cfv.picklist_option.option;
    } 
    // FALLBACK: If value is an object (like a Contact), try to find a name property
    else if (val && typeof val === "object") {
      val = val.name || val.display_name || val.first_name || JSON.stringify(val);
    }

    // Store cleaned string
    custom[key] = (val !== undefined && val !== null) ? String(val).trim() : null;
  });

  const getCf = (name) => {
    if (!name) return "—";
    const found = custom[name.toLowerCase().trim()];
    // Prevent "null" or "undefined" strings from appearing in the document
    return (found && found !== "null" && found !== "undefined") ? found : "—";
  };

  // 3. Map to your specific Word Template fields
  return {
    client_name: matter.client?.name || "—",
    matter_number: matter.display_number || "—",
    practice_area: (matter.practice_area?.name || matter.practice_area) || "—",
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

// --- UI & AUTH HELPERS ---

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
  Office.context.document.setSelectedDataAsync(
    text,
    { coercionType: Office.CoercionType.Text },
    (result) => {
      if (result.status === Office.AsyncResultStatus.Failed) {
        console.error("Insertion failed: " + result.error.message);
      }
    }
  );
}

function authenticateClio() {
  return new Promise((resolve, reject) => {
    Office.context.ui.displayDialogAsync(
      DIALOG_START_URL,
      { height: 60, width: 40 },
      (result) => {
        if (result.status === Office.AsyncResultStatus.Failed) {
          reject(result.error);
          return;
        }
        const dialog = result.value;
        dialog.addEventHandler(Office.EventType.DialogMessageReceived, async (arg) => {
          try {
            const tokenResponse = await exchangeCodeForToken(arg.message);
            if (!tokenResponse?.access_token) throw new Error("Token exchange did not return an access_token.");
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

  if (!resp.ok) {
    const body = await safeReadText(resp);
    throw new Error(`Token exchange failed (${resp.status}): ${body}`);
  }

  return resp.json();
}

function clearMessage() {
  const status = document.getElementById("status");
  if (!status) return;
  status.style.display = "none";
  status.textContent = "";
}

function showMessage(text) {
  const status = document.getElementById("status");
  if (!status) return;
  status.style.display = "block";
  status.textContent = text;
}

function debugRaw(obj) {
  const pre = document.getElementById("debug-raw");
  if (!pre) return;
  try {
    pre.textContent = JSON.stringify(obj, null, 2);
  } catch {
    pre.textContent = String(obj);
  }
}

async function safeReadText(resp) {
  try {
    return await resp.text();
  } catch {
    return "";
  }
}
