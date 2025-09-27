document.addEventListener("DOMContentLoaded", function () {
    const addUserBtn = document.querySelector(".create-account-icon");
    const scheduleManagementView = document.getElementById("scheduleManagementView");
    const addScheduleView = document.getElementById("addScheduleView");
    const cancelBtn = document.getElementById("cancelAddSchedule");
  
    if (addUserBtn) {
      addUserBtn.addEventListener("click", function () {
        scheduleManagementView.style.display = "none";
        addScheduleView.style.display = "block";
      });
    }
  
    if (cancelBtn) {
      cancelBtn.addEventListener("click", function () {
        addScheduleView.style.display = "none";
        scheduleManagementView.style.display = "block";
      });
    }
  });

  document.querySelectorAll('.edit-btn').forEach(button => {
    button.addEventListener('click', () => {
      const schedule = JSON.parse(button.getAttribute('data-schedule'));
      
      document.getElementById('edit-id').value = schedule._id;
      document.getElementById('edit-firstname').value = schedule.firstname;
      document.getElementById('edit-lastname').value = schedule.lastname;
      // Populate other fields similarly...
      
      document.getElementById('editScheduleForm').action = `/schedule/update/${schedule._id}`;
    });
  });

  // hello

  document.addEventListener('DOMContentLoaded', () => {
  const rowsPerPage = 5; // change this as you want
  const table = document.querySelector('.custom-table');
  const tbody = table.tBodies[0];
  const rows = Array.from(tbody.rows);
  const paginationContainer = document.getElementById('pagination');

  let currentPage = 1;
  const totalPages = Math.ceil(rows.length / rowsPerPage);

  function renderTablePage(page) {
    currentPage = page;

    // Hide all rows
    rows.forEach(row => (row.style.display = 'none'));

    // Show rows for current page
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    rows.slice(start, end).forEach(row => (row.style.display = ''));

    renderPagination();
  }

  function renderPagination() {
    paginationContainer.innerHTML = '';

    // Previous button
    const prevLi = document.createElement('li');
    prevLi.className = 'page-item' + (currentPage === 1 ? ' disabled' : '');
    prevLi.innerHTML = `<a class="page-link" href="#">Previous</a>`;
    prevLi.addEventListener('click', e => {
      e.preventDefault();
      if (currentPage > 1) renderTablePage(currentPage - 1);
    });
    paginationContainer.appendChild(prevLi);

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
      const li = document.createElement('li');
      li.className = 'page-item' + (i === currentPage ? ' active' : '');
      li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
      li.addEventListener('click', e => {
        e.preventDefault();
        renderTablePage(i);
      });
      paginationContainer.appendChild(li);
    }

    // Next button
    const nextLi = document.createElement('li');
    nextLi.className = 'page-item' + (currentPage === totalPages ? ' disabled' : '');
    nextLi.innerHTML = `<a class="page-link" href="#">Next</a>`;
    nextLi.addEventListener('click', e => {
      e.preventDefault();
      if (currentPage < totalPages) renderTablePage(currentPage + 1);
    });
    paginationContainer.appendChild(nextLi);
  }

  // Initialize the pagination display
  renderTablePage(1);
});
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('userSearchInput');
  const table = document.querySelector('.custom-table');
  const tbody = table.tBodies[0];

  searchInput.addEventListener('input', () => {
    const filter = searchInput.value.toLowerCase();
    const rows = Array.from(tbody.rows);

    rows.forEach(row => {
      // Combine all cell text in the row into a single string
      const rowText = Array.from(row.cells).map(cell => cell.textContent.toLowerCase()).join(' ');

      if (rowText.includes(filter)) {
        row.style.display = ''; // Show matching row
      } else {
        row.style.display = 'none'; // Hide non-matching row
      }
    });
  });
});


  