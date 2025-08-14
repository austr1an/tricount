let addMode = true;
let editEntryId = null;
let partition = {};
let SYMBOL = localStorage.getItem("SYMBOL") || "$";
let DECIMALS = parseInt(localStorage.getItem("DECIMALS"));
let LATEST_ID = parseInt(localStorage.getItem("LATEST_ID"));
if (isNaN(LATEST_ID)) LATEST_ID = -1;
if (isNaN(DECIMALS) || DECIMALS < 0 || DECIMALS > 4) DECIMALS = 2;

let alertOn = false;

let participants = JSON.parse(localStorage.getItem("participants") || "{}");
let entries = JSON.parse(localStorage.getItem("entries") || "{}");

// Initialize with former data

for (let id in participants) makeContributorView(id);

iCostSymbol.innerText = SYMBOL;
iSymbol.value = SYMBOL;
iDecimals.value = DECIMALS.toString();
resetEntryForm();
renderBalances();
renderEntries();

// Storage manager

function save() {
    localStorage.setItem("participants", JSON.stringify(participants));
    localStorage.setItem("entries", JSON.stringify(entries));
    localStorage.setItem("LATEST_ID", LATEST_ID.toString());
    localStorage.setItem("SYMBOL", SYMBOL);
    localStorage.setItem("DECIMALS", DECIMALS.toString());
}

function reset() {
    if (!confirm("Are you sure you want to reset the Tricount?")) return;
    localStorage.clear();
    participants = {};
    entries = {};
    SYMBOL = "$";
    DECIMALS = 2;

    // Reset views
    iRmParticipant.innerHTML = "";
    iPaidBy.innerHTML = "";
    iContributors.innerHTML = "";
    iCostSymbol.innerText = SYMBOL;
    iSymbol.value = SYMBOL;
    iDecimals.value = DECIMALS.toString();
    resetEntryForm();
    renderEntries();
    renderBalances();
}

iReset.onclick = reset;

// Symbol manager

function setSymbol() {
    SYMBOL = iSymbol.value.trim() || "$";
    DECIMALS = parseInt(iDecimals.value);
    if (isNaN(DECIMALS) || DECIMALS < 0 || DECIMALS > 4) DECIMALS = 2;

    iCostSymbol.innerText = SYMBOL;

    renderEntries();
    renderBalances();
    renderContributions();
    save();
}

iSymbol.onkeyup = setSymbol;
iDecimals.onkeyup = setSymbol;
iDecimals.onchange = setSymbol;

// Id manager

function newId() {
    return (++LATEST_ID).toString();
}

// Participants

function addParticipant() {
    let name = iParticipant.value.trim();
    if (!name) return;
    let id = newId();
    participants[id] = name;
    partition[id] = 1;
    iParticipant.value = "";

    for (let eid in entries) if (!(id in entries[eid].partition)) entries[eid].partition[id] = 0;

    // Update views
    makeContributorView(id);

    renderBalances();
    renderContributions();
    save();
}

iButtonAddPart.onclick = addParticipant;
iParticipant.onkeyup = (e) => {
    if (e.key === "Enter") addParticipant();
};

function removeParticipant() {
    let id = iRmParticipant.value;
    if (!id) return;
    delete participants[id];
    delete partition[id];

    // Update views

    for (let el of Array.from(document.getElementsByClassName("dynParticipantRef_" + id)))
        el.remove();

    // Remove matching entries
    for (let eid in entries) {
        let entry = entries[eid];
        if (entry.contributors.includes(id))
            entry.contributors = entry.contributors.filter((cid) => cid !== id);
        if (id in entry.partition) delete entry.partition[id];
        if (id in entry.details) {
            entry.cost -= entry.details[id];
            delete entry.details[id];
        }
        if (entry.paidBy === id) delete entries[eid];
    }
    renderEntries();
    renderBalances();
    resetEntryForm();
    save();
}

iButtonRmPart.onclick = removeParticipant;

// Entries

function getContributors() {
    return document.querySelectorAll(".contributor input");
}

