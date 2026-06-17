v1.0.0

OAS 3.0.0

# JSearch

Fast and Reliable Job Searches on All Public Job Sites: LinkedIn, Indeed, Glassdoor, ZipRecruiter, and Others in Real-Time from Google for Jobs.

Server

Server:https://api.openwebninja.com/jsearch

## AuthenticationRequired

Selected Auth Type: X-API-Key

|     |
| --- |
| API Key |
| Name : <br>x-api-key<br>Clear Value |
| Value : <br>Show Password |

Client Libraries

Shell

Ruby

Node.js

PHP

Python

More Select from all clients

Shell Curl

### Job Search V2

​Copy link

Search for jobs posted on any public job site across the web on the largest job aggregate in the world (Google for Jobs).

Extensive filtering support and most options available on Google for Jobs.

Use cursor-based pagination: pass `data.cursor` from the previous response as the `cursor` query parameter on the next request.

Query Parameters

- queryCopy link to query



Type: string

required



Example

developer jobs in chicago











Free-form jobs search query.

It is highly recommended to include job title and location as part of the query, see query examples below.



**Examples:**

`web development jobs in chicago`

`marketing manager in new york via linkedin`

- cursorCopy link to cursor



Type: string

Example













Cursor for paginating results.

Pass the value of `data.cursor` returned by the previous response to fetch the next page.

Leave empty (or omit) to start from the first page.

- num\_pagesCopy link to num\_pages



Type: integer
default:
1

Example

1











Number of pages to return, starting from page.



**Allowed values:**`1-20`



**Note**: Each page (containing up to 10 results) returned by the API consumes one request credit.

- countryCopy link to country



Type: string
default:
"us"

Example

us












Country code of the country from which to return job postings.

Please note that this parameter must be set in order to get jobs in a specific country, for example, to query for software developer jobs in Berlin,
one should add _country=de_ to the request - _e.g. query=software+developers+in +berlin&country=de_.

