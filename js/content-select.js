/* Выбор содержания по языку: данные выбранного языка, недостающее — из русского. */
(function () {
  var C = CONTENT[LANG] || CONTENT.ru, R = CONTENT.ru;
  ["MODS", "APPS", "OTHER", "GLOSSARY", "PAYMODS", "CHURN", "EXAMS", "DAYS"].forEach(function (k) { window[k] = C[k] || R[k]; });
  window.DAY_IDS = Object.keys(DAYS);
  window.EXAM_IDS = Object.keys(EXAMS);
  window.QD = Object.assign({}, QD_ALL.ru, QD_ALL[LANG] || {});
  var tx = C.TOURS_TX || {};
  window.TOURS = (window.TOURS || []).map(function (tour) {
    var o = tx[tour.id]; if (!o) return tour;
    return Object.assign({}, tour, {
      title: o.title || tour.title, end: o.end || tour.end,
      steps: tour.steps.map(function (s, i) { return Object.assign({}, s, {text: (o.steps && o.steps[i]) || s.text}); })
    });
  });
})();
