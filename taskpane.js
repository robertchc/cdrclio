/* global document, Office */

const CLIENT_ID = "L7275gMi9MT75hiBh8SoUDSIXbt2SgSg6jSbpg1e";
const CLIENT_SECRET = "Si5nz9zY4MlWEkNkjHTHewdd4t2aPhC7UxdDjkcF";

const BASE_URL = "https://meek-seahorse-afd241.netlify.app";
const REDIRECT_URI = `${BASE_URL}/auth.html`;
const DIALOG_START_URL = `${BASE_URL}/auth-start.html`;

// Netlify functions
const LIST_FN = `${BASE_URL}/.netlify/functions/clioMatters`;       // list search
const DETAIL_FN = `${BASE_URL}/.netlify/functions/clioMatterById`;  // single matter by id
const CUSTOM_FIELDS_FN = `${BASE_URL}/.netlify/functions/clioCustomFields`; // list custom fields (id->name)

let cachedAccessToken = null;
let currentMatter = null;
let customFieldsById = null;

Office.onReady((info) => {
  if (info.host !== Office.HostType.Word) return;

  const appBody = document.getElementById("app-body");
  if (appBody) appBody.style.display = "block";

  const btn = document.getElementById("searchButton");
  if (btn) btn.onclick = searchMatter;

  // Collapsible tiers
  document.querySelectorAll(".cdr-group-toggle").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      toggle.classList.toggle("expanded");
      const content = toggle.nextElementSibling;
      if (content) content.classList.toggle("expanded");
    });
  });

  // Click-to-insert fields
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

  // Ensure placeholders show before first search
  renderFields();
});

async function loadCustomFields(accessToken) {
  if (customFieldsById) return customFieldsById;

  const resp = await fetch(CUSTOM_FIELDS_FN, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Custom fields lookup failed (${resp.status}). ${text}`);
  }

  const json = await resp.json();
  const rows = Array.isArray(json?.data) ? json.data : [];

  const map = Object.create(null);
  for (const cf of rows) {
    if (cf?.id == null) continue;
    map[String(cf.id)] = {
      name: cf?.name ? String(cf.name).trim() : null,
      field_type: cf?.field_type ? String(cf.field_type).trim() : null,
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

  try {
    if (!cachedAccessToken) {
      showMessage("Signing in to Clio...");
      cachedAccessToken = await authenticateClio();
      console.log("Access Token:", cachedAccessToken);
    }

    showMessage("Loading custom fields...");
    const cfMap = await loadCustomFields(cachedAccessToken);

    showMessage("Searching Clio...");
    const fieldBag = await fetchMatterFieldBagByMatterNumber(cachedAccessToken, matterNumber, cfMap);

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
    showMessage("Search failed (see console for details).");
  }
}

/**
 * Shows the value under each label in the tier list.
 * (These are still clickable to insert.)
 */
function renderFields() {
  document.querySelectorAll(".cdr-field").forEach((el) => {
    const key = el.getAttribute("data-field");
    if (!key) return;

    // Preserve original label text once
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
    function (result) {
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
            const msg = String(arg.message || "");
            if (msg.startsWith("error:")) throw new Error(msg);

            const code = msg;
            const tokenResponse = await exchangeCodeForToken(code);
            resolve(tokenResponse.access_token);
          } catch (e) {
            reject(e);
          } finally {
            dialog.close();
          }
        });

        dialog.addEventHandler(Office.EventType.DialogEventReceived, (arg) => {
          reject(new Error(`Dialog closed or failed. Code: ${arg.error}`));
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

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Token exchange failed (${resp.status}). ${text}`);
  }

  return resp.json();
}

/**
 * Two-step fetch:
 *  1) Search list endpoint for id/display_number/client
 *  2) Fetch single matter by id with custom_field_values (no nesting)
 *  3) Build a field bag using cfMap (custom field id->name)
 */
