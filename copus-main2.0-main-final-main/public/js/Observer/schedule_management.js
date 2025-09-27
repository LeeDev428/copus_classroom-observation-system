document.addEventListener("DOMContentLoaded", function () {
  // Pagination and Search
  const searchInput = document.getElementById("searchInput");
  const table = document.querySelector(".custom-table");
  if (!table) return;
  const tbody = table.tBodies[0];
  const rows = Array.from(tbody.rows);
  const rowsPerPage = 8;
  let currentPage = 1;

  // Pagination container
  const paginationContainer = document.querySelector(".pagination-container");

  function renderTable(filteredRows, page) {
    tbody.innerHTML = "";
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageRows = filteredRows.slice(start, end);
    pageRows.forEach((row) => tbody.appendChild(row));
  }

  function renderPagination(filteredRows) {
    paginationContainer.innerHTML = "";
    const pageCount = Math.ceil(filteredRows.length / rowsPerPage);
    if (pageCount <= 1) return;

    for (let i = 1; i <= pageCount; i++) {
      const btn = document.createElement("button");
      btn.className = "pagination-btn";
      btn.textContent = i;
      if (i === currentPage) btn.classList.add("active");
      btn.addEventListener("click", () => {
        currentPage = i;
        renderTable(filteredRows, currentPage);
        renderPagination(filteredRows);
      });
      paginationContainer.appendChild(btn);
    }
  }

  function filterRows() {
    const query = searchInput.value.toLowerCase();
    return rows.filter((row) =>
      Array.from(row.cells).some((cell) =>
        cell.textContent.toLowerCase().includes(query)
      )
    );
  }

  function updateTable() {
    const filteredRows = filterRows();
    currentPage = 1;
    renderTable(filteredRows, currentPage);
    renderPagination(filteredRows);
  }

  searchInput.addEventListener("input", updateTable);

  // Initialize table and pagination
  updateTable();

  // Edit button functionality
  document.querySelectorAll(".edit-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const schedule = JSON.parse(button.getAttribute("data-schedule"));

      document.getElementById("edit-id").value = schedule._id || "";
      document.getElementById("edit-faculty-firstname").value =
        schedule.faculty_firstname || "";
      document.getElementById("edit-faculty-lastname").value =
        schedule.faculty_lastname || "";
      document.getElementById("edit-faculty-department").value =
        schedule.faculty_department || "";
      if (schedule.date) {
        document.getElementById("edit-date").value = new Date(
          schedule.date
        ).toISOString().split("T")[0];
      } else {
        document.getElementById("edit-date").value = "";
      }
      document.getElementById("edit-start-time").value = schedule.start_time || "";
      document.getElementById("edit-end-time").value = schedule.end_time || "";
      document.getElementById("edit-year-level").value = schedule.year_level || "";
      document.getElementById("edit-semester").value = schedule.semester || "";
      document.getElementById("edit-subject-code").value =
        schedule.faculty_subject_code || "";
      document.getElementById("edit-subject-name").value =
        schedule.faculty_subject_name || "";
      document.getElementById("edit-modality").value = schedule.modality || "";
      document.getElementById("edit-room").value = schedule.faculty_room || "";
      document.getElementById("edit-status").value = schedule.status || "";
    });
  });
});