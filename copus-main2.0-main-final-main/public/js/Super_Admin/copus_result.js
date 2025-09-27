document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('userSearchInput');
  const cards = document.querySelectorAll('.cards .card');

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase();

    cards.forEach(card => {
      // Combine relevant text content inside the card for search
      const textContent = card.textContent.toLowerCase();

      // Show card if textContent includes query, else hide
      if (textContent.includes(query)) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
  });
});
