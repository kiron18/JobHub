Seek Job Listings Scraper Full Actor
For comprehensive job analysis, this Apify actor extracts extensive data from all Seek websites. It goes beyond basic search parameters such as location, salary range, work type, and job classification to gather more detailed information about both jobs and companies, providing users with deeper insights.

Input Behavior
The actor supports two modes of input:

1️⃣ Search URL Mode
Important

searchUrl mode is in beta, results may not be accurate. if your results are inaccurate please submit an issue Provide a full search results URL instead of using individual filter fields.
Rules:

Only searchUrl and maxResults are processed.
All other input fields are ignored.
The URL must be a search results page, not a single job listing.
Do not provide a job detail URL.
✅ Supported (Search Results Pages)
Example:

https://www.seek.com.au/jobs

Any jobs returned by the search results page will have their full job details extracted automatically.

❌ Not Supported
Single job URLs are not accepted:

https://www.seek.com.au/job/90087132

2️⃣ Form Input Mode
If searchUrl is not provided, the actor builds the search request using the standard input fields:

searchTerm
location
salaryMin
and other supported filters
Note:
If filters 'requireEmail', 'requirePhone', 'requireEmailPhone' & 'includeOneInTitle' are enable max results are not garunteed. The Actor will search all 550 jobs (seeks limit) shown by seek and return all valid listings
A daterange value of '1' will only return results from today's date.
Supported Country/Website
Country	Website
Australia	seek.com.au
Hong Kong	hk.jobsdb.com
Indonesia	jobstreet.co.id
Malaysia	jobstreet.com.my
New Zealand	seek.co.nz
Philippines	jobstreet.com.ph
Singapore	jobstreet.com.sg
Thailand	th.jobsdb.com
Key Features
Comprehensive data: Goes beyond the basics, capturing contacts, company information, and job details.
Customisable queries: Allows both simple and advanced searches, giving you full control over the job listing criteria.
Detailed job and company profiles: Includes additional data such as number of applicants, recruiter profile, role requirements, company size, perks, and more.
Structured results: Returns data in a well-organised JSON format.
Additional Data Points
This version captures:

Contact details: Phone numbers and email addresses when available.
Job listing expiry: Track when a job post will expire.
Number of applicants: View how many people have already applied to the job
Detailed content sections: Includes role descriptions and detailed job requirements.
Company profile: Ratings, perks & benefits, company size, and other available job positions from the company.
Company profile: Ratings, perks & benefits, company size, and other available job positions from the company.
Recruiter profile: When available, shows the recruiter's name, contact number, agency name and website, location, specialisations, review rating, and number of past placements.
Functionality
Scrapes up to 550 job listings (Seek’s limit per search) with a minimum of 10 results based on provided criteria.
Captures additional data points for each job listing.
Fields without available data are returned as None.
Supports filtering by location, salary, work type, and job classification.
Performance Note
The full actor delivers deeper insights but takes longer to scrape due to the additional data points. If these extra features aren't essential for your use case, the lite version is a faster and more efficient alternative.

Input Parameters
Field	Type	Description	Default Value
searchUrl	string	Full Seek search URL. If provided, all other fields except maxResults are ignored.	
maxResults	number	Maximum number of job listings to retrieve. Capped at 550. Minimum 10	300
searchTerm	string	Keyword to search for jobs.	
requireEmail	boolean	Require an email in the job listing (Optional)	False
requirePhone	boolean	Require a phone number in the job listing (Optional)	False
requireEmailPhone	boolean	Require an email and a phone number in the job listing (Optional)	False
includeOneInTitle	array	Include at least one of these words in the job title (Optional)	
sortBy	string	Sort results by relevance or date. (Optional)	
dateRange	number	Time range for job postings in days. Maximum: 365 days. (Optional)	
location	string	City or suburb name for location filtering. (Optional)	
state	string	State for location filtering. (Optional)	
postCode	string	Postcode for location filtering. (Optional)	
radius	number	Distance (in kilometers) from the specified location. (Optional)	
salaryType	string	Salary type: Annual, Monthly, or Hourly. (Optional)	
salaryMin	number	Minimum salary value. (Optional)	
salaryMax	number	Maximum salary value. (Optional)	
workTypes	array	Filter by work types: Full Time, Part Time, Contract, or Casual. If none are selected, all are enabled by default. (Optional)	
workArrangements	array	Filter by work arrangements: On-site, Hybrid, Remote. If none are selected, all are enabled by default. (Optional)	
subclassifications	boolean	Filter by job subclassifications. If none are selected, all are enabled by default. (Optional)	
Example Usage
{
    "searchUrl": "https://www.seek.com.au/jobs/in-All-Sydney-NSW?jobId=89460748&type=promoted"
}

