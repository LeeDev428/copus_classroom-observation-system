let countdownSeconds = 120;
let timerInterval;
const timerEl = document.getElementById("timer");
const startBtn = document.getElementById("startBtn");
let currentRow = 0;
const rows = [];

const copusDetailsIdInput = document.getElementById('copusDetailsId');
const copusDetailsId = copusDetailsIdInput ? copusDetailsIdInput.value : null;

// ==========================================================
// TEMPORARILY COMMENT OUT TIMER AND ROW HIGHLIGHTING LOGIC
// FOR DEBUGGING PURPOSES. UNCOMMENT WHEN DONE DEBUGGING.
// ==========================================================


function updateCountdown() {
    const minutes = Math.floor(countdownSeconds / 60);
    const seconds = countdownSeconds % 60;
    timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    if (countdownSeconds > 0) {
        countdownSeconds--;
    } else {
        clearInterval(timerInterval);

        // Enable edit button for the finished row
        const finishedRow = rows[currentRow];
        const editBtn = finishedRow.querySelector("button");
        if (editBtn) editBtn.disabled = false;

        // Disable inputs in the finished row
        const checkboxes = finishedRow.querySelectorAll("input[type='checkbox']");
        checkboxes.forEach(cb => cb.disabled = true);
        const commentField = finishedRow.querySelector("textarea, input[type='text']");
        if (commentField) commentField.disabled = true;

        // Remove highlight
        finishedRow.style.backgroundColor = '';

        // Move to next row or stop if last
        if (currentRow < rows.length - 1) {
            currentRow++;
            highlightRow(currentRow);
            countdownSeconds = 10;
            timerInterval = setInterval(updateCountdown, 1000);
        } else {
            // All rows finished
            console.log("Observation complete.");
        }
    }
}

function highlightRow(rowIndex) {
    rows.forEach((row) => {
        row.style.backgroundColor = '';
        const checkboxes = row.querySelectorAll("input[type='checkbox']");
        checkboxes.forEach(cb => cb.disabled = true);
        const commentField = row.querySelector("textarea, input[type='text']");
        if (commentField) commentField.disabled = true;
    });

    // Highlight the current row
    const row = rows[rowIndex];
    row.style.backgroundColor = 'yellow';
    const activeCheckboxes = row.querySelectorAll("input[type='checkbox']");
    activeCheckboxes.forEach(cb => cb.disabled = false);
    const activeComment = row.querySelector("textarea, input[type='text']");
    if (activeComment) activeComment.disabled = false;
}


// Temporarily disable the start button listener
 startBtn.addEventListener("click", () => {
     clearInterval(timerInterval);
     countdownSeconds = 10;
     timerEl.style.backgroundColor = "";
     updateCountdown();
     currentRow = 0;
     highlightRow(currentRow);
     timerInterval = setInterval(updateCountdown, 1000);
 });

// ==========================================================
// END TEMPORARY COMMENT OUT
// ==========================================================

// Generate tables (keep this, as it generates the form fields)
const tablesContainer = document.getElementById("tablesContainer");

