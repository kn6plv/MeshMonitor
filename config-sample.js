module.exports = {

  General: {
    Name: 'Bay Area',
    PortNr: 8083,
    Url: 'https://sfmon.xojs.org/'
  },

  OLSR: {
    // Address: '...' // Monitor traffic on a specific interface (does not work on tunnels)
    // Source: '...' // Monitor traffic from a specific source (useful for monitoring tunnels)
  },

  DB: {
    History: 14, // Days of historical data to keep
    // Filename: '...', // Override default DB filename
  },

  Health: {
    Storm: {
      HopCount: {
        Begin: 50,
        End: 40
      }
    },
    ValidLow: {
      Valid: {
        Begin: 100,
        End: 120
      }
    }
  },

  /* Uncomment and complete the Twilio section if you want alerts

  Twilio: {
    accountSid: '...',
    authToken: '...',
    toPhoneNumber: '+15551231234',
    fromPhoneNumber: '+15556786789'
  },

  */

};
