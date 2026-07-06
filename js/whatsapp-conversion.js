// Ad conversion tracking for WhatsApp clicks.
// Whenever any wa.me / api.whatsapp.com link on the page is clicked:
//   - Google Ads: fires the "whatsapp" (Contact) conversion action
//   - GA4: fires a "whatsapp_click" event (mark as key event in GA4 admin)
//   - Meta: fires the standard "Contact" pixel event
// Google uses beacon transport so the hit survives navigation into WhatsApp.
(function () {
  var GOOGLE_SEND_TO = 'AW-18300237200/xVi-CP7D88ocEJDrnZZE';
  var GA4_ID = 'G-9FWRG1RNCM';

  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[href*="wa.me/"], a[href*="api.whatsapp.com"]');
    if (!link) return;

    if (typeof window.gtag === 'function') {
      window.gtag('event', 'conversion', {
        send_to: GOOGLE_SEND_TO,
        transport_type: 'beacon'
      });
      window.gtag('event', 'whatsapp_click', {
        send_to: GA4_ID,
        page_path: window.location.pathname,
        transport_type: 'beacon'
      });
    }

    if (typeof window.fbq === 'function') {
      window.fbq('track', 'Contact');
    }
  });
})();
