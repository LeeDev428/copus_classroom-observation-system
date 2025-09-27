    // Chart.js Config
    const ctx = document.getElementById('facultyChart').getContext('2d');
    const facultyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Jerald Espares', 'Jerald Espares', 'Jerald Espares', 'Jerald Espares', 'Jerald Espares', 'Jerald Espares', 'Jerald Espares'],
        datasets: [
          {
            label: 'CATEGORY 1',
            data: [90, 92, 91, 89, 88, 90, 91],
            backgroundColor: '#6699ff'
          },
          {
            label: 'CATEGORY 2',
            data: [45, 50, 47, 44, 46, 48, 49],
            backgroundColor: '#77cc77'
          },
          {
            label: 'COPUS',
            data: [60, 60, 60, 60, 60, 60, 60],
            backgroundColor: '#ff9999'
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            max: 100
          }
        }
      }
    });