For the list of supported values see \* [https://en.wikipedia.org/wiki/ISO\_3166-1\_alpha-2](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2)

- languageCopy link to language



Type: string

Example

en












Language code in which to return job postings. Leave empty to use the primary language in the specified country (country parameter).
In case a language not supported by the specified country is used, it is likely that no results will be returned.

For the list of supported values see [https://en.wikipedia.org/wiki/List\_of\_ISO\_639\_language\_codes](https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes)

- date\_postedCopy link to date\_posted



Type: stringenum
default:
"all"

Example

today











Find jobs posted within the time you specify.









  - all

  - today

  - 3days

  - week

  - month


- work\_from\_homeCopy link to work\_from\_home



Type: boolean
default:
false

Example

false











Only return work from home / remote jobs.

- employment\_typesCopy link to employment\_types



Type: stringenum

Example

FULLTIME











Find jobs of particular employment types, specified as a comma delimited list of the following values:









  - FULLTIME

  - CONTRACTOR

  - PARTTIME

  - INTERN


- job\_requirementsCopy link to job\_requirements



Type: stringenum

Example

no\_experience











Find jobs with specific requirements, specified as a comma delimited list of the following values:









  - under\_3\_years\_experience

  - more\_than\_3\_years\_experience

  - no\_experience

  - no\_degree


- radiusCopy link to radius



Type: number

Example

1











Return jobs within a certain distance from location as specified as part of the query (in km).

This internally sent as the Google "lrad" parameter and although it might affect the results, it is not strictly followed by Google for Jobs.

- exclude\_job\_publishersCopy link to exclude\_job\_publishers



Type: string

Example

BeeBe,Dice











Exclude jobs published by specific publishers, specified as a comma (,) separated list of publishers to exclude.

- fieldsCopy link to fields



Type: string

Example

employer\_name,job\_publisher,job\_title,job\_country











A comma separated list of job fields to include in the response (field projection).

By default all fields are returned.


Responses

- 200







Successful Response











application/json


Request Example for get/search-v2

Shell Curl

```curl
curl 'https://api.openwebninja.com/jsearch/search-v2?query=developer%20jobs%20in%20chicago' \
  --header 'x-api-key: YOUR_SECRET_TOKEN'
```

cURLCopy

cURLCopy

Test Request(get /search-v2)

Status: 200

Show Schema

`{
"Example": {
    "value": {
      "status": "OK",
      "request_id": "4f24fa29-a883-49f9-8dca-d0fede07203c",
      "parameters": {
        "query": "developer jobs in chicago",
        "page": 1,
        "num_pages": 1,
        "date_posted": "all",
        "country": "us",
        "language": "en"
      },
      "data": {
        "jobs": [\
          {\
            "job_id": "woj2gE2S_6LqvmLAAAAAAA==",\
            "job_title": "Senior Developer",\
            "employer_name": "United Airlines",\
            "employer_logo": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS6DMswunk7F25_BeXSf2w8JVHG65s4lc7v5wfG&s=0",\
            "employer_website": "https://www.united.com",\
            "job_publisher": "United Airlines Jobs",\
            "job_employment_type": "Full-time",\
            "job_employment_types": [\
              "FULLTIME"\
            ],\
            "job_apply_link": "https://careers.united.com/us/en/job/WHQ00024243/Senior-Developer?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic",\
            "job_apply_is_direct": false,\
            "apply_options": [\
              {\
`\
\
Successful Response\
\
### Job Search\
\
​Copy link\
\
Search for jobs posted on any public job site across the web on the largest job aggregate in the world (Google for Jobs).\
\
Extensive filtering support and most options available on Google for Jobs.\
\
Query Parameters\
\
- queryCopy link to query\
\
\
\
Type: string\
\
required\
\
\
\
Example\
\
developer jobs in chicago\
\
\
\
\
\
\
\
\
\
\
\
Free-form jobs search query.\
\
It is highly recommended to include job title and location as part of the query, see query examples below.\
\
\
\
**Examples:**\
\
`web development jobs in chicago`\
\
`marketing manager in new york via linkedin`\
\
- pageCopy link to page\
\
\
\
Type: integer\
default:\
1\
\
Example\
\
1\
\
\
\
\
\
\
\
\
\
\
\
Page to return (each page includes up to 10 results).\
\
\
\
**Allowed values:**`1-100`\
\
- num\_pagesCopy link to num\_pages\
\
\
\
Type: integer\
default:\
1\
\
Example\
\
1\
\
\
\
\
\
\
\
\
\
\
\
Number of pages to return, starting from page.\
\
\
\
**Allowed values:**`1-20`\
\
\
\
**Note**: Each page (containing up to 10 results) returned by the API consumes one request credit.\
\
- countryCopy link to country\
\
\
\
Type: string\
default:\
"us"\
\
Example\
\
us\
\
\
\
\
\
\
\
\
\
\
\
\
Country code of the country from which to return job postings.\
\
Please note that this parameter must be set in order to get jobs in a specific country, for example, to query for software developer jobs in Berlin,\
one should add _country=de_ to the request - _e.g. query=software+developers+in +berlin&country=de_.\
\
For the list of supported values see \* [https://en.wikipedia.org/wiki/ISO\_3166-1\_alpha-2](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2)\
\
- languageCopy link to language\
\
\
\
Type: string\
\
Example\
\
en\
\
\
\
\
\
\
\
\
\
\
\
\
Language code in which to return job postings. Leave empty to use the primary language in the specified country (country parameter).\
In case a language not supported by the specified country is used, it is likely that no results will be returned.\
\
For the list of supported values see [https://en.wikipedia.org/wiki/List\_of\_ISO\_639\_language\_codes](https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes)\
\
- date\_postedCopy link to date\_posted\
\
\
\
Type: stringenum\
default:\
"all"\
\
Example\
\
today\
\
\
\
\
\
\
\
\
\
\
\
Find jobs posted within the time you specify.\
\
\
\
\
\
\
\
\
\
  - all\
\
  - today\
\
  - 3days\
\
  - week\
\
  - month\
\
\
- work\_from\_homeCopy link to work\_from\_home\
\
\
\
Type: boolean\
default:\
false\
\
Example\
\
false\
\
\
\
\
\
\
\
\
\
\
\
Only return work from home / remote jobs.\
\
- employment\_typesCopy link to employment\_types\
\
\
\
Type: stringenum\
\
Example\
\
FULLTIME\
\
\
\
\
\
\
\
\
\
\
\
Find jobs of particular employment types, specified as a comma delimited list of the following values:\
\
\
\
\
\
\
\
\
\
  - FULLTIME\
\
  - CONTRACTOR\
\
  - PARTTIME\
\
  - INTERN\
\
\
- job\_requirementsCopy link to job\_requirements\
\
\
\
Type: stringenum\
\
Example\
\
no\_experience\
\
\
\
\
\
\
\
\
\
\
\
Find jobs with specific requirements, specified as a comma delimited list of the following values:\
\
\
\
\
\
\
\
\
\
  - under\_3\_years\_experience\
\
  - more\_than\_3\_years\_experience\
\
  - no\_experience\
\
  - no\_degree\
\
\
- radiusCopy link to radius\
\
\
\
Type: number\
\
Example\
\
1\
\
\
\
\
\
\
\
\
\
\
\
Return jobs within a certain distance from location as specified as part of the query (in km).\
\
This internally sent as the Google "lrad" parameter and although it might affect the results, it is not strictly followed by Google for Jobs.\
\
- exclude\_job\_publishersCopy link to exclude\_job\_publishers\
\
\
\
Type: string\
\
Example\
\
BeeBe,Dice\
\
\
\
\
\
\
\
\
\
\
\
Exclude jobs published by specific publishers, specified as a comma (,) separated list of publishers to exclude.\
\
- fieldsCopy link to fields\
\
\
\
Type: string\
\
Example\
\
employer\_name,job\_publisher,job\_title,job\_country\
\
\
\
\
\
\
\
\
\
\
\
A comma separated list of job fields to include in the response (field projection).\
\
By default all fields are returned.\
\
\
Responses\
\
- 200\
\
\
\
\
\
\
\
Successful Response\
\
\
\
\
\
\
\
\
\
\
\
application/json\
\
\
Request Example for get/search\
\
Shell Curl\
\
```curl\
curl 'https://api.openwebninja.com/jsearch/search?query=developer%20jobs%20in%20chicago' \\
  --header 'x-api-key: YOUR_SECRET_TOKEN'\
```\
\
cURLCopy\
\
cURLCopy\
\
Test Request(get /search)\
\
Status: 200\
\
Show Schema\
\
`{\
"Example": {\
    "value": {\
      "status": "OK",\
      "request_id": "4f24fa29-a883-49f9-8dca-d0fede07203c",\
      "parameters": {\
        "query": "developer jobs in chicago",\
        "page": 1,\
        "num_pages": 1,\
        "date_posted": "all",\
        "country": "us",\
        "language": "en"\
      },\
      "data": [\
        {\
          "job_id": "woj2gE2S_6LqvmLAAAAAAA==",\
          "job_title": "Senior Developer",\
          "employer_name": "United Airlines",\
          "employer_logo": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS6DMswunk7F25_BeXSf2w8JVHG65s4lc7v5wfG&s=0",\
          "employer_website": "https://www.united.com",\
          "job_publisher": "United Airlines Jobs",\
          "job_employment_type": "Full-time",\
          "job_employment_types": [\
            "FULLTIME"\
          ],\
          "job_apply_link": "https://careers.united.com/us/en/job/WHQ00024243/Senior-Developer?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic",\
          "job_apply_is_direct": false,\
          "apply_options": [\
            {\
              "publisher": "United Airlines Jobs",\
`\
\
Successful Response\
\
### Job Details\
\
​Copy link\
\
Get all job details, including additional information such as: application options / links, employer reviews and estimated salaries for similar jobs.\
\
Query Parameters\
\
- job\_idCopy link to job\_id\
\
\
\
Type: string\
\
required\
\
\
\
Example\
\
20N57zBfi3eT9BdpAAAAAA==\
\
\
\
\
\
\
\
\
\
\
\
Job Id of the job for which to get details.\
\
Batching of up to 20 Job Ids is supported by separating multiple Job Ids by comma (,).\
\
Note that each Job Id in a batch request is counted as a request for quota calculation.\
\
- countryCopy link to country\
\
\
\
Type: string\
default:\
"us"\
\
Example\
\
us\
\
\
\
\
\
\
\
\
\
\
\
Country code of the country from which to return job posting.\
\
\
\
**Allowed values:** See _[https://en.wikipedia.org/wiki/ISO\_3166-1\_alpha-2](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2)_\
\
- languageCopy link to language\
\
\
\
Type: string\
\
Example\
\
en\
\
\
\
\
\
\
\
\
\
\
\
Language code in which to return job postings.\
\
Leave empty to use the primary language in the specified country (country parameter).\
\
\
\
**Allowed values:** See _[https://en.wikipedia.org/wiki/List\_of\_ISO\_639\_language\_codes](https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes)_\
\
- fieldsCopy link to fields\
\
\
\
Type: string\
\
Example\
\
employer\_name,job\_publisher,job\_title,job\_country\
\
\
\
\
\
\
\
\
\
\
\
A comma separated list of job fields to include in the response (field projection).\
\
By default all fields are returned.\
\
\
Responses\
\
- 200\
\
\
\
\
\
\
\
Successful Response\
\
\
\
\
\
\
\
\
\
\
\
application/json\
\
\
Request Example for get/job-details\
\
Shell Curl\
\
```curl\
curl 'https://api.openwebninja.com/jsearch/job-details?job_id=20N57zBfi3eT9BdpAAAAAA%3D%3D' \\
  --header 'x-api-key: YOUR_SECRET_TOKEN'\
```\
\
cURLCopy\
\
cURLCopy\
\
Test Request(get /job-details)\
\
Status: 200\
\
Show Schema\
\
```json\
{\
  "Example": {\
    "value": {\
      "status": "OK",\
      "request_id": "5a8e34f1-a27c-49ee-a5b5-45d2b98ee6aa",\
      "parameters": {\
        "job_id": "GrjRvpGsrjwtgFBuAAAAAA==",\
        "country": "us",\
        "language": "en"\
      },\
      "data": [\
        {\
          "job_id": "GrjRvpGsrjwtgFBuAAAAAA==",\
          "job_title": "Senior Front-End Developer",\
          "employer_name": "TEKsystems",\
          "employer_logo": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQwWmR-XRuLFrKKxUHxaQbZaVgNBmK5Yxi04c5U&s=0",\
          "employer_website": "http://www.teksystems.com/",\
          "job_publisher": "TEKsystems Careers",\
          "job_employment_type": "Full-time",\
          "job_employment_types": [\
            "FULLTIME"\
          ],\
          "job_apply_link": "https://careers.teksystems.com/us/en/job/JP-006039510/Senior-Front-End-Developer?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic",\
          "job_apply_is_direct": false,\
          "apply_options": [\
            {\
              "publisher": "TEKsystems Careers",\
              "apply_link": "https://careers.teksystems.com/us/en/job/JP-006039510/Senior-Front-End-Developer?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic",\
              "is_direct": false\
            },\
            {\
              "publisher": "Built In Chicago",\
              "apply_link": "https://www.builtinchicago.org/job/senior-front-end-developer/9339174?utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic",\
              "is_direct": false\
            },\
            {\
              "publisher": "ZipRecruiter",\
              "apply_link": "https://www.ziprecruiter.com/c/One-Design/Job/Senior-Front-end-Developer/-in-Chicago,IL?jid=406e78522a81edb2&utm_campaign=google_jobs_apply&utm_source=google_jobs_apply&utm_medium=organic",\
              "is_direct": false\
            }\
          ],\
          "job_description": "One North is a digital experience agency. As a Senior Front-End Developer, you'll work closely with every part of One North. Hard Skills: 3+ years experience, HTML/CSS/JavaScript, TypeScript, React, Next.js, SCSS, Figma. Pay range: $91,700 - $137,500/yr. This is a fully remote position.",\
          "job_is_remote": null,\
          "job_posted_at": "7 days ago",\
          "job_posted_at_timestamp": 1779148800,\
          "job_posted_at_datetime_utc": "2026-05-19T00:00:00.000Z",\
          "job_location": "Chicago, IL",\
          "job_city": "Chicago",\
          "job_state": "Illinois",\
          "job_country": "US",\
          "job_latitude": 41.88325,\
          "job_longitude": -87.6323879,\
          "job_benefits": [\
            "dental_coverage",\
            "health_insurance",\
            "paid_time_off"\
          ],\
          "job_google_link": "https://www.google.com/search?q=jobs&gl=us&hl=en&udm=8#vhid=vt%3D20/docid%3DGrjRvpGsrjwtgFBuAAAAAA%3D%3D&vssid=jobs-detail-viewer",\
          "job_min_salary": 91700,\
          "job_max_salary": 138000,\
          "job_salary_period": "YEAR",\
          "job_highlights": {\
            "Qualifications": [\
              "3 or more years of experience, ideally in an agency or consulting environment",\
              "Advanced practitioner of HTML, CSS, and JavaScript using current best practices",\
              "Strong proficiency with TypeScript",\
              "Significant production experience with React and Next.js",\
              "Deep proficiency with Figma and the broader Figma product suite"\
            ],\
            "Responsibilities": [\
              "Craft beautiful, useful end-user experiences while engineering for performance, accessibility, and maintainability",\
              "Act as the technical lead on front-end projects, providing thoughtful guidance, code review, and mentorship"\
            ],\
            "Benefits": [\
              "The pay range for this position is $91700.00 - $137500.00/yr",\
              "Medical, dental & vision",\
              "Time Off/Leave (PTO, Paid Family Leave)"\
            ]\
          },\
          "job_onet_soc": "15113400",\
          "job_onet_job_zone": "3",\
          "employer_reviews": [\
            {\
              "publisher": "Indeed",\
              "employer_name": "TEKsystems",\
              "score": 3.8,\
              "num_stars": 4,\
              "review_count": 4651,\
              "max_score": 5,\
              "reviews_link": "https://www.indeed.com/cmp/TEKsystems/reviews?utm_campaign=google_jobs_reviews&utm_source=google_jobs_reviews&utm_medium=organic"\
            },\
            {\
              "publisher": "Glassdoor",\
              "employer_name": "TEKsystems",\
              "score": 3.6,\
              "num_stars": 3.5,\
              "review_count": 9907,\
              "max_score": 5,\
              "reviews_link": "https://www.glassdoor.com/Reviews/TEKsystems-Reviews-E23297.htm?utm_campaign=google_jobs_reviews&utm_source=google_jobs_reviews&utm_medium=organic"\
            }\
          ],\
          "work_arrangement": "remote",\
          "seniority_level": "senior",\
          "required_experience_years": 3,\
          "education_required": {\
            "level": null,\
            "field": null\
          },\
          "visa_sponsorship": null,\
          "relocation_required": null,\
          "relocation_assistance": null,\
          "contract_duration": null,\
          "start_date": null,\
          "required_technologies": [\
            "HTML",\
            "CSS",\
            "JavaScript",\
            "TypeScript",\
            "React",\
            "Next.js",\
            "SCSS",\
            "Figma",\
            "Git",\
            "GSAP",\
            "Framer Motion"\
          ],\
          "preferred_technologies": [],\
          "methodologies": [\
            "Agile",\
            "Git workflows",\
            "Code review",\
            "Design system management"\
          ],\
          "industry": "IT Services & Consulting",\
          "job_function": "frontend",\
          "has_management_responsibilities": true,\
          "ai_ml_involved": true,\
          "benefits_extended": [\
            "Medical insurance",\
            "Dental insurance",\
            "Vision insurance",\
            "401(k)/Roth",\
            "Short-term disability",\
            "Long-term disability",\
            "Health Spending Account (HSA)",\
            "Dependent Care Spending Account (DCFSA)",\
            "Transportation benefits",\
            "Employee Assistance Program",\
            "Tuition Assistance",\
            "Paid Time Off (PTO)",\
            "Paid Family Leave",\
            "Annual bonuses",\
            "Profit sharing"\
          ],\
          "soft_skills": [\
            "Effective communicator",\
            "Collaboration",\
            "Sharp eye for detail",\
            "Professional curiosity",\
            "Mentorship"\
          ]\
        }\
      ]\
    }\
  }\
}\
```\
\
JSONCopy\
\
JSONCopy\
\
Successful Response\
\
### Job Salary\
\
​Copy link\
\
Get estimated salaries / pay for a jobs around a location by job title and location.\
\
The salary estimation is returned for several periods, depending on data availability / relevance, and includes: hourly, daily, weekly, monthly, or yearly.\
\
Query Parameters\
\
- job\_titleCopy link to job\_title\
\
\
\
Type: string\
\
required\
\
\
\
Example\
\
nodejs developer\
\
\
\
\
\
\
\
\
\
\
\
Job title for which to get salary estimation.\
\
- locationCopy link to location\
\
\
\
Type: string\
\
required\
\
\
\
Example\
\
new york\
\
\
\
\
\
\
\
\
\
\
\
Location in which to get salary estimation.\
\
- location\_typeCopy link to location\_type\
\
\
\
Type: stringenum\
default:\
"ANY"\
\
Example\
\
CITY\
\
\
\
\
\
\
\
\
\
\
\
Specify the type of the location you are looking to get salary estimation for additional accuracy.\
\
\
\
\
\
\
\
\
\
  - ANY\
\
  - CITY\
\
  - STATE\
\
  - COUNTRY\
\
\
- years\_of\_experienceCopy link to years\_of\_experience\
\
\
\
Type: stringenum\
default:\
"ALL"\
\
Example\
\
LESS\_THAN\_ONE\
\
\
\
\
\
\
\
\
\
\
\
Get job estimation for a specific experience level range (years).\
\
\
\
\
\
\
\
\
\
  - ALL\
\
  - LESS\_THAN\_ONE\
\
  - ONE\_TO\_THREE\
\
  - FOUR\_TO\_SIX\
\
  - SEVEN\_TO\_NINE\
\
  - TEN\_TO\_FOURTEEN\
\
  - ABOVE\_FIFTEEN\
\
\
- fieldsCopy link to fields\
\
\
\
Type: string\
\
Example\
\
job\_title,median\_salary,location\
\
\
\
\
\
\
\
\
\
\
\
A comma separated list of job salary fields to include in the response (field projection).\
\
By default all fields are returned.\
\
\
Responses\
\
- 200\
\
\
\
\
\
\
\
Successful Response\
\
\
\
\
\
\
\
\
\
\
\
application/json\
\
\
Request Example for get/estimated-salary\
\
Shell Curl\
\
```curl\
curl 'https://api.openwebninja.com/jsearch/estimated-salary?job_title=nodejs%20developer&location=new%20york' \\
  --header 'x-api-key: YOUR_SECRET_TOKEN'\
```\
\
cURLCopy\
\
cURLCopy\
\
Test Request(get /estimated-salary)\
\
Status: 200\
\
Show Schema\
\
```json\
{\
  "Example": {\
    "value": {\
      "status": "OK",\
      "request_id": "2ff43de9-cf32-41b1-ad5b-847189f9129e",\
      "parameters": {\
        "job_title": "nodejs developer",\
        "location": "new york",\
        "location_type": "ANY",\
        "years_of_experience": null\
      },\
      "data": [\
        {\
          "location": "New York City, NY",\
          "job_title": "Nodejs Developer",\
          "min_salary": 111845.69,\
          "max_salary": 185866.24,\
          "median_salary": 143099.6,\
          "min_base_salary": 81915.06,\
          "max_base_salary": 129995.73,\
          "median_base_salary": 103192.09,\
          "min_additional_pay": 29930.63,\
          "max_additional_pay": 55870.51,\
          "median_additional_pay": 39907.51,\
          "salary_period": "YEAR",\
          "salary_currency": "USD",\
          "salary_count": 60,\
          "salaries_updated_at": "2024-06-06T23:59:59.000Z",\
          "publisher_name": "Glassdoor",\
          "publisher_link": "https://www.glassdoor.com/Salaries/company-salaries.htm?suggestCount=0&suggestChosen=false&sc.keyword=Nodejs%20Developer&locT=C&locId=1132348",\
          "confidence": "CONFIDENT"\
        }\
      ]\
    }\
  }\
}\
```\
\
JSONCopy\
\
JSONCopy\
\
Successful Response\
\
### Company Job Salary\
\
​Copy link\
\
Get estimated job salaries/pay in a specific company by job title and optionally a location and experience level in years.\
\
Query Parameters\
\
- companyCopy link to company\
\
\
\
Type: string\
\
required\
\
\
\
Example\
\
Amazon\
\
\
\
\
\
\
\
\
\
\
\
The company name for which to get salary information (e.g. Amazon).\
\
- job\_titleCopy link to job\_title\
\
\
\
Type: string\
\
required\
\
\
\
Example\
\
software developer\
\
\
\
\
\
\
\
\
\
\
\
Job title for which to get salary estimation.\
\
- locationCopy link to location\
\
\
\
Type: string\
\
Example\
\
NY\
\
\
\
\
\
\
\
\
\
\
\
Free-text location/area in which to get salary estimation.\
\
- location\_typeCopy link to location\_type\
\
\
\
Type: stringenum\
default:\
"ANY"\
\
Example\
\
CITY\
\
\
\
\
\
\
\
\
\
\
\
Specify the type of the location you are looking to get salary estimation for additional accuracy.\
\
\
\
\
\
\
\
\
\
  - ANY\
\
  - CITY\
\
  - STATE\
\
  - COUNTRY\
\
\
- years\_of\_experienceCopy link to years\_of\_experience\
\
\
\
Type: stringenum\
default:\
"ALL"\
\
Example\
\
LESS\_THAN\_ONE\
\
\
\
\
\
\
\
\
\
\
\
Get job estimation for a specific experience level range (years).\
\
\
\
\
\
\
\
\
\
  - ALL\
\
  - LESS\_THAN\_ONE\
\
  - ONE\_TO\_THREE\
\
  - FOUR\_TO\_SIX\
\
  - SEVEN\_TO\_NINE\
\
  - TEN\_TO\_FOURTEEN\
\
  - ABOVE\_FIFTEEN\
\
\
Responses\
\
- 200\
\
\
\
\
\
\
\
Successful Response\
\
\
\
\
\
\
\
\
\
\
\
application/json\
\
\
Request Example for get/company-job-salary\
\
Shell Curl\
\
```curl\
curl 'https://api.openwebninja.com/jsearch/company-job-salary?company=Amazon&job_title=software%20developer' \\
  --header 'x-api-key: YOUR_SECRET_TOKEN'\
```\
\
cURLCopy\
\
cURLCopy\
\
Test Request(get /company-job-salary)\
\
Status: 200\
\
Show Schema\
\
```json\
{\
  "Example": {\
    "value": {\
      "status": "OK",\
      "request_id": "4be77792-6727-49f4-a2d9-9040b146d8f5",\
      "data": [\
        {\
          "location": "United States",\
          "job_title": "Software Developer",\
          "company": "Amazon",\
          "min_salary": 140594.13,\
          "max_salary": 209058.84,\
          "median_salary": 170162.89,\
          "min_base_salary": 111791.03,\
          "max_base_salary": 155293.04,\
          "median_base_salary": 131758.75,\
          "min_additional_pay": 28803.1,\
          "max_additional_pay": 53765.8,\
          "median_additional_pay": 38404.14,\
          "salary_period": "YEAR",\
          "salary_currency": "USD",\
          "confidence": "CONFIDENT",\
          "salary_count": 1009\
        }\
      ]\
    }\
  }\
}\
```\
\
JSONCopy\
\
JSONCopy\
\
Successful Response\
\
Show sidebar\
\
GET\
\
Server: https://api.openwebninja.com/jsearch\
\
/search-v2\
\
Copy URL\
\
Send Send get request to https://api.openwebninja.com/jsearch/search-v2\
\
Close Client\
\
Job Search V2\
\
AllAuthCookiesHeadersQuery\
\
All\
\
## AuthenticationRequired\
\
Selected Auth Type: X-API-Key\
\
|     |\
| --- |\
| API Key |\
| Name : <br>x-api-key<br>Clear Value |\
| Value : <br>Show Password |\
\
## Variables\
\
| Enabled | Key | Value |\
| --- | --- | --- |\
\
## Cookies\
\
| Enabled | Key | Value |\
| --- | --- | --- |\
|  | Key | Value |\
\
## Headers\
\
| Enabled | Key | Value |\
| --- | --- | --- |\
|  | Accept | application/json |\
|  | Key | Value |\
\
## Query Parameters\
\
Clear All Query Parameters\
\
| Enabled | Key | Value |\
| --- | --- | --- |\
|  | query<br>Required | developer jobs in chicago |\
|  | cursor |  |\
|  | num\_pages | 1 |\
|  | country | us |\
|  | language | en |\
|  | date\_posted | all |\
|  | work\_from\_home | false |\
|  | employment\_types | FULLTIME |\
|  | job\_requirements | under\_3\_years\_experience |\
|  | radius | 1 |\
|  | exclude\_job\_publishers | BeeBe,Dice |\
|  | fields | employer\_name,job\_publisher,job\_title,job\_country |\
|  | Key | Value |\
\
## Request Body\
\
No Body\
\
| None |\
| --- |\
\
## Code Snippet (Collapsed)\
\
Shell Curl\
\
Response\
\
AllCookiesHeadersBody\
\
All\
\
[Powered By Scalar.com](https://www.scalar.com/)\
\
.,,uod8B8bou,,. ..,uod8BBBBBBBBBBBBBBBBRPFT?l!i:. \|\|\|\|\|\|\|\|\|\|\|\|\|\|!?TFPRBBBBBBBBBBBBBBB8m=, \|\|\|\| '""^^!!\|\|\|\|\|\|\|\|\|\|TFPRBBBVT!:...! \|\|\|\| '""^^!!\|\|\|\|\|?!:.......! \|\|\|\| \|\|\|\|.........! \|\|\|\| \|\|\|\|.........! \|\|\|\| \|\|\|\|.........! \|\|\|\| \|\|\|\|.........! \|\|\|\| \|\|\|\|.........! \|\|\|\| \|\|\|\|.........! \|\|\|\|, \|\|\|\|.........\` \|\|\|\|\|!!-.\_ \|\|\|\|.......;. ':!\|\|\|\|\|\|\|\|\|!!-.\_ \|\|\|\|.....bBBBBWdou,. bBBBBB86foi!\|\|\|\|\|\|\|!!-..:\|\|\|!..bBBBBBBBBBBBBBBY! ::!?TFPRBBBBBB86foi!\|\|\|\|\|\|\|\|!!bBBBBBBBBBBBBBBY..! :::::::::!?TFPRBBBBBB86ftiaabBBBBBBBBBBBBBBY....! :::;\`"^!:;::::::!?TFPRBBBBBBBBBBBBBBBBBBBY......! ;::::::...''^::::::::::!?TFPRBBBBBBBBBBY........! .ob86foi;::::::::::::::::::::::::!?TFPRBY..........\` .b888888888886foi;:::::::::::::::::::::::..........\` .b888888888888888888886foi;::::::::::::::::...........b888888888888888888888888888886foi;:::::::::......\`!Tf998888888888888888888888888888888886foi;:::....\` '"^!\|Tf9988888888888888888888888888888888!::..\` '"^!\|Tf998888888888888888888888889!! '\` '"^!\|Tf9988888888888888888!!\` iBBbo. '"^!\|Tf998888888889!\` WBBBBbo. '"^!\|Tf9989!\` YBBBP^' '"^!\` \`\
\
Send Request\
\
ctrlControl\
\
↵Enter