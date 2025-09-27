// schedule_management.js

/**
 * Closes a toast notification.
 * @param {string} toastId The ID of the toast element to close. Defaults to 'customToast'.
 */
function closeToast(toastId) {
    const toast = document.getElementById(toastId || 'customToast');
    if (toast) {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.style.display = 'none';
        }, 500);
    }
}

document.addEventListener('DOMContentLoaded', function () {
    // Logic from the user's new code for toggling views.
    const addUserBtn = document.querySelector(".create-account-icon"); // This seems to be for admin, might not exist here
    const scheduleManagementView = document.getElementById("scheduleManagementView");
    const addScheduleView = document.getElementById("addScheduleView"); // This view likely doesn't exist in faculty schedule management
    const cancelBtn = document.getElementById("cancelAddSchedule"); // This button likely doesn't exist here

    // Check if the 'add user' button and views exist before adding event listeners.
    // These elements might not be present in the faculty's schedule_management.ejs
    if (addUserBtn && scheduleManagementView && addScheduleView) {
        addUserBtn.addEventListener("click", function () {
            scheduleManagementView.style.display = "none";
            addScheduleView.style.display = "block";
        });
    }

    // Check if the cancel button and views exist before adding event listeners.
    if (cancelBtn && addScheduleView && scheduleManagementView) {
        cancelBtn.addEventListener("click", function () {
            addScheduleView.style.display = "none";
            scheduleManagementView.style.display = "block";
        });
    }

    // Existing logic for handling the View Modal.
    const viewModal = document.getElementById('viewScheduleModal');
    if (viewModal) {
        viewModal.addEventListener('show.bs.modal', function (event) {
            const button = event.relatedTarget;
            const scheduleData = JSON.parse(button.getAttribute('data-schedule'));

            document.getElementById('view-faculty-name').textContent = `${scheduleData.faculty_firstname} ${scheduleData.faculty_lastname}`;
            document.getElementById('view-department').textContent = scheduleData.faculty_department;
            const dateObj = new Date(scheduleData.date);
            document.getElementById('view-date').textContent = dateObj.toLocaleDateString('en-US');
            document.getElementById('view-time').textContent = `${scheduleData.start_time} - ${scheduleData.end_time}`;
            document.getElementById('view-year-level').textContent = scheduleData.year_level;
            document.getElementById('view-semester').textContent = scheduleData.semester;
            document.getElementById('view-school-year').textContent = scheduleData.school_year;
            document.getElementById('view-subject-code').textContent = scheduleData.faculty_subject_code || 'N/A';
            document.getElementById('view-subject-name').textContent = scheduleData.faculty_subject_name || 'N/A';
            document.getElementById('view-room').textContent = scheduleData.faculty_room;
            document.getElementById('view-modality').textContent = scheduleData.modality;
            document.getElementById('view-copus-type').textContent = scheduleData.copus_type;
            document.getElementById('view-status').textContent = scheduleData.status;

            const observersList = document.getElementById('view-observers-list');
            observersList.innerHTML = '';
            if (scheduleData.observers && scheduleData.observers.length > 0) {
                scheduleData.observers.forEach(observer => {
                    const statusClass = observer.observer_status === 'accepted' ? 'text-success' : // Changed from observer.status to observer.observer_status
                                         observer.observer_status === 'pending' ? 'text-warning' : // Changed from observer.status to observer.observer_status
                                         observer.observer_status === 'declined' ? 'text-danger' : ''; // Changed from observer.status to observer.observer_status
                    const statusIcon = observer.observer_status === 'accepted' ? 'bi-check-circle-fill' : // Changed from observer.status to observer.observer_status
                                         observer.observer_status === 'pending' ? 'bi-hourglass-split' : // Changed from observer.status to observer.observer_status
                                         observer.observer_status === 'declined' ? 'bi-x-circle-fill' : 'bi-info-circle-fill'; // Changed from observer.status to observer.observer_status
                    
                    const div = document.createElement('div');
                    div.innerHTML = `<span class="observer-entry">${observer.observer_name} <i class="bi ${statusIcon} ${statusClass}" title="Status: ${observer.observer_status}"></i></span>`; // Changed from observer.status to observer.observer_status
                    observersList.appendChild(div);
                });
            } else {
                observersList.textContent = 'N/A';
            }

            const actionButtonsDiv = document.getElementById('view-action-buttons');
            actionButtonsDiv.innerHTML = '';

            // Only show edit/cancel buttons if the schedule is in a modifiable status
            if (['pending', 'scheduled', 'approved'].includes(scheduleData.status)) {
                const editButton = document.createElement('button');
                editButton.className = 'btn btn-sm btn-primary me-2';
                editButton.textContent = 'Edit Schedule';
                editButton.setAttribute('data-bs-toggle', 'modal');
                editButton.setAttribute('data-bs-target', '#editScheduleModal');
                editButton.addEventListener('click', function() {
                    populateEditModal(scheduleData);
                    const viewModalInstance = bootstrap.Modal.getInstance(viewModal);
                    viewModalInstance.hide();
                });

                const cancelButton = document.createElement('form');
                cancelButton.action = `/faculty/schedule/cancel/${scheduleData._id}`;
                cancelButton.method = 'POST';
                cancelButton.style.display = 'inline';
                cancelButton.innerHTML = `<button type="submit" class="btn btn-sm btn-danger">Cancel Schedule</button>`;

                actionButtonsDiv.appendChild(editButton);
                actionButtonsDiv.appendChild(cancelButton);
            }
        });
    }

    /**
     * Populates the Edit Schedule modal with data from the selected schedule and sets fields to read-only.
     * @param {object} scheduleData The schedule object to populate the modal with.
     */
    function populateEditModal(scheduleData) {
        document.getElementById('edit-id').value = scheduleData._id;

        // Set all form inputs/selects to readonly/disabled initially
        const formElements = document.querySelectorAll('#editScheduleForm input, #editScheduleForm select');
        formElements.forEach(element => {
            element.setAttribute('readonly', 'true');
            if (element.tagName === 'SELECT') {
                element.setAttribute('disabled', 'true');
            }
        });

        // Now, populate the fields with data
        document.getElementById('edit-firstname').value = `${scheduleData.faculty_firstname} ${scheduleData.faculty_lastname}`;
        document.getElementById('edit-lastname').value = scheduleData.faculty_lastname; // Hidden field, but good to keep consistent
        document.getElementById('edit-department').value = scheduleData.faculty_department;
        const dateObj = new Date(scheduleData.date);
        const formattedDate = dateObj.toISOString().split('T')[0];
        document.getElementById('edit-date').value = formattedDate;
        document.getElementById('edit-start-time').value = scheduleData.start_time;
        document.getElementById('edit-end-time').value = scheduleData.end_time;
        document.getElementById('edit-year-level').value = scheduleData.year_level;
        document.getElementById('edit-semester').value = scheduleData.semester;
        document.getElementById('edit-school-year').value = scheduleData.school_year;
        document.getElementById('edit-subject-code').value = scheduleData.faculty_subject_code;
        document.getElementById('edit-subject').value = scheduleData.faculty_subject_name;
        document.getElementById('edit-room').value = scheduleData.faculty_room;
        document.getElementById('edit-modality').value = scheduleData.modality;
        document.getElementById('edit-copus').value = scheduleData.copus_type;

        // Make the specified editable fields writable again
        document.getElementById('edit-date').removeAttribute('readonly');
        document.getElementById('edit-start-time').removeAttribute('readonly');
        document.getElementById('edit-end-time').removeAttribute('readonly');
        document.getElementById('edit-year-level').removeAttribute('readonly');
        document.getElementById('edit-room').removeAttribute('readonly');
        document.getElementById('edit-subject-code').removeAttribute('readonly'); // Make subject code editable
        document.getElementById('edit-subject').removeAttribute('readonly'); // Make subject name editable


        // Make the uneditable select elements disabled
        document.getElementById('edit-modality').setAttribute('disabled', 'true');
        document.getElementById('edit-copus').setAttribute('disabled', 'true');

        // Add input validation for year level and room
        document.getElementById('edit-year-level').addEventListener('input', function() {
            // Only allow the digits 1, 2, 3, or 4
            this.value = this.value.replace(/[^1-4]/g, '').slice(0, 1);
        });
        document.getElementById('edit-room').addEventListener('input', function() {
            // Only allow numbers and max 3 digits
            this.value = this.value.replace(/[^0-9]/g, '').slice(0, 3);
        });
        
        // Add input validation for the date field to check for a 4-digit year.
        document.getElementById('edit-date').addEventListener('change', function() {
            const dateValue = this.value;
            if (dateValue) {
                const year = dateValue.split('-')[0];
                if (year.length !== 4) {
                    console.error("Year must be exactly 4 digits.");
                    this.value = '';
                }
            }
        });

        const observerNames = scheduleData.observers && scheduleData.observers.length > 0 ?
            scheduleData.observers.map(o => o.observer_name).join(', ') : 'N/A';
        document.getElementById('edit-observer-readonly').value = observerNames;

        const editForm = document.getElementById('editScheduleForm');
        editForm.action = `/faculty/schedule/update/${scheduleData._id}`;
    }
});