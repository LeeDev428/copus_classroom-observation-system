document.getElementById('searchInput').addEventListener('keyup', function() {
  const filter = this.value.toLowerCase();
  const rows = document.querySelectorAll('table tbody tr');

  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    if (text.indexOf(filter) > -1) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
});
const rowsPerPage = 10;
let currentPage = 1;

const table = document.querySelector('table tbody');
const rows = Array.from(table.querySelectorAll('tr'));
const paginationContainer = document.getElementById('pagination');
const searchInput = document.getElementById('searchInput');

function displayRows(page, filteredRows) {
  const start = (page - 1) * rowsPerPage;
  const end = start + rowsPerPage;

  // Hide all rows first
  rows.forEach(row => row.style.display = 'none');

  // Show only rows for the current page
  filteredRows.slice(start, end).forEach(row => row.style.display = '');

  renderPagination(filteredRows.length, page);
}

function renderPagination(totalRows, page) {
  paginationContainer.innerHTML = '';

  const totalPages = Math.ceil(totalRows / rowsPerPage);
  if (totalPages <= 1) return; // No need for pagination if only 1 page

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    btn.classList.toggle('active', i === page);
    btn.addEventListener('click', () => {
      currentPage = i;
      displayRows(currentPage, getFilteredRows());
    });
    paginationContainer.appendChild(btn);
  }
}

function getFilteredRows() {
  const filter = searchInput.value.toLowerCase();
  return rows.filter(row => row.textContent.toLowerCase().includes(filter));
}

searchInput.addEventListener('keyup', () => {
  currentPage = 1; // Reset to first page when searching
  displayRows(currentPage, getFilteredRows());
});

// Initial display
displayRows(currentPage, rows);
