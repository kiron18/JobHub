import axios from 'axios';

async function verify() {
    console.log('--- Starting Job Analysis Verification ---');
    try {
        const response = await axios.post('http://localhost:3002/api/analyze/job', {
            jobDescription: "We are looking for a Senior Software Engineer with experience in React, Node.js, and TypeScript. You will be responsible for building scalable web applications and collaborating with a cross-functional team of designers and engineers. Minimum 5 years of experience required. Strong communication skills and a passion for modern web technologies are essential."
        });
        console.log('✅ Analysis Successful!');
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error: any) {
        console.error('❌ Analysis Failed!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error Message:', error.message);
        }
    }
}

verify();
