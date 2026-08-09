(function () {
  var link = document.querySelector('.prose-back a');
  if (!link) return;
  var ref = document.referrer;
  if (ref && ref.indexOf('how-we-work') !== -1) {
    link.href = '../../how-we-work.html';
    link.textContent = '← Back to How We Work';
  }
})();