async function fetchMatterFieldBagByMatterNumber(accessToken, matterNumber, cfMap) {
  // 1) LIST SEARCH
  const listFields = "id,display_number,client{name,first_name,last_name},status";
  const listUrl =
    `${LIST_FN}?query=${encodeURIComponent(matterNumber)}` +
    `&fields=${encodeURIComponent(listFields)}`;

  const listResp = await fetch(listUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!listResp.ok) {
    const text = await listResp.text().catch(() => "");
    throw new Error(`Matters lookup failed (${listResp.status}). ${text}`);
  }

  const listJson = await listResp.json();
  const records = Array.isArray(listJson?.data) ? listJson.data : [];
  if (!records.length) return null;

  // Tolerant match helpers
  const norm = (s) => String(s || "").trim();
  const digits = (s) => norm(s).replace(/\D/g, "");

  const target = norm(matterNumber);
  const targetDigits = digits(matterNumber);

  const match =
    records.find((m) => norm(m?.display_number) === target) ||
    records.find((m) => digits(m?.display_number) === targetDigits) ||
    records.find((m) => norm(m?.display_number).startsWith(target)) ||
    records.find((m) => digits(m?.display_number).startsWith(targetDigits)) ||
    records[0];

  const matterId = match?.id;
  if (!matterId) return null;

  // 2) DETAIL FETCH (custom_field_values is requested safely without nesting)
  const detailFields = "id,display_number,number,status,client,custom_field_values";
  const detailUrl =
    `${DETAIL_FN}?id=${encodeURIComponent(matterId)}` +
    `&fields=${encodeURIComponent(detailFields)}`;

  const detailResp = await fetch(detailUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!detailResp.ok) {
    const text = await detailResp.text().catch(() => "");
    throw new Error(`Matter detail failed (${detailResp.status}). ${text}`);
  }

  const detailJson = await detailResp.json();
  const matter = detailJson?.data;
  if (!matter) return null;

  return buildFieldBag(matter, cfMap);
}

function buildFieldBag(matter, cfMap) {
  const custom = Object.create(null);
  const cfvs = Array.isArray(matter?.custom_field_values) ? matter.custom_field_values : [];

  // IMPORTANT: matter.custom_field_values typically contains custom_field{id} and value.
  // We translate custom_field.id -> name using cfMap.
  for (const cfv of cfvs) {
    const id = cfv?.custom_field?.id;
    if (id == null) continue;

    const meta = cfMap?.[String(id)];
    const name = meta?.name ? String(meta.name).trim() : null;
    if (!name) continue;

    const raw = cfv?.value;

    let val = null;
    if (raw == null) val = null;
    else if (typeof raw === "string") val = raw.trim() || null;
    else if (typeof raw === "number" || typeof raw === "boolean") val = String(raw);
    else if (typeof raw === "object") {
      // Some types may return objects; try common patterns first.
      if (raw.name) val = String(raw.name).trim();
      else val = JSON.stringify(raw);
    } else val = String(raw);

    custom[name] = val || null;
  }

  const client =
    (matter?.client?.name && String(matter.client.name).trim()) ||
    `${String(matter?.client?.first_name || "").trim()} ${String(matter?.client?.last_name || "").trim()}`.trim() ||
    null;

  return {
    // Tier 1
    client_name: client,
    adverse_party_name: custom["Adverse Party Name"] || null,
    case_name: custom["Case Name (a v. b)"] || null,
    court_file_no: custom["Court File No. (Pleadings)"] || null,
    court_name: custom["Court (pleadings)"] || null,

    // Tier 2
    date_of_separation: custom["Date of Separation"] || null,
    date_of_marriage: custom["Date of Marriage"] || null,
    date_of_divorce: custom["Date of Divorce"] || null,
    date_of_most_recent_order: custom["Date of Most Recent Order"] || null,
    type_of_most_recent_order: custom["Type of Most Recent Order"] || null,
    judge_name: custom["Judge Name ie. Justice Jim Doe"] || null,
    your_honour: custom["My Lord/Lady/Your Honour"] || null,

    // Tier 3
    matter_number: matter?.display_number ? String(matter.display_number).trim() : null,
    matter_status: matter?.status ? String(matter.status).trim() : null,
    matter_stage: custom["Matter stage"] || null,
    responsible_attorney: custom["Responsible Attorney"] || null,
    originating_attorney: custom["Originating Attorney"] || null,
    opposing_counsel: custom["Opposing Counsel"] || null,

    // Tier 4
    matrimonial_status: custom["Matrimonial Status"] || null,
    cohabitation_begin_date: custom["Co-Habitation Begin Date"] || null,
    common_law_begin_date: custom["Spousal Common-Law Begin Date"] || null,
    place_of_marriage: custom["Place of Marriage"] || null,
    adverse_dob: custom["Adverse DOB"] || null,

    __custom: custom,
  };
}

/* ---------- UI helpers ---------- */

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
  msg.style.border = "1px solid #ddd";
  msg.style.background = "#f7f7f7";
  msg.style.marginTop = "10px";
  msg.textContent = text;

  detailsSection.prepend(msg);
}
