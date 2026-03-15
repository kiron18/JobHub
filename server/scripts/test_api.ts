
import axios from 'axios';

async function test() {
  try {
    console.log('Testing /api/analyze/job...');
    const response = await axios.post('http://localhost:3002/api/analyze/job', {
      jobDescription: 'Fullstack Developer with 5 years React experience. Knowledge of Node.js and TypeScript required.'
    });
    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    if (error.response) {
      console.error('Error Status:', error.response.status);
      console.error('Error Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

test();