function addAlert(message) {
    alertOn = true;
    if (iAlertMessage.innerText != "") iAlertMessage.innerHTML += "<br />";
    iAlertMessage.innerText += message;
}

function clearAlert() {
    alertOn = false;
    iAlertMessage.innerText = "";
}

function callEntry() {
    let title = iTitle.value.trim();
    let cost = parseFloat(iCost.value);
    let paidBy = iPaidBy.value;
    let method = iMethod.value;

    let contributors = Array.from(getContributors())
        .filter((i) => i.checked)
        .map((i) => i.name);

    clearAlert();
    if (!title) addAlert("Title cannot be empty");
    if (!cost) addAlert("A cost must be provided");
    if (!paidBy) addAlert("Payer must be provided");
    if (!method) addAlert("A division method must be provided");
    if (contributors.length === 0) addAlert("At least one participant must be selected");

    let details = {};
    if (method == "detailed") {
        for (let id of contributors) {
            let detailedCost = parseFloat(document.getElementById("iDynDetail_" + id).value);

            if (isNaN(detailedCost)) addAlert("Invalid cost for " + participants[id]);
            details[id] = detailedCost;
        }

        // Filter out contributors with 0 detailed cost
        contributors = contributors.filter((id) => details[id] != 0);
    }

    if (alertOn) return;

    let entry = {
        title,
        cost,
        paidBy,
        method,
        contributors,
        partition,
        details,
    };

    if (addMode) {
        entries[newId()] = entry;
    } else {
        entries[editEntryId] = entry;
    }

    // Reset form
    resetEntryForm();

    // Update views
    renderEntries();
    renderBalances();

    // Save
    save();
}

iButtonCallEntry.onclick = callEntry;

function resetEntryForm() {
    iTitle.value = "";
    iCost.value = "";
    iCost.disabled = false;
    iPaidBy.value = iPaidBy.options[0]?.value || "";
    iMethod.value = "split";
    clearAlert();
    for (let input of getContributors()) input.checked = true;
    if (!addMode) switchMode();
    resetPartition();
    renderContributions();

    // Unselect entry if one is currently selected
    document.querySelector(".selected")?.classList.remove("selected");
}

iButtonCancel.onclick = resetEntryForm;

function renderContributions() {
    let cost = parseFloat(iCost.value);
    if (isNaN(cost)) cost = 0;

    for (let id in participants) {
        let contribution = document.querySelector(`#iDynContribLabel_${id} .contribution`);
        let checked = document.getElementById("iDynContrib_" + id).checked;

        let totalContributors = Array.from(getContributors()).filter((e) => e.checked).length;

        switch (iMethod.value) {
            // Split equally
            case "split":
                contribution.innerText = checked
                    ? `${SYMBOL} ${(cost / totalContributors).toFixed(DECIMALS)}`
                    : `${SYMBOL} 0.00`;

                break;

            // Split as parts
            case "parts":
                let parts = partition[id];
                let totalParts = Object.values(partition).reduce((a, b) => a + b, 0);

                if (totalParts <= 0) totalParts = 1;

                contribution.innerHTML = `
                    x${parts}
                    <button id="iDynPlus_${id}">+</button>
                    <button id="iDynMinus_${id}" ${parts <= 0 ? "disabled" : ""}>-</button>
                    ${SYMBOL} ${((parts * cost) / totalParts).toFixed(DECIMALS)}
                `;

                document.getElementById("iDynPlus_" + id).onclick = changePartition;
                document.getElementById("iDynMinus_" + id).onclick = changePartition;

                break;

            // Split as amounts
            case "detailed":
                // If "Split as amounts" views is already on, skip to keep balances
                if (contribution.children[0]?.tagName.toLowerCase() !== "input")
                    contribution.innerHTML = `${SYMBOL} <input type="number" name="iDynDetail_${id}" id="iDynDetail_${id}" value="${(
                        cost / (totalContributors || 1)
                    ).toFixed(DECIMALS)}" />`;
                let input = contribution.children[0];
                input.onkeyup = renderContributions;
                input.disabled = !checked;
                if (!checked) input.value = "0.00";
                break;
        }
    }

    // Split as amounts: set total cost
    if (iMethod.value == "detailed") {
        let totalCost = 0;
        for (let id in participants) {
            let currentCost = parseFloat(document.getElementById("iDynDetail_" + id).value);
            if (currentCost) totalCost += currentCost;
        }

        iCost.value = totalCost.toFixed(DECIMALS);
    }
}

