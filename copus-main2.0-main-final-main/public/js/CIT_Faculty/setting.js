document.addEventListener('DOMContentLoaded', () => {
    const updateProfileInfoBtn = document.getElementById('updateProfileInfoBtn');
    const confirmProfileUpdateModalElement = document.getElementById('confirmProfileUpdateModal');
    const profileUpdateReviewContentDiv = document.getElementById('profileUpdateReviewContent');
    const submitProfileUpdateBtn = document.getElementById('submitProfileUpdateBtn');
    const profileInfoForm = document.getElementById('profileInfoForm');
    const profileUpdateErrorAlert = document.getElementById('profileUpdateErrorAlert');

    let confirmProfileUpdateModal;
    if (confirmProfileUpdateModalElement) {
        confirmProfileUpdateModal = new bootstrap.Modal(confirmProfileUpdateModalElement);
    }
    
    let formDataToSubmit = {};

     const fieldsToUpdateConfig = [
        { name: 'firstname', label: 'First Name', type: 'text', required: true },
        { name: 'lastname', label: 'Last Name', type: 'text', required: true },
        { name: 'middleInitial', label: 'Middle Initial', type: 'text', required: false },
        { name: 'email', label: 'PHINMA Email', type: 'email', required: true },
        { name: 'department', label: 'Department', type: 'text', required: true },
        { name: 'dean', label: 'Dean', type: 'text', required: true },
        { name: 'assignedProgramHead', label: 'Assigned Program Head (If Applicable)', type: 'text', required: false },
        { name: 'yearsOfTeachingExperience', label: 'Years of Teaching Experience in PHINMA ED', type: 'text', required: true },
        { name: 'yearHired', label: 'Year Hired', type: 'text', required: true },
        { name: 'yearRegularized', label: 'Year Regularized', type: 'text', required: true },
        { name: 'highestEducationalAttainment', label: 'Highest Educational Attainment', type: 'text', required: true },
        { name: 'professionalLicense', label: 'Professional License', type: 'text', required: true },
        { name: 'employmentStatus', label: 'Employment Status', type: 'text', required: true },
        { name: 'rank', label: 'Rank', type: 'text', required: true }
    ];

    if (updateProfileInfoBtn && profileInfoForm && confirmProfileUpdateModal) {
        updateProfileInfoBtn.addEventListener('click', () => {
            profileUpdateErrorAlert.style.display = 'none';
            profileUpdateErrorAlert.textContent = '';
            
            let editHtml = '<form id="modalProfileEditForm" class="row">';
            fieldsToUpdateConfig.forEach(field => {
                const inputElement = profileInfoForm.elements[field.name];
                const currentValue = inputElement ? inputElement.value : '';
                
                editHtml += `
                    <div class="col-lg-4 col-md-6 mb-3"> <label for="modal-${field.name}" class="form-label"><strong>${field.label}${field.required ? ' *' : ''}</strong></label>
                        <input type="${field.type}" class="form-control" id="modal-${field.name}" name="${field.name}" value="${currentValue}" ${field.required ? 'required' : ''}>
                    </div>
                `;
            });
            editHtml += '</form>';

            profileUpdateReviewContentDiv.innerHTML = editHtml;
            confirmProfileUpdateModal.show();
        });
    }

    if (submitProfileUpdateBtn && confirmProfileUpdateModal) {
        submitProfileUpdateBtn.addEventListener('click', async () => {
            submitProfileUpdateBtn.disabled = true;
            profileUpdateErrorAlert.style.display = 'none';
            profileUpdateErrorAlert.textContent = '';

            const modalProfileEditForm = document.getElementById('modalProfileEditForm');
            if (!modalProfileEditForm.checkValidity()) {
                profileUpdateErrorAlert.textContent = 'Please fill in all required fields.';
                profileUpdateErrorAlert.style.display = 'block';
                submitProfileUpdateBtn.disabled = false;
                return;
            }

            formDataToSubmit = {};
            fieldsToUpdateConfig.forEach(field => {
                const inputElement = modalProfileEditForm.elements[field.name];
                if (inputElement) {
                    formDataToSubmit[field.name] = inputElement.value;
                }
            });

            try {
                const response = await fetch('/super_admin_update_profile', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formDataToSubmit)
                });

                const result = await response.json();

                if (response.ok) {
                    confirmProfileUpdateModal.hide();
                    alert(result.message || 'Profile updated successfully!');
                    
                    // Update the main form fields with the new data
                    fieldsToUpdateConfig.forEach(field => {
                        const mainFormInputElement = profileInfoForm.elements[field.name];
                        if (mainFormInputElement && formDataToSubmit[field.name] !== undefined) {
                            mainFormInputElement.value = formDataToSubmit[field.name];
                        }
                    });

                    // Update dynamic parts of the page, e.g., welcome message
                    if (formDataToSubmit.firstname && formDataToSubmit.lastname) {
                        const welcomeMsg = document.querySelector('.custom-sidebar h6');
                        if (welcomeMsg) {
                            welcomeMsg.textContent = `Welcome, ${formDataToSubmit.firstname} ${formDataToSubmit.lastname}`;
                        }
                        const headerName = document.querySelector('.profile-header .name');
                        if (headerName) {
                            headerName.textContent = `${formDataToSubmit.firstname} ${formDataToSubmit.lastname}`;
                        }
                    }
                } else {
                    profileUpdateErrorAlert.textContent = result.message || 'An error occurred. Please try again.';
                    profileUpdateErrorAlert.style.display = 'block';
                }
            } catch (error) {
                console.error('Error submitting profile update:', error);
                profileUpdateErrorAlert.textContent = 'A network error occurred. Please try again.';
                profileUpdateErrorAlert.style.display = 'block';
            } finally {
                submitProfileUpdateBtn.disabled = false;
            }
        });
    }
});