const fetch = require('node-fetch');

const userId = 'VWHFxaVPdYZhAvOGOPbRbKQFbNV2';
const week = 6;

async function testPredictionsEndpoint() {
  console.log(`🔍 Testing predictions endpoint for user ${userId}, week ${week}`);
  console.log('='.repeat(60) + '\n');

  try {
    // Test the BFF endpoint directly
    const bffUrl = 'https://swipick-backend-production.up.railway.app';
    const endpoint = `${bffUrl}/api/predictions/user/${userId}/week/${week}?mode=live`;

    console.log('Calling:', endpoint);
    console.log();

    const response = await fetch(endpoint);
    const data = await response.json();

    console.log('Response Status:', response.status);
    console.log('Response Headers:', response.headers.raw());
    console.log('\nResponse Data:');
    console.log(JSON.stringify(data, null, 2));

    if (data.predictions && Array.isArray(data.predictions)) {
      console.log(`\n✅ Found ${data.predictions.length} predictions`);

      // Show first few predictions
      console.log('\nSample predictions:');
      data.predictions.slice(0, 3).forEach(p => {
        console.log(`- Fixture ${p.fixture_id}: Choice=${p.choice}, Result=${p.result}, Correct=${p.is_correct}`);
      });
    } else {
      console.log('\n❌ No predictions array in response');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testPredictionsEndpoint();