for (let t = 0; t < 1; t++) {
    const tableWrapper = document.createElement("div");

    tableWrapper.innerHTML = `
        <table border="1" style="margin-bottom: 20px;">
            <div class="table-scroll-container" style="max-height: 70vh; overflow-y: auto; border: 1px solid #ccc;">
  <table border="1" style="width: 100%; border-collapse: collapse;">
    <thead class="table-header">
      <tr>
        <th rowspan="2" style="position: sticky; top: 50px; background-color: #2f5597; color: white; z-index: 2;">Min</th>
        <th colspan="10" style="position: sticky; top: 73px; background-color: #2f5597; color: white; z-index: 2;">Student Actions</th>
        <th colspan="11" style="position: sticky; top: 73px; background-color: #2f5597; color: white; z-index: 2;">Teacher Actions</th>
        <th colspan="3" style="position: sticky; top: 73px; background-color: #2f5597; color: white; z-index: 2;">Level of Engagement</th>
        <th rowspan="2" style="position: sticky; top: 50px; background-color: #2f5597; color: white; z-index: 2;">Comments</th>
        <th rowspan="2" style="position: sticky; top: 50px; background-color: #2f5597; color: white; z-index: 2;">Action</th>
      </tr>
      <tr>
        <th style="position: sticky; top: 55px; background-color: #2f5597; color: white; z-index: 2;">L</th>
        <th style="position: sticky; top: 55px; background-color: #2f5597; color: white; z-index: 2;">Ind</th>
        <th style="position: sticky; top: 55px; background-color: #2f5597; color: white; z-index: 2;">Grp</th>
        <th style="position: sticky; top: 55px; background-color: #2f5597; color: white; z-index: 2;">AnQ</th>
        <th style="position: sticky; top: 55px; background-color: #2f5597; color: white; z-index: 2;">AsQ</th>
        <th style="position: sticky; top: 55px; background-color: #2f5597; color: white; z-index: 2;">WC</th>
        <th style="position: sticky; top: 55px; background-color: #2f5597; color: white; z-index: 2;">SP</th>
        <th style="position: sticky; top: 55px; background-color: #2f5597; color: white; z-index: 2;">T/Q</th>
        <th style="position: sticky; top: 55px; background-color: #2f5597; color: white; z-index: 2;">W</th>
        <th style="position: sticky; top: 55px; background-color: #2f5597; color: white; z-index: 2;">O</th>

        <th style="position: sticky; top: 55px; background-color: #2f5597; color: white; z-index: 2;">Lec</th>
        <th style="position: sticky; top: 55px; background-color: #2f5597; color: white; z-index: 2;">RtW</th>
        <th style="position: sticky; top: 55px; background-color: #2f5597; color: white; z-index: 2;">MG</th>
        <th style="position: sticky; top: 55px; background-color: #2f5597; color: white; z-index: 2;">AnQ</th>
        <th style="position: sticky; top: 55px; background-color: #2f5597; color: white; z-index: 2;">PQ</th>
        <th style="position: sticky; top: 55px; background-color: #2f5597; color: white; z-index: 2;">FUp</th>
        <th style="position: sticky; top: 55px; background-color: #2f5597; color: white; z-index: 2;">1o1</th>
        <th style="position: sticky; top: 55px; background-color: #2f5597; color: white; z-index: 2;">D/V</th>
        <th style="position: sticky; top: 55px; background-color: #2f5597; color: white; z-index: 2;">Adm</th>
        <th style="position: sticky; top: 55px; background-color: #2f5597; color: white; z-index: 2;">W</th>
        <th style="position: sticky; top: 55px; background-color: #2f5597; color: white; z-index: 2;">O</th>

        <th style="position: sticky; top: 55px; background-color: #2f5597; color: white; z-index: 2;">High</th>
        <th style="position: sticky; top: 55px; background-color: #2f5597; color: white; z-index: 2;">Med</th>
        <th style="position: sticky; top: 55px; background-color: #2f5597; color: white; z-index: 2;">Low</th>
      </tr>
    </thead>
            <tbody id="copusBody${t}"></tbody>
        </table>
    `;

    tablesContainer.appendChild(tableWrapper);

    // Now generate rows inside the table body
    const tbody = tableWrapper.querySelector(`#copusBody${t}`);
    const studentActionLabels = ["L", "Ind", "Grp", "AnQ", "AsQ", "WC", "SP", "T/Q", "W", "O"];
    const teacherActionLabels = ["Lec", "RtW", "MG", "AnQ", "PQ", "FUp", "1o1", "D/V", "Adm", "W", "O"];
    const engagementLabels = ["High", "Med", "Low"];

    for (let r = 0; r < 45; r++) { // 45 rows for 90 minutes in 2-minute intervals
        const row = document.createElement("tr");

        // First cell: "Min" range (e.g., 0–2, 2–4, etc.)
        const minCell = document.createElement("td");
        const startMin = r * 2;
        const endMin = startMin + 2;
        minCell.textContent = `${startMin}–${endMin}`;
        row.appendChild(minCell);

        // Student Actions (10 checkboxes)
        for (let i = 0; i < 10; i++) {
            const td = document.createElement("td");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.dataset.label = `student-${studentActionLabels[i]}`; // Add label
            // checkbox.disabled = true; // Initially disabled - KEEP THIS COMMENTED OUT FOR DEBUGGING
            td.appendChild(checkbox);
            row.appendChild(td);
        }

        // Teacher Actions (11 checkboxes)
        for (let i = 0; i < 11; i++) {
            const td = document.createElement("td");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.dataset.label = `teacher-${teacherActionLabels[i]}`; // Add label
            // checkbox.disabled = true; // KEEP THIS COMMENTED OUT FOR DEBUGGING
            td.appendChild(checkbox);
            row.appendChild(td);
        }

        // Level of Engagement (3 checkboxes)
        for (let i = 0; i < 3; i++) {
            const td = document.createElement("td");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.name = `engagement-${r}`; // Unique name for each row's group
            checkbox.dataset.label = `engagement-${engagementLabels[i]}`; // Add label
            // checkbox.disabled = true; // KEEP THIS COMMENTED OUT FOR DEBUGGING
            checkbox.addEventListener('change', function () {
                if (this.checked) {
                    const rowNode = this.closest('tr');
                    const checkboxesInRow = rowNode.querySelectorAll('input[name="' + this.name + '"]');
                    checkboxesInRow.forEach(cb => {
                        if (cb !== this) {
                            cb.checked = false;
                        }
                    });
                }
            });
            td.appendChild(checkbox);
            row.appendChild(td);
        }

        // Comments input
        const commentCell = document.createElement("td");
        const commentInput = document.createElement("input");
        commentInput.type = "text";
        // commentInput.disabled = true; // KEEP THIS COMMENTED OUT FOR DEBUGGING
        commentCell.appendChild(commentInput);
        row.appendChild(commentCell);

        // Action cell with Edit/Save button
        const actionCell = document.createElement("td");
        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit";
        // editBtn.disabled = true; // Initially disabled - KEEP THIS COMMENTED OUT FOR DEBUGGING
        editBtn.addEventListener("click", (event) => {
            event.preventDefault();
            const isEditing = editBtn.textContent === "Save";
            const checkboxes = row.querySelectorAll("input[type='checkbox']");
            const commentField = row.querySelector("textarea, input[type='text']");

            checkboxes.forEach(cb => cb.disabled = isEditing);
            if (commentField) commentField.disabled = isEditing;

            editBtn.textContent = isEditing ? "Edit" : "Save";
        });
        actionCell.appendChild(editBtn);
        row.appendChild(actionCell);

        tbody.appendChild(row);
        rows.push(row); // Store row for later highlighting
    }
}

