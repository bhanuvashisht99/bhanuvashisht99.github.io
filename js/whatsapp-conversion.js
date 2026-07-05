// Ad conversion tracking for WhatsApp clicks.
// Whenever any wa.me / api.whatsapp.com link on the page is clicked:
//   - Google Ads: fires the "whatsapp" (Contact) conversion action
//   - Meta: fires the standard "Contact" pixel event
// Google uses beacon transport so the hit survives navigation into WhatsApp.
(function () {
  var GOOGLE_SEND_TO = 'AW-18300237200/xVi-CP7D88ocEJDrnZZE';

  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[href*="wa.me/"], a[href*="api.whatsapp.com"]');
    if (!link) return;

    if (typeof window.gtag === 'function') {
      window.gtag('event', 'conversion', {
        send_to: GOOGLE_SEND_TO,
        transport_type: 'beacon'
      });
    }

    if (typeof window.fbq === 'function') {
      window.fbq('track', 'Contact');
    }
  });
})();
