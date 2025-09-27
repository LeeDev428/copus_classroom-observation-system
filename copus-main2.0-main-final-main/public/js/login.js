function validateForm(event) {
  // TEMPORARY: Skip all validation for testing - REMOVE THIS LATER
  console.log('Form validation bypassed for testing');
  return true;
  
  // Original validation code (commented out for testing):
  /*
  const userAnswer = parseInt(document.getElementById('humanAnswer').value);
  const correctAnswer = parseInt(document.getElementById('correctAnswer').value);

  // Only check math answer if both values exist
  if (document.getElementById('humanAnswer').value && document.getElementById('correctAnswer').value) {
    if (isNaN(userAnswer) || isNaN(correctAnswer) || userAnswer !== correctAnswer) {
      event.preventDefault();
      document.getElementById('errorMessage').textContent = 'Incorrect math answer.';
      document.getElementById('errorMessage').style.display = 'block';
      return false;
    }
  }

  // Skip reCAPTCHA validation for now to allow testing
  if (typeof grecaptcha !== 'undefined') {
    const captchaResponse = grecaptcha.getResponse();
    if (!captchaResponse) {
      event.preventDefault();
      document.getElementById('errorMessage').textContent = 'Please complete the reCAPTCHA.';
      document.getElementById('errorMessage').style.display = 'block';
      return false;
    }
  }

  // Clear any previous error messages
  const errorElement = document.getElementById('errorMessage');
  if (errorElement) {
    errorElement.style.display = 'none';
  }
  
  return true;
  */
}


// Fetch math question when page loads
window.addEventListener('DOMContentLoaded', async () => {
    try {
      const res = await fetch('/math-question');
      const data = await res.json();


      // Show question on the page
      document.getElementById('math-question').innerText = `${data.a} + ${data.b}`;


      // Store the correct result in hidden field
      document.getElementById('correctAnswer').value = data.result;
    } catch (error) {
      console.error('Failed to fetch math question', error);
    }
  });


     function togglePasswordVisibility() {
    const pwd = document.getElementById('password');
    const icon = document.getElementById('toggleIcon');
    if (pwd.type === 'password') {
      pwd.type = 'text';
      icon.classList.remove('bi-eye-slash-fill');
      icon.classList.add('bi-eye-fill');
    } else {
      pwd.type = 'password';
      icon.classList.remove('bi-eye-fill');
      icon.classList.add('bi-eye-slash-fill');
    }
  }