iCost.onkeyup = renderContributions;

function resetPartition() {
    partition = {};
    for (let id in participants) partition[id] = 1;
}

function initializeMethod() {
    iCost.disabled = false;

    switch (iMethod.value) {
        case "parts":
            resetPartition();
            break;

        case "detailed":
            iCost.disabled = true;
            break;
    }

    renderContributions();
}

iMethod.onchange = initializeMethod;

function changePartition(click) {
    let id = click.target.id.split("_")[1];
    let isPlus = click.target.id.startsWith("iDynPlus_");

    if (isPlus) partition[id]++;
    else partition[id]--;

    document.getElementById("iDynContrib_" + id).checked = partition[id] >= 1;

    renderContributions();
}

function switchMode() {
    addMode = !addMode;
    iTextEntryMode.innerText = addMode ? "New entry" : "Edit entry";
    iButtonCallEntry.innerText = addMode ? "Add" : "Update";
    iDeleteEntry.classList.toggle("nodisplay");
}

// Delete entry

function deleteEntry() {
    delete entries[editEntryId];
    resetEntryForm();
    renderEntries();
    renderBalances();
    save();
}

iDeleteEntry.onclick = deleteEntry;

// Rendering

function parseMethod(method) {
    switch (method) {
        case "split":
            return "Split equally";
        case "parts":
            return "Split as parts";
        case "detailed":
            return "Split as amounts";
    }
}

function renderEntries() {
    iEntries.innerHTML = "";

    for (let id in entries) {
        let entry = entries[id];
        let div = document.createElement("div");
        div.className = "entry";
        div.id = "iDynEntry_" + id;
        div.innerHTML = `
            <h4>${entry.title}</h4>
            <p>Paid by <span class="bold">${participants[entry.paidBy]}</span><br />
            For <span class="bold">${entry.contributors.length}</span> participant${
            entry.contributors.length > 1 ? "s" : ""
        } (${parseMethod(entry.method)})</p>
            <p class="entry_cost">${SYMBOL} ${entry.cost.toFixed(DECIMALS)}</p>
        `;
        iEntries.appendChild(div);

        div.onclick = () => {
            if (!div.classList.contains("selected")) {
                renderEditEntry(id);
            } else {
                div.classList.remove("selected");
                resetEntryForm();
            }
        };
    }
}

function renderEditEntry(id) {
    if (addMode) switchMode();

    clearAlert();

    document.getElementById("iDynEntry_" + editEntryId)?.classList.remove("selected");
    editEntryId = id;
    document.getElementById("iDynEntry_" + editEntryId)?.classList.add("selected");

    let entry = entries[id];
    iTitle.value = entry.title;
    iCost.value = entry.cost.toFixed(DECIMALS);
    iCost.disabled = false;
    iPaidBy.value = entry.paidBy;
    iMethod.value = entry.method;
    partition = entry.partition;

    for (let input of getContributors()) {
        input.checked = entry.contributors.includes(input.name);
    }

    // First render to create input nodes
    renderContributions();

    // Split as amounts
    if (entry.method == "detailed") {
        iCost.disabled = true;
        for (let id of entry.contributors)
            document.getElementById("iDynDetail_" + id).value = entry.details[id].toFixed(DECIMALS);
    }

    // Another render to set iCost correctly
    renderContributions();
}

