/* Выбор содержания по языку: данные выбранного языка, недостающее — из русского. */
(function () {
  var C = CONTENT[LANG] || CONTENT.ru, R = CONTENT.ru;
  ["MODS", "APPS", "OTHER", "GLOSSARY", "PAYMODS", "CHURN", "EXAMS", "DAYS"].forEach(function (k) { window[k] = C[k] || R[k]; });
  window.DAY_IDS = Object.keys(DAYS);
  window.EXAM_IDS = Object.keys(EXAMS);
  window.QD = Object.assign({}, QD_ALL.ru, QD_ALL[LANG] || {});
  /* Задания «на работе», тест «дома» и подробные пояснения к урокам — из файлов days-<язык>.js */
  var X = DAYX[LANG] || {}, XR = DAYX.ru || {}, D = {};
  Object.keys(DAYS).forEach(function (id) {
    var x = X[id] || XR[id];
    D[id] = x ? Object.assign({}, DAYS[id], {tasks: x.work || DAYS[id].tasks, more: x.more || []}) : DAYS[id];
    if (x && x.home) QD[id] = x.home;
  });
  window.DAYS = D;
  var tx = C.TOURS_TX || {};
  window.TOURS = (window.TOURS || []).map(function (tour) {
    var o = tx[tour.id]; if (!o) return tour;
    return Object.assign({}, tour, {
      title: o.title || tour.title, end: o.end || tour.end,
      steps: tour.steps.map(function (s, i) { return Object.assign({}, s, {text: (o.steps && o.steps[i]) || s.text}); })
    });
  });
})();
