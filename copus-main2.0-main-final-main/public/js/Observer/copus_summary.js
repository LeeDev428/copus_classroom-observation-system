const studentData = {
  labels: ['Listening (L)', 'Individual Thinking (Ind)', 'Group Activity (Grp)', 'Other'],
  datasets: [{
    data: [40, 25, 20, 15],
    backgroundColor: ['#007bff', '#ffc107', '#dc3545', '#6c757d']
  }]
};

const teacherData = {
  labels: ['Lecture (L)', 'Questioning (Q)', 'Feedback (F)', 'Other'],
  datasets: [{
    data: [50, 20, 20, 10],
    backgroundColor: ['#007bff', '#ffc107', '#dc3545', '#6c757d']
  }]
};

const copusData = {
  labels: ['High', 'Medium', 'Low'],
  datasets: [{
    data: [60, 25, 15],
    backgroundColor: ['#28a745', '#ffc107', '#dc3545']
  }]
};

function renderCharts(studentId, teacherId, copusId) {
  new Chart(document.getElementById(studentId), {
    type: 'pie',
    data: studentData,
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      }
    }
  });

  new Chart(document.getElementById(teacherId), {
    type: 'pie',
    data: teacherData,
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      }
    }
  });

  new Chart(document.getElementById(copusId), {
    type: 'doughnut',
    data: copusData,
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// ✅ Only use this block to render charts
renderCharts('studentChart1', 'teacherChart1', 'copusChart1');
renderCharts('studentChart2', 'teacherChart2', 'copusChart2');
renderCharts('studentChart3', 'teacherChart3', 'copusChart3');