document.getElementById("submitBtn").addEventListener("click", async function (e) {
    e.preventDefault();

    // Get references for spinner and button text (assuming they exist in your HTML)
    const spinner = this.querySelector('.spinner');
    const btnText = this.querySelector('.btn-text');

    // Show spinner, hide text, disable button
    if (btnText) btnText.style.display = 'none';
    if (spinner) spinner.style.display = 'inline-block';
    this.disabled = true; // 'this' refers to the submit button

    // ==========================================================
    // TEMPORARILY COMMENT OUT THE VALIDATION FOR DEBUGGING
    // ==========================================================
    // let allRowsComplete = true; // This will effectively be true since we skip the check
    // ==========================================================

    const dataToSend = [];

    rows.forEach((row, index) => {
        const student = {};
        const teacher = {};
        const engagement = {};
        let comment = "";
        let hasAnyCheckedInRow = false; // Renamed to clarify it's for the current row

        // More specific selectors for inputs
        const checkboxes = row.querySelectorAll('input[type="checkbox"]');
        const commentInput = row.querySelector('input[type="text"]');

        checkboxes.forEach((checkbox) => {
            if (checkbox.checked) {
                hasAnyCheckedInRow = true;
                const label = checkbox.dataset.label; // Use dataset.label
                if (label && label.startsWith('student-')) {
                    student[label.substring(8)] = 1; // Store as 1 if checked
                } else if (label && label.startsWith('teacher-')) {
                    teacher[label.substring(8)] = 1; // Store as 1 if checked
                } else if (label && label.startsWith('engagement-')) {
                    engagement[label.substring(11)] = 1; // Store as 1 if checked
                }
            }
        });

        if (commentInput) {
            comment = commentInput.value;
        }

        // ==========================================================
        // TEMPORARILY COMMENT OUT THIS ROW VALIDATION
        // ==========================================================
        // if (!hasAnyCheckedInRow) { // Check if any checkbox was checked in the current row
        //     allRowsComplete = false;
        //     row.style.backgroundColor = 'rgba(255, 0, 0, 0.2)'; // Highlight incomplete row in light red
        // } else {
        //     row.style.backgroundColor = ''; // Remove error highlight if it was previously shown
        // }
        // ==========================================================

        dataToSend.push({
            intervalNumber: index + 1, // Add interval number for clarity
            studentActions: student, // Renamed for clarity in server-side handling
            teacherActions: teacher, // Renamed for clarity in server-side handling
            engagementLevel: engagement, // Renamed for clarity in server-side handling
            comment: comment
        });
    });

    // ==========================================================
    // TEMPORARILY COMMENT OUT THE MAIN VALIDATION CHECK
    // ==========================================================
    // if (!allRowsComplete) {
    //     alert("Please complete all rows before submitting. At least one checkbox must be selected in each row.");
    //     // Re-enable button and hide spinner on validation failure
    //     if (btnText) btnText.style.display = 'inline';
    //     if (spinner) spinner.style.display = 'none';
    //     this.disabled = false;
    //     return; // Stop the submission
    // }
    // ==========================================================

    // --- Validate copusDetailsId --- (KEEP THIS, IT'S CRITICAL FOR BACKEND)
    if (!copusDetailsId) {
        alert("Error: Observation ID not found. Cannot submit data. Please ensure the page loaded correctly.");
        console.error("COPUS Details ID is missing. Make sure <input id='copusDetailsId'> is in your EJS.");
        // Re-enable button and hide spinner
        if (btnText) btnText.style.display = 'inline';
        if (spinner) spinner.style.display = 'none';
        this.disabled = false;
        return; // Stop the submission
    }

    // --- Prepare the final payload for the server ---
    const payload = {
        copusDetailsId: copusDetailsId, // Include the observation ID
        copusRecords: dataToSend        // Your array of row data
    };

    // --- Submit using Fetch API ---
    try {
        const response = await fetch("/observer_copus_result1", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload) // Send the payload including copusDetailsId
        });

        // Check if the response was successful
        if (response.ok) {
            const result = await response.json(); // Try to parse JSON response

            console.log("Submission successful:", result);
            alert(result.message || "Observation data saved successfully!");

            // Redirect to the results page
            window.location.href = result.redirectUrl || "/observer_copus_result1";

        } else {
            // Handle non-OK responses (e.g., 400 Bad Request, 500 Internal Server Error)
            const errorData = await response.json(); // Attempt to parse error message from server
            console.error("Submission failed:", response.status, errorData);
            alert(`Error submitting data: ${errorData.message || 'An unknown error occurred. Please try again.'}`);
        }
    } catch (err) {
        // Handle network errors or issues with the fetch itself
        console.error("Network or submission error:", err);
        alert("A network error occurred. Please check your internet connection and try again.");
    } finally {
        // Always re-enable the button and hide the spinner, regardless of success or failure
        if (btnText) btnText.style.display = 'inline';
        if (spinner) spinner.style.display = 'none';
        this.disabled = false;
    }
});