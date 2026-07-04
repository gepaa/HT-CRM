import * as dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.production' });

const FUNCTION_URL = process.env.LEAD_CAPTURE_ENDPOINT || 'http://localhost:3000/api/leads/create';

async function testLeadCapture() {
  console.log(`🧪 Testing Lead Capture API at: ${FUNCTION_URL}`);

  // Test Case 1: Valid High-Ticket Hot Lead
  const hotLeadPayload = {
    firstName: 'Arthur',
    lastName: 'Pendleton',
    email: 'arthur@pendletoncustomfleet.com',
    phone: '(404) 555-0199',
    company: 'Pendleton Commercial Fleet Service',
    deliveryZip: '30303',
    productCategory: '4-Post Lifts',
    quantity: 2,
    targetBudget: '$18,000',
    projectDetails: 'We need two 14,000 lb 4-post commercial alignment lifts with rolling jacks for our new transit bay.',
    source: {
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'commercial_fleet_lifts',
      gclid: 'EAIaIQobChMI_test_capture_gclid_999'
    },
    formType: 'quote',
    honeypot: ''
  };

  console.log('\n--- 1️⃣ Sending Valid Hot Lead Submission ---');
  try {
    const res1 = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hotLeadPayload)
    });
    const data1 = await res1.json();
    console.log(`Status: ${res1.status}`);
    console.log('Response:', data1);
    if (res1.status === 201 && data1.tier === 'hot') {
      console.log('✅ Hot lead capture SUCCESS!');
    } else {
      console.log('⚠️ Unexpected response for hot lead.');
    }
  } catch (err) {
    console.error('❌ Request failed. Is the dev server running?', err);
  }

  // Test Case 2: Bot Honeypot Submission
  const botPayload = {
    firstName: 'SpamBot',
    lastName: '9000',
    email: 'free-money@spammachine.xyz',
    productCategory: 'Car Lifts',
    quantity: 10,
    targetBudget: '$100,000',
    formType: 'quote',
    honeypot: 'I am a bot filling hidden fields'
  };

  console.log('\n--- 2️⃣ Sending Bot Honeypot Submission ---');
  try {
    const res2 = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(botPayload)
    });
    const data2 = await res2.json();
    console.log(`Status: ${res2.status}`);
    console.log('Response:', data2);
    if (res2.status === 200 && data2.id === 'processed') {
      console.log('✅ Honeypot bot mitigation SUCCESS! (Silently rejected without creating doc)');
    } else {
      console.log('⚠️ Unexpected response for bot test.');
    }
  } catch (err) {
    console.error('❌ Request failed:', err);
  }
}

testLeadCapture();
