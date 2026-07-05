// Google Ads conversion tracking for WhatsApp clicks.
// Fires the "whatsapp" (Contact) conversion whenever any wa.me /
// api.whatsapp.com link on the page is clicked. Uses beacon transport
// so the hit survives navigation into WhatsApp.
(function () {
  var SEND_TO = 'AW-18300237200/xVi-CP7D88ocEJDrnZZE';

  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[href*="wa.me/"], a[href*="api.whatsapp.com"]');
    if (!link || typeof window.gtag !== 'function') return;

    window.gtag('event', 'conversion', {
      send_to: SEND_TO,
      transport_type: 'beacon'
    });
  });
})();
