/* ==========================================================================
   ice-config.js  -  VYBE network (ICE) settings
   --------------------------------------------------------------------------
   THIS IS THE ONLY FILE YOU EDIT TO ADD A TURN RELAY SERVER.

   WHAT ARE STUN AND TURN?
     STUN  - a free public helper that tells your browser its public address.
             Chat messages never go through it. Works for most home networks.
     TURN  - a relay server. If two devices cannot reach each other directly
             (strict campus / office Wi-Fi, some mobile carriers), the
             encrypted traffic is relayed through the TURN server instead.
             Messages stay end-to-end encrypted (DTLS); the relay only sees
             encrypted packets. A TURN server needs an account, so VYBE
             cannot ship one that is guaranteed to work. You must add your own.

   HOW TO ADD YOUR TURN SERVER (3 steps):
     1. Get TURN details from a TURN provider (some have a free tier) or from
        your own coturn server. You need three things:
          - one or more URLs  (turn:... and/or turns:...)
          - a username
          - a credential (password)
     2. In the TURN list below, delete the two lines marked "DELETE THIS WHOLE
        LINE" around the example block, then replace every
        YOUR_... value with your real value. Do NOT keep fake values:
        an entry that still contains "YOUR_" is ignored on purpose.
     3. Save, commit and push. Reload the live page (Ctrl+Shift+R) on BOTH
        devices. The Connection info panel will say "Relayed through a TURN
        server" when a relay is really used.

   SECURITY TRADE-OFF (please read):
     VYBE is a static website. Everything in this file is downloaded by every
     visitor, so ANYONE can read the TURN username and credential and use your
     relay (and your data allowance). That is unavoidable without a backend.
     What you can do to limit the damage:
       - Use a provider account that has a monthly traffic cap / alerts.
       - Never use a credential that also protects something important.
       - Rotate (change) the credential after the assignment is graded.
       - Never put an account-level API key or admin secret here. Only the
         limited TURN username + credential belong in this file.

   TESTING THE RELAY:
     Set  forceRelay: true  to make the browser use ONLY the TURN server. If
     chat still works, the relay is proven to work. Set it back to false for
     normal use (direct connections are faster and cheaper).
   ========================================================================== */

var VYBE_ICE_CONFIG = {

  /* ---- STUN (free, public, no account needed). Leave as it is. ---- */
  stun: [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302'
  ],

  /* ---- TURN (relay). EMPTY until you add your own credentials. ---- */
  turn: [
    /* DELETE THIS WHOLE LINE to activate the block below

    {
      urls: [
        'turn:YOUR_TURN_HOST:3478?transport=udp',
        'turn:YOUR_TURN_HOST:3478?transport=tcp',
        'turns:YOUR_TURN_HOST:443?transport=tcp'
      ],
      username: 'YOUR_TURN_USERNAME',
      credential: 'YOUR_TURN_CREDENTIAL'
    }

    */ // DELETE THIS WHOLE LINE too (it closes the block above)
  ],

  /* ---- Testing switch: true = use ONLY the TURN relay (needs TURN above) ---- */
  forceRelay: false
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VYBE_ICE_CONFIG;
}
