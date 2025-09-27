document.addEventListener("DOMContentLoaded", function () {
  const addUserBtn = document.querySelector(".create-account-icon");
  const userManagementView = document.getElementById("userManagementView");
  const addUserView = document.getElementById("addUserView");
  const cancelBtn = document.getElementById("cancelAddUser");
  const addUserForm = document.getElementById("addUserForm"); // Get the add user form
  const successModal = document.getElementById("successModal"); // Get the success modal

  if (addUserBtn) {
    addUserBtn.addEventListener("click", function () {
      userManagementView.style.display = "none";
      addUserView.style.display = "block";
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", function () {
      addUserView.style.display = "none";
      userManagementView.style.display = "block";
    });
  }

  // Handle Add User Form Submission
  if (addUserForm) {
    addUserForm.addEventListener("submit", async function (event) {
      event.preventDefault(); // Prevent default form submission

      const formData = new FormData(this);
      const data = Object.fromEntries(formData.entries());

      try {
        const response = await fetch('/add_employee', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });

        if (response.ok) {
          // User added successfully
          addUserView.style.display = "none"; // Hide the add user form
          successModal.style.display = "flex"; // Show the success modal
          this.reset(); // Clear the form fields
        } else {
          const errorData = await response.json();
          alert('Error adding user: ' + (errorData.message || 'Unknown error'));
        }
      } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while adding the user.');
      }
    });
  }
});

// Function to close the success modal and refresh the page
function closeSuccessModal() {
  document.getElementById("successModal").style.display = "none";
  window.location.reload(); // Reload the page to show the updated user list
}

  document.getElementById('userSearchInput').addEventListener('keyup', function () {
    const searchTerm = this.value.toLowerCase();
    const rows = document.querySelectorAll('.custom-table tbody tr');

    rows.forEach(row => {
      const rowText = row.textContent.toLowerCase();
      row.style.display = rowText.includes(searchTerm) ? '' : 'none';
    });
  });

  const rowsPerPage = 5;
  const table = document.querySelector('.custom-table tbody');
  const rows = table.querySelectorAll('tr');
  const paginationControls = document.getElementById('paginationControls');

  function showPage(page) {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;

    rows.forEach((row, index) => {
      row.style.display = index >= start && index < end ? '' : 'none';
    });
  }

  function setupPagination() {
    const totalPages = Math.ceil(rows.length / rowsPerPage);
    paginationControls.innerHTML = '';

    for (let i = 1; i <= totalPages; i++) {
      const li = document.createElement('li');
      li.className = 'page-item';
      li.innerHTML = `<button class="page-link">${i}</button>`;
      paginationControls.appendChild(li);

      li.addEventListener('click', () => {
        showPage(i);

        document.querySelectorAll('#paginationControls .page-item').forEach(btn => 
          btn.classList.remove('active'));
        li.classList.add('active');
      });

      if (i === 1) li.classList.add('active');
    }

    showPage(1); // Show first page initially
  }

  setupPagination();