or

{
  "searchTerm": "software engineer",
  "maxResults": 300,
  "sortBy": "date",
  "dateRange": 7,
  "location": "Sydney",
  "state": "NSW",
  "postCode": "2000",
  "radius": 50,
  "salaryType": "annual",
  "salaryMin": 80000,
  "salaryMax": 150000,
  "workType": ["fulltime", "parttime"],
  "workArrangements": ["remote"],
  "engineering-software": true,
  "help-desk-it-support": true,
  "developers-programmers": true,
}

Output
The actor outputs job listings with detailed information, including:

Job title
Number of applicants
Salary
Work type
Job location
Company name
Contact information
Detailed job description
Job and apply links
Date of listing
Listing Expiry Date
Classification & sub-classification
Advertiser information
Company information
Company information
Recruiter information
Example Output
[
  {
    "id": "86136632",
    "jobLink": "https://www.seek.com.au/job/86136632",
    "applyLink": "https://www.seek.com.au/job/86136632/apply",
    "content": {
      "bulletPoints": [
        "Long term contract paying a daily rate upto $1,100!",
        "Greenfield Group Platform Project - Latest Technologies in Java 17 & AWS/EKS",
        "Fully remote working & Flexible working hours!"
      ],
      "jobHook": "Shape the future of technology as a Senior Software Engineer earning competitive day rates of up to $1,100!",
      "unEditedContent": "<ul> <li>This is a long-term contract (3+ years), offering up to $1,100 per day!</li> <li>Greenfield Project: Work with cutting-edge technologies like Java 21 (Microservices, Spring, Spring Boot, WebFlux) and AWS/EKS.</li> <li>World-Class Learning: Access to exceptional leadership programs and growth opportunities.</li> </ul> <strong>Senior Software Engineer - Java</strong><br /><br /> Join a major greenfield transformation with a Fortune Top 10 global company, headquartered in Sydney. You’ll help build a cutting-edge platform designed to support hundreds of millions of users daily, solving real engineering challenges at global scale.<br /><br /> As a Senior Software Engineer, you’ll shape architecture and deliver mission-critical features in a high-performing, collaborative team. You’ll take ownership of design, write exceptional code, and drive best practices in modern Java engineering.<br /><br /> The team is also actively exploring opportunities to embed AI and machine learning into the platform from intelligent automation to real-time insights and decision support. This is your chance to influence how AI is implemented across one of the world’s most ambitious digital platforms.<br /> If you're passionate about building forward-thinking systems that push boundaries<br /> <br /><br /> <strong>Key Responsibilities:</strong><br /> <ul> <li>Designing and building scalable, secure, and high-throughput backend services from the ground up</li> <li>Driving architectural and design decisions aligned with modern Java and cloud-native engineering</li> <li>Collaborating with product, platform, and AI teams to deliver intelligent, resilient features</li> <li>Contributing to a strong engineering culture that values innovation, performance, and reliability</li> </ul> <strong>What you will work on:</strong><br /> <ul> <li>Java 21, Spring Boot 3, Spring Cloud, Virtual Threads (Project Loom), Reactive programming (Reactor)</li> <li>Lightweight frameworks like Micronaut or Quarkus for fast, scalable microservices</li> <li>Kafka, gRPC, and REST APIs for real-time and event-based communication</li> <li>Observability: OpenTelemetry, Grafana, Prometheus</li> <li>AI/ML integration using Python and cloud-native tooling for intelligent features</li> <li>Good exposure to other languages is always a great plus for us!</li> </ul> <br />You’re not expected to have 100% of these skills. At the heart of our culture, we actively encourage people to try new things.<br /><br /><br />Reach out to Luke on 0406 811 336, email luke@preactarecruitment.com or click 'Apply.",
      "sections": [
        "This is a long-term contract (3+ years), offering up to $1,100 per day!",
        "Greenfield Project: Work with cutting-edge technologies like Java 21 (Microservices, Spring, Spring Boot, WebFlux) and AWS/EKS.",
        "World-Class Learning: Access to exceptional leadership programs and growth opportunities.",
        "Senior Software Engineer - Java",
        "Join a major greenfield transformation with a Fortune Top 10 global company, headquartered in Sydney. You’ll help build a cutting-edge platform designed to support hundreds of millions of users daily, solving real engineering challenges at global scale.",
        "As a Senior Software Engineer, you’ll shape architecture and deliver mission-critical features in a high-performing, collaborative team. You’ll take ownership of design, write exceptional code, and drive best practices in modern Java engineering.",
        "The team is also actively exploring opportunities to embed AI and machine learning into the platform from intelligent automation to real-time insights and decision support. This is your chance to influence how AI is implemented across one of the world’s most ambitious digital platforms.",
        "If you're passionate about building forward-thinking systems that push boundaries",
        "Key Responsibilities:",
        "Designing and building scalable, secure, and high-throughput backend services from the ground up",
        "Driving architectural and design decisions aligned with modern Java and cloud-native engineering",
        "Collaborating with product, platform, and AI teams to deliver intelligent, resilient features",
        "Contributing to a strong engineering culture that values innovation, performance, and reliability",
        "What you will work on:",
        "Java 21, Spring Boot 3, Spring Cloud, Virtual Threads (Project Loom), Reactive programming (Reactor)",
        "Lightweight frameworks like Micronaut or Quarkus for fast, scalable microservices",
        "Kafka, gRPC, and REST APIs for real-time and event-based communication",
        "Observability: OpenTelemetry, Grafana, Prometheus",
        "AI/ML integration using Python and cloud-native tooling for intelligent features",
        "Good exposure to other languages is always a great plus for us!",
        "You’re not expected to have 100% of these skills. At the heart of our culture, we actively encourage people to try new things.",
        "Reach out to Luke on 0406 811 336, email luke@preactarecruitment.com or click 'Apply."
      ]
    },
    "roleId": "DefaultSearchToCA",
    "title": "Senior Software Engineer - Java daily rates up to $1100!",
    "salary": "Daily rates up to $1,100!",
    "numApplicants": "92",
    "workArrangements": "Remote",
    "phoneNumbers": [
      "0406 811 336"
    ],
    "emails": [
      "luke@preactarecruitment.com"
    ],
    "recruiterProfile": {
      "name": "N/A",
      "rating": "N/A",
      "reviewCount": "N/A",
      "contactNumber": "N/A",
      "agencyName": "N/A",
      "agencyWebsite": "N/A",
      "location": {
        "country": "N/A",
        "postcode": "N/A",
        "state": "N/A",
        "city": "N/A"
      },
      "specialisations": [],
      "placementCount": "N/A"
    },
    "recruiterSpecialisations": [],
    "workTypes": "Contract/Temp",
    "classificationInfo": {
      "classification": "Information & Communication Technology",
      "subClassification": "Engineering - Software"
    },
    "employerQuestions": [],
    "employerVideo": "N/A",
    "listedAt": "2025-07-30T23:46:54.688Z",
    "expiresAtUtc": "2025-08-27T23:46:00.000Z",
    "isVerified": true,
    "hasRoleRequirements": false,
    "joblocationInfo": {
      "area": "CBD, Inner West & Eastern Suburbs",
      "displayLocation": "Sydney NSW",
      "location": "Sydney",
      "country": "Australia",
      "countryCode": "AU",
      "suburb": "Sydney"
    },
    "advertiser": {
      "logo": "https://image-service-cdn.seek.com.au/84d942e2e41b3a482699305163f0890a41c72612/f3c5292cec0e05e4272d9bf9146f390d366481d0",
      "id": "29387504",
      "name": "Preacta Recruitment",
      "isVerified": true,
      "isPrivate": false,
      "registrationDate": "2022-04-14T03:02:19.728Z"
    },
    "companyProfile": {
      "id": "N/A",
      "name": "N/A",
      "companyNameSlug": "N/A",
      "overview": "N/A",
      "industry": "N/A",
      "size": "N/A",
      "profile": "N/A",
      "website": "N/A",
      "numberOfReviews": "N/A",
      "rating": "N/A",
      "perksAndBenefits": "N/A"
    },
    "companyOpenJobs": "https://www.seek.com.au/Preacta-Recruitment-jobs/at-this-company",
    "companyTags": []
  },
  {
    "id": "85486919",
    "jobLink": "https://www.seek.com.au/job/85486919",
    "applyLink": "https://www.seek.com.au/job/85486919/apply",
    "content": {
      "bulletPoints": [
        "Tech: Python (Flask, Django), JavaScript, Git, REST APIs, AWS, Linux",
        "Growth: Perfect for a self-starter passionate about learning and problem solving",
        "Salary: $90K-$120K base + bonus (depending on experience)"
      ],
      "jobHook": "Kickstart your software career with a global tech company building identity solutions that matter. Python. Growth. Real-world impact.",
      "unEditedContent": "<strong>ABOUT THE COMPANY</strong><br /><br /> This global software company builds <strong>cutting-edge identity verification and facial recognition solutions</strong> used in government, security and commercial environments. Their technology supports mission-critical applications across cloud, mobile and on-premise systems, helping customers around the world secure people, places and data. Their Sydney team plays a key role in supporting the Asia-Pacific region, collaborating closely with colleagues across Australia and Europe.<br />   <br /> Attitude to learning is key for this role so if you’re an avid developer who wants to jump into a role you can have a big impact, as well as progress your early-stage career, then let’s chat.<br />   <br /> <strong>ABOUT THE ROLE<br /></strong><br /> This is a fantastic early-career opportunity for a <strong>Software Engineer with 1–3 years’ experience</strong> who’s hungry to solve real-world problems, build great software and contribute directly to product success. You’ll work on internal tooling, API integrations, customer deployments and product extensions. It’s the kind of environment where <strong>your ideas matter</strong> and you’ll have support from senior engineers and global technical teams to do your best work.<br />   <br /> You’ll also gain experience supporting technical infrastructure needs — from configuring environments to assisting with on-site or remote software installations as part of broader product deployment.<br /> <ul> <li>Build and extend Python-based tools and services (Flask, Django)</li> <li>Develop code samples and prototypes for integrations and customer guidance</li> <li>Collaborate with product and engineering teams across AU and Europe</li> <li>Support deployments across various platforms including cloud and desktop</li> <li>Assist with documentation, installation and customer onboarding</li> <li>Gain exposure to biometrics, APIs, hardware, and secure infrastructure</li> <li>Learn to support configuration, networking, or licensing needs alongside software rollouts</li> <li>Participate in agile delivery and contribute to internal product development</li> <li>Occasionally travel for training or customer visits</li> </ul> <strong>SKILLS & EXPERIENCE</strong><br /> <ul> <li>1–3 years of commercial software engineering experience</li> <li>Very proficient in Python (Flask or Django preferred)</li> <li>Familiar with Git, JavaScript, REST APIs, and full-stack principles</li> <li>Comfortable building backend services or web-based tools</li> <li>Bonus: AWS, C++, Android, or Linux experience</li> <li>A clear communicator and natural collaborator</li> <li>Australian Citizen or Permanent Resident only</li> </ul> <strong>CULTURE</strong><br /><br /> The team fosters a growth-focused, collaborative engineering culture. You’ll be encouraged to own your code, contribute ideas, and get hands-on with new technology. Perks include:<br /> <ul> <li>Hybrid work model (Sydney Office)</li> <li>Career growth and skill development</li> <li>Bonus incentives and salary reviews</li> </ul> <strong>HOW TO APPLY</strong><br /><br /> If you are interested in hearing more about this position, don’t hesitate to contact me or send an updated resume to piero@scaleuprecruitment.com.au",
      "sections": [
        "ABOUT THE COMPANY",
        "This global software company builds",
        "cutting-edge identity verification and facial recognition solutions",
        "used in government, security and commercial environments. Their technology supports mission-critical applications across cloud, mobile and on-premise systems, helping customers around the world secure people, places and data. Their Sydney team plays a key role in supporting the Asia-Pacific region, collaborating closely with colleagues across Australia and Europe.",
        "Attitude to learning is key for this role so if you’re an avid developer who wants to jump into a role you can have a big impact, as well as progress your early-stage career, then let’s chat.",
        "ABOUT THE ROLE",
        "This is a fantastic early-career opportunity for a",
        "Software Engineer with 1–3 years’ experience",
        "who’s hungry to solve real-world problems, build great software and contribute directly to product success. You’ll work on internal tooling, API integrations, customer deployments and product extensions. It’s the kind of environment where",
        "your ideas matter",
        "and you’ll have support from senior engineers and global technical teams to do your best work.",
        "You’ll also gain experience supporting technical infrastructure needs — from configuring environments to assisting with on-site or remote software installations as part of broader product deployment.",
        "Build and extend Python-based tools and services (Flask, Django)",
        "Develop code samples and prototypes for integrations and customer guidance",
        "Collaborate with product and engineering teams across AU and Europe",
        "Support deployments across various platforms including cloud and desktop",
        "Assist with documentation, installation and customer onboarding",
        "Gain exposure to biometrics, APIs, hardware, and secure infrastructure",
        "Learn to support configuration, networking, or licensing needs alongside software rollouts",
        "Participate in agile delivery and contribute to internal product development",
        "Occasionally travel for training or customer visits",
        "SKILLS & EXPERIENCE",
        "1–3 years of commercial software engineering experience",
        "Very proficient in Python (Flask or Django preferred)",
        "Familiar with Git, JavaScript, REST APIs, and full-stack principles",
        "Comfortable building backend services or web-based tools",
        "Bonus: AWS, C++, Android, or Linux experience",
        "A clear communicator and natural collaborator",
        "Australian Citizen or Permanent Resident only",
        "CULTURE",
        "The team fosters a growth-focused, collaborative engineering culture. You’ll be encouraged to own your code, contribute ideas, and get hands-on with new technology. Perks include:",
        "Hybrid work model (Sydney Office)",
        "Career growth and skill development",
        "Bonus incentives and salary reviews",
        "HOW TO APPLY",
        "If you are interested in hearing more about this position, don’t hesitate to contact me or send an updated resume to piero@scaleuprecruitment.com.au"
      ]
    },
    "roleId": "python-developer",
    "title": "Software Developer (Python/Django/Flask)",
    "salary": "$90k - $120k + super + bonus",
    "numApplicants": "150+",
    "workArrangements": "Hybrid",
    "phoneNumbers": [],
    "emails": [
      "piero@scaleuprecruitment.com.au"
    ],
    "recruiterProfile": {
      "name": "Piero Sansone",
      "rating": 4.98,
      "reviewCount": 16,
      "contactNumber": "0424 301 059",
      "agencyName": "ScaleUp Recruitment",
      "agencyWebsite": "https://www.scaleuprecruitment.com.au/",
      "location": {
        "country": "Australia",
        "postcode": "2010",
        "state": "NSW",
        "city": "Sydney"
      },
      "specialisations": [
        "IT/Telecommunications",
        "Automation/Electronic/Technology",
        "Science/Technology",
        "Science & Technology",
        "Information & Communication Technology",
        "Technology"
      ],
      "placementCount": 3
    },
    "recruiterSpecialisations": [
      "IT/Telecommunications",
      "Automation/Electronic/Technology",
      "Science/Technology",
      "Science & Technology",
      "Information & Communication Technology",
      "Technology"
    ],
    "workTypes": "Full time",
    "classificationInfo": {
      "classification": "Information & Communication Technology",
      "subClassification": "Developers/Programmers"
    },
    "employerQuestions": [],
    "employerVideo": "N/A",
    "listedAt": "2025-07-05T00:35:02.370Z",
    "expiresAtUtc": "2025-08-04T00:35:00.000Z",
    "isVerified": true,
    "hasRoleRequirements": false,
    "joblocationInfo": {
      "area": "CBD, Inner West & Eastern Suburbs",
      "displayLocation": "Sydney NSW",
      "location": "Sydney",
      "country": "Australia",
      "countryCode": "AU",
      "suburb": "Sydney"
    },
    "advertiser": {
      "logo": "N/A",
      "id": "400245371",
      "name": "ScaleUp Recruitment",
      "isVerified": true,
      "isPrivate": false,
      "registrationDate": "2022-05-02T04:46:59.746Z"
    },
    "companyProfile": {
      "id": "N/A",
      "name": "N/A",
      "companyNameSlug": "N/A",
      "overview": "N/A",
      "industry": "N/A",
      "size": "N/A",
      "profile": "N/A",
      "website": "N/A",
      "numberOfReviews": "N/A",
      "rating": "N/A",
      "perksAndBenefits": "N/A"
    },
    "companyOpenJobs": "https://www.seek.com.au/ScaleUp-Recruitment-jobs/at-this-company",
    "companyTags": []
  }
]

Error Handling
The actor is designed to handle errors gracefully, logging them to the console and stopping when necessary.

If you get good use out of the tool, please leave a review :)