function renderBalances() {
    // Total spent
    let totalSpent = 0;
    for (let eid in entries) {
        totalSpent += entries[eid].cost;
    }

    iTotalSpent.innerText = `${SYMBOL} ${totalSpent.toFixed(DECIMALS)}`;

    // Individual balances
    iBalances.innerHTML = "";

    let balances = {};

    for (let id in participants) {
        let name = participants[id];

        let paid = 0;
        let expense = 0;

        for (let eid in entries) {
            let entry = entries[eid];
            if (entry.paidBy === id) {
                paid += entry.cost;
            }

            switch (entry.method) {
                case "split":
                    if (entry.contributors.includes(id))
                        expense += entry.cost / entry.contributors.length;
                    break;
                case "parts":
                    let totalParts = Object.values(entry.partition).reduce((a, b) => a + b, 0);
                    if (totalParts <= 0) totalParts = 1;

                    expense += (entry.cost * entry.partition[id]) / totalParts;
                    break;
                case "detailed":
                    if (entry.contributors.includes(id)) expense += entry.details[id];
                    break;
            }
        }

        balances[id] = paid - expense;

        iBalances.innerHTML += `
            <div class="balance">
                <h4>${name}</h4>
                <p>Paid: ${SYMBOL} ${paid.toFixed(DECIMALS)}<br />
                Expenses: ${SYMBOL} ${expense.toFixed(DECIMALS)}</p>
                <p class="balance_cost ${balances[id] >= 0 ? "green" : "red"}">
                    ${SYMBOL} ${balances[id].toFixed(DECIMALS)}
                </p>
            </div>`;
    }

    // Reimbursements

    iReimbursements.innerHTML = "";

    let remb = getBestReimbursement(balances);

    while (remb != null) {
        let { A, B, transaction } = remb;
        balances[A] += transaction;
        balances[B] -= transaction;

        iReimbursements.innerHTML += `
        <div class="reimbursement">
            <p><span class="bold">${participants[A]}</span> owes <span class="bold">${
            participants[B]
        }</span></p>
            <p>${SYMBOL} ${transaction.toFixed(DECIMALS)}</p>
        </div>
        `;

        remb = getBestReimbursement(balances);
    }
}

// Algorithm that finds the best reimbursement
// Symbols: A owes B
// B is set as the participant with the highest positive balance
// A is set as the participant with the highest negative balance under B (in absolute value)
// If A does not exist, A is set as the highest negative balance (in absolute value)
function getBestReimbursement(balances) {
    let B = -1;
    let BBalance = 0;
    for (let id in participants)
        if (balances[id] > BBalance) {
            BBalance = balances[id];
            B = id;
        }

    if (B == -1) return null;

    let transaction = 0;

    let A = -1;
    let ABalance = 0;
    for (let id in participants)
        if (-BBalance <= balances[id] && balances[id] < ABalance) {
            ABalance = balances[id];
            A = id;
        }

    if (A != -1) transaction = -ABalance;
    else {
        transaction = BBalance;
        for (let id in participants)
            if (balances[id] < ABalance) {
                ABalance = balances[id];
                A = id;
            }
        if (A == -1) return null;
    }

    return { A, B, transaction };
}

function makeContributorView(id) {
    // "Remove paticipant" and "Paid by"
    for (let select of [iRmParticipant, iPaidBy]) {
        let opt = document.createElement("option");
        opt.value = id;
        opt.textContent = participants[id];
        opt.className = "dynParticipantRef_" + id;
        select.appendChild(opt);
    }

    // Contributors list
    const label = document.createElement("label");
    label.id = "iDynContribLabel_" + id;
    label.htmlFor = "iDynContrib_" + id;
    label.className = "contributor dynParticipantRef_" + id;
    label.innerHTML = `
    <div>
        <input type="checkbox" id="iDynContrib_${id}" name="${id}" ${addMode ? "checked" : ""} />
        ${participants[id]}
    </div>
    <p class="contribution">${SYMBOL} 0.00</p>
    `;

    iContributors.appendChild(label);

    label.onclick = (click) => {
        // plus or minus buttons
        if (click.target.tagName.toLowerCase() == "button") return;
        if (click.target.tagName.toLowerCase() == "input" && click.target.type == "number") return;

        switch (iMethod.value) {
            case "parts":
                partition[id] = document.getElementById("iDynContrib_" + id).checked ? 1 : 0;
                break;
        }
        renderContributions();
    };
}
