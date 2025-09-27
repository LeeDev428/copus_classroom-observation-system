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

document.addEventListener("DOMContentLoaded", function () {
  const addUserBtn = document.querySelector(".create-account-icon");
  const scheduleManagementView = document.getElementById("scheduleManagementView");
  const addScheduleView = document.getElementById("addScheduleView");
  const cancelBtn = document.getElementById("cancelAddSchedule");
  const schoolYearInput = document.getElementById("school_year");

  // --- FIX: Corrected function to get the current academic year ---
  function getCurrentAcademicYear() {
    const today = new Date();
    const currentYear = today.getFullYear();
    const academicYearStartMonth = 7; // August is 7 (0-indexed)

    if (today.getMonth() < academicYearStartMonth) {
      return `${currentYear - 1}-${currentYear}`;
    } else {
      return `${currentYear}-${currentYear + 1}`;
    }
  }

  // Set the current academic year for the add schedule form when the page loads
  if (schoolYearInput) {
    schoolYearInput.value = getCurrentAcademicYear();
  }

  if (addUserBtn) {
    addUserBtn.addEventListener("click", function () {
      scheduleManagementView.style.display = "none";
      addScheduleView.style.display = "block";
      if (schoolYearInput) {
        schoolYearInput.value = getCurrentAcademicYear();
      }
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", function () {
      addScheduleView.style.display = "none";
      scheduleManagementView.style.display = "block";
      document.getElementById('addUserForm').reset(); // Clear the form on cancel
      if (schoolYearInput) {
        schoolYearInput.value = getCurrentAcademicYear();
      }
    });
  }

  // Edit modal data population
  const editScheduleModal = document.getElementById('editScheduleModal');
  if (editScheduleModal) {
    editScheduleModal.addEventListener('show.bs.modal', function (event) {
      const button = event.relatedTarget;
      const schedule = JSON.parse(button.getAttribute('data-schedule'));

      document.getElementById('edit-id').value = schedule._id;
      document.getElementById('edit-firstname').value = schedule.firstname || ''; // Add default empty string for null
      document.getElementById('edit-lastname').value = schedule.lastname || '';
      document.getElementById('edit-department').value = schedule.department || '';

      const date = new Date(schedule.date);
      document.getElementById('edit-date').value = date.toISOString().split('T')[0];

      document.getElementById('edit-start-time').value = schedule.start_time;
      document.getElementById('edit-end-time').value = schedule.end_time;
      document.getElementById('edit-year-level').value = schedule.year_level;
      
      document.getElementById('edit-semester').value = schedule.semester;
      document.getElementById('edit-subject-code').value = schedule.subject_code || '';
      document.getElementById('edit-subject').value = schedule.subject || '';
      // For edit-observer, you'll need to correctly set the selected options for a multiple select
      const editObserverSelect = document.getElementById('edit-observer_user_id'); // Corrected ID
      if (editObserverSelect && schedule.observers) {
          Array.from(editObserverSelect.options).forEach(option => {
              option.selected = schedule.observers.some(obs => obs.observer_id === option.value);
          });
      }
      document.getElementById('edit-modality').value = schedule.modality;

      document.getElementById('editScheduleForm').action = `/schedule/update/${schedule._id}`;
    });
  }

  // Function to format time to HH:MM (e.g., 9:0 -> 09:00, 14:30 -> 14:30)
  function formatTime(hour, minute) {
    const h = String(hour).padStart(2, '0');
    const m = String(minute).padStart(2, '0');
    return `${h}:${m}`;
  }

  // Function to set time to the nearest 30-minute interval and within range
  function enforceTimeInterval(event) {
    const input = event.target;
    let [hours, minutes] = input.value.split(':').map(Number);

    if (isNaN(hours) || isNaN(minutes)) {
      input.value = '';
      return;
    }

    // Clamp hours to the allowed range (1 to 21 for 1 AM to 9 PM)
    if (hours < 1) {
      hours = 1;
      minutes = 0; // Set to 01:00
    } else if (hours > 21) {
      hours = 21;
      minutes = 0; // Set to 21:00 (9 PM)
    }

    // Round minutes to nearest 30
    if (minutes < 15) {
      minutes = 0;
    } else if (minutes < 45) {
      minutes = 30;
    } else {
      minutes = 0;
      hours = (hours + 1); // Increment hour
      if (hours > 21) { // If incrementing hour goes past 9 PM
        hours = 21;
        minutes = 0;
      }
    }
    
    // Final check to ensure it stays within 1 AM - 9 PM after rounding
    if (hours < 1 || (hours === 1 && minutes < 0)) {
        hours = 1;
        minutes = 0;
    }
    if (hours > 21 || (hours === 21 && minutes > 0)) { // 21:00 is the max
        hours = 21;
        minutes = 0;
    }

    input.value = formatTime(hours, minutes);
  }

  // Attach event listeners for 'blur' on time inputs
  const timeInputs = [
    document.getElementById('start_time'),
    document.getElementById('end_time'),
    document.getElementById('edit-start-time'),
    document.getElementById('edit-end-time')
  ];

  timeInputs.forEach(input => {
    if (input) {
      input.addEventListener('blur', enforceTimeInterval);
    }
  });

  // Pagination Logic (No change needed here)
  const rowsPerPage = 5;
  const table = document.querySelector('.custom-table');
  const tbody = table.tBodies[0];
  const rows = Array.from(tbody.rows);
  const paginationContainer = document.getElementById('pagination');

  let currentPage = 1;
  const totalPages = Math.ceil(rows.length / rowsPerPage);

  function renderTablePage(page) {
    currentPage = page;
    rows.forEach(row => (row.style.display = 'none'));
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    rows.slice(start, end).forEach(row => (row.style.display = ''));
    renderPagination();
  }

  function renderPagination() {
    paginationContainer.innerHTML = '';
    const prevLi = document.createElement('li');
    prevLi.className = 'page-item' + (currentPage === 1 ? ' disabled' : '');
    prevLi.innerHTML = `<a class="page-link" href="#">Previous</a>`;
    prevLi.addEventListener('click', e => {
      e.preventDefault();
      if (currentPage > 1) renderTablePage(currentPage - 1);
    });
    paginationContainer.appendChild(prevLi);

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

    const nextLi = document.createElement('li');
    nextLi.className = 'page-item' + (currentPage === totalPages ? ' disabled' : '');
    nextLi.innerHTML = `<a class="page-link" href="#">Next</a>`;
    nextLi.addEventListener('click', e => {
      e.preventDefault();
      if (currentPage < totalPages) renderTablePage(currentPage + 1);
    });
    paginationContainer.appendChild(nextLi);
  }

  renderTablePage(1);

  // User search functionality (No change needed here)
  const searchInput = document.getElementById('userSearchInput');
  searchInput.addEventListener('input', () => {
    const filter = searchInput.value.toLowerCase();
    const filteredRows = rows.filter(row => {
      const rowText = Array.from(row.cells).map(cell => cell.textContent.toLowerCase()).join(' ');
      return rowText.includes(filter);
    });

    rows.forEach(row => row.style.display = 'none');
    filteredRows.forEach(row => row.style.display = '');

    const newTotalPages = Math.ceil(filteredRows.length / rowsPerPage);
    if (currentPage > newTotalPages && newTotalPages > 0) {
      currentPage = newTotalPages;
    } else if (newTotalPages === 0) {
      currentPage = 1;
    }
    renderFilteredTablePage(currentPage, filteredRows);
  });

  function renderFilteredTablePage(page, filteredRows) {
    currentPage = page;
    filteredRows.forEach(row => (row.style.display = 'none'));
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    filteredRows.slice(start, end).forEach(row => (row.style.display = ''));
    renderFilteredPagination(filteredRows.length);
  }

  function renderFilteredPagination(totalFilteredRows) {
    paginationContainer.innerHTML = '';
    const newTotalPages = Math.ceil(totalFilteredRows / rowsPerPage);

    const prevLi = document.createElement('li');
    prevLi.className = 'page-item' + (currentPage === 1 ? ' disabled' : '');
    prevLi.innerHTML = `<a class="page-link" href="#">Previous</a>`;
    prevLi.addEventListener('click', e => {
      e.preventDefault();
      if (currentPage > 1) searchInput.dispatchEvent(new Event('input'));
    });
    paginationContainer.appendChild(prevLi);

    for (let i = 1; i <= newTotalPages; i++) {
      const li = document.createElement('li');
      li.className = 'page-item' + (i === currentPage ? ' active' : '');
      li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
      li.addEventListener('click', e => {
        e.preventDefault();
        currentPage = i;
        searchInput.dispatchEvent(new Event('input'));
      });
      paginationContainer.appendChild(li);
    }

    const nextLi = document.createElement('li');
    nextLi.className = 'page-item' + (currentPage === newTotalPages ? ' disabled' : '');
    nextLi.innerHTML = `<a class="page-link" href="#">Next</a>`;
    nextLi.addEventListener('click', e => {
      e.preventDefault();
      if (currentPage < newTotalPages) searchInput.dispatchEvent(new Event('input'));
    });
    paginationContainer.appendChild(nextLi);
  }

    // --- New: Prevent scheduling in the past (Combined and Corrected) ---
    const scheduleDateInput = document.getElementById('date');
    const scheduleStartTimeInput = document.getElementById('start_time');
    const scheduleEndTimeInput = document.getElementById('end_time');
    const addScheduleForm = document.getElementById('addUserForm');

    // Set min attribute for date input to today's date
    if (scheduleDateInput) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayString = `${yyyy}-${mm}-${dd}`;
        scheduleDateInput.setAttribute('min', todayString);
    }

    if (addScheduleForm) { // Ensure the form exists before adding listener
        addScheduleForm.addEventListener('submit', function(event) {
            const selectedDate = new Date(scheduleDateInput.value);
            const now = new Date();

            // Clear previous custom validity messages
            scheduleDateInput.setCustomValidity('');
            scheduleStartTimeInput.setCustomValidity('');
            scheduleEndTimeInput.setCustomValidity('');

            // 1. Check if the selected date is in the past
            const selectedDateString = selectedDate.toISOString().split('T')[0];
            const todayDateString = now.toISOString().split('T')[0];

            if (selectedDateString < todayDateString) {
                event.preventDefault(); // Stop form submission
                scheduleDateInput.setCustomValidity('Cannot schedule for a past date.');
                scheduleDateInput.reportValidity();
                return;
            }

            // 2. If the selected date is today, check if the time is in the past
            if (selectedDateString === todayDateString) {
                const startTime = scheduleStartTimeInput.value;
                const [startHour, startMinute] = startTime.split(':').map(Number);

                const currentHour = now.getHours();
                const currentMinute = now.getMinutes();

                // Compare selected start time with current time
                if (startHour < currentHour || (startHour === currentHour && startMinute < currentMinute)) {
                    event.preventDefault();
                    scheduleStartTimeInput.setCustomValidity('Cannot schedule for a past time on the current date.');
                    scheduleStartTimeInput.reportValidity();
                    return;
                }
            }

            // 3. Basic validation for start_time vs end_time (end must be after start)
            const startTime = scheduleStartTimeInput.value;
            const endTime = scheduleEndTimeInput.value;

            if (startTime && endTime) { // Only validate if both are provided
                if (startTime >= endTime) {
                    event.preventDefault();
                    scheduleEndTimeInput.setCustomValidity('End time must be after start time.');
                    scheduleEndTimeInput.reportValidity();
                    return; // Important: return after preventing default
                }
            }
        });
    }
}); // End of the single DOMContentLoaded event listener