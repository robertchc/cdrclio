async function searchMatter() {
    const input = document.getElementById("matterNumber");
    const matterNumber = (input?.value || "").trim();
    if (!matterNumber) return showMessage("Please enter a matter number.");

    try {
        if (!cachedAccessToken) {
            showMessage("Signing in...");
            cachedAccessToken = await authenticateClio();
        }

        showMessage("Searching...");
        const lResp = await fetch(`${LIST_FN}?query=${encodeURIComponent(matterNumber)}`, {
            headers: { Authorization: `Bearer ${cachedAccessToken}` }
        });
        const lJson = await lResp.json();
        
        // Use the first record's ID
        const matterId = (lJson.data && lJson.data.length > 0) ? lJson.data[0].id : null;

        if (!matterId) {
            showMessage(`No match found for ${matterNumber}`);
            return;
        }

        showMessage("Fetching details...");
        const dResp = await fetch(`${DETAIL_FN}?id=${matterId}`, {
            headers: { Authorization: `Bearer ${cachedAccessToken}` }
        });
        
        // This is the rollback: We take the JSON exactly as it comes
        const matter = await dResp.json();

        // Show it raw so we can see the structure immediately
        document.getElementById("debug-raw").textContent = JSON.stringify(matter, null, 2);
        
        // We look for custom_field_values directly on the object (no .data wrapper)
        const cfvs = matter.custom_field_values || (matter.data ? matter.data.custom_field_values : []);
        
        const getVal = (id) => {
            const found = cfvs.find(v => String(v.id).includes(id));
            if (!found) return "—";
            return found.value || (found.picklist_option ? found.picklist_option.option : "—");
        };

        currentMatter = {
            client_name: (matter.client?.name || matter.data?.client?.name) || "—",
            matter_number: (matter.display_number || matter.data?.display_number) || "—",
            case_name: getVal("3528784956"),
            adverse_party_name: getVal("3528784941"),
            court_file_no: getVal("3528784971"),
            court_name: getVal("3528784986"),
            judge_name: getVal("4815771545")
        };

        renderFields();
        clearMessage();

    } catch (err) {
        showMessage("Taskpane Error: " + err.message);
    }
}
