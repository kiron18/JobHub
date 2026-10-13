// Builds the fictional resume used on camera. Nobody real: never film a client's CV.
import { chromium } from 'playwright';
import path from 'node:path';

const page = (weak) => `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#111;margin:0;line-height:1.35}
h1{font-size:20pt;margin:0}h2{font-size:12pt;border-bottom:1px solid #999;margin:14px 0 6px;text-transform:uppercase}
p{margin:2px 0}ul{margin:4px 0 8px 18px;padding:0}.r{display:flex;justify-content:space-between;font-weight:bold}
</style></head><body>
<h1>Maya Fernando</h1>
<p>Melbourne, VIC | 0400 000 000 | maya.fernando@example.com | linkedin.com/in/mayafernando-example</p>
<h2>Objective</h2>
<p>${weak ? 'Hardworking and passionate marketing graduate looking for an opportunity to grow my skills in a dynamic company.' : 'Marketing graduate with two and a half years running social, email and event campaigns for hospitality and events brands in Colombo and Melbourne.'}</p>
<h2>Education</h2>
<div class="r"><span>Master of Marketing, Monash University</span><span>2024 - 2025</span></div>
<div class="r"><span>Bachelor of Business Administration, University of Colombo</span><span>2019 - 2022</span></div>
<h2>Work Experience</h2>
<div class="r"><span>Marketing Intern, Harbour Lane Events, Melbourne</span><span>Feb 2025 - Jul 2025</span></div>
<ul>${weak ? '<li>Responsible for social media posts</li><li>Helped the team with event campaigns</li><li>Assisted with email newsletters</li><li>Did reporting for the manager</li>' : '<li>Planned and posted 5 posts a week across Instagram and LinkedIn, lifting average reach from 1,800 to 4,600 per post in six months</li><li>Ran paid and organic promotion for 9 events, including a 420 person industry night that sold out 8 days early</li><li>Wrote the fortnightly newsletter to 6,200 subscribers and raised the open rate from 24% to 37%</li><li>Built the monthly campaign report in Google Analytics and Meta Business Suite for the marketing manager</li>'}</ul>
<div class="r"><span>Social Media Executive, Lotus Leaf Cafe Group, Colombo</span><span>Jan 2022 - Dec 2023</span></div>
<ul>${weak ? '<li>Managed Instagram and Facebook pages</li><li>Created content and replied to customers</li><li>Worked with designers on promotions</li>' : '<li>Managed Instagram and Facebook for 4 cafe locations, growing followers from 3,100 to 11,400 in two years</li><li>Created 12 pieces of content a week and answered around 60 customer messages a week within the same day</li><li>Briefed two designers on 14 seasonal promotions, the best of which lifted weekend bookings by 18%</li>'}</ul>
<div class="r"><span>Retail Assistant, Southbank Books, Melbourne</span><span>Mar 2024 - Present</span></div>
<ul><li>Customer service and stock duties</li></ul>
<h2>Skills</h2>
<p>Canva, Meta Business Suite, Mailchimp, Microsoft Office, Teamwork, Communication, Time management</p>
<h2>References</h2><p>Available on request</p>
</body></html>`;

const b = await chromium.launch();
const p = await b.newPage();
// Two versions of the same person: the one a graduate walks in with, and the one
// with the numbers in it, used for the account the signed-in chapters are shot from.
for (const [file, weak] of [['Maya_Fernando_Resume.pdf', true], ['Maya_Fernando_Resume_Strong.pdf', false]]) {
  await p.setContent(page(weak));
  await p.pdf({ path: path.join(import.meta.dirname, file), format: 'A4', margin: { top: '18mm', bottom: '18mm', left: '18mm', right: '18mm' } });
}
await b.close();
console.log('ok');
