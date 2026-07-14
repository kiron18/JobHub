import { describe, it, expect } from 'vitest';
import { checkGrounding } from './groundingGate';

describe('checkGrounding', () => {
  const sampleResume = `
John Smith
john.smith@email.com | +61 412 345 678

EXPERIENCE
Senior Developer at TechCorp (Jan 2020 - Present)
- Built a team of 15 engineers
- Increased revenue by 25%

Developer at StartupXYZ (Mar 2018 - Dec 2019)
- Shipped 3 major features

EDUCATION
Bachelor of Computer Science · 2017
University of Technology

Master of Business Administration · 2019
Business School of Excellence
`;

  const sampleJobDescription = `
We are looking for a Senior Developer to join our team.
Required: 5+ years experience with React and Node.js.
Salary: $150,000 - $180,000 per year.
`;

  it('should pass for a grounded output', () => {
    const output = `
# John Smith

*Senior Developer*

john.smith@email.com | +61 412 345 678

## Professional Summary

Experienced developer with 5+ years in the industry.

## Work Experience

### Senior Developer | TechCorp
*Jan 2020 - Present*

- Built a team of 15 engineers
- Increased revenue by 25%

### Developer | StartupXYZ
*Mar 2018 - Dec 2019*

- Shipped 3 major features

## Education

**Bachelor of Computer Science** · 2017
University of Technology

**Master of Business Administration** · 2019
Business School of Excellence

## Skills & Competencies

**Technical:** React, Node.js

## Referees

Available upon request.
`;

    const result = checkGrounding(output, sampleResume, sampleJobDescription);
    expect(result.violations).toHaveLength(0);
  });

  it('should flag invented percentages', () => {
    const output = `
# John Smith

*Senior Developer*

john.smith@email.com | +61 412 345 678

## Professional Summary

Experienced developer who increased team productivity by 90%.

## Work Experience

### Senior Developer | TechCorp
*Jan 2020 - Present*

- Built a team of 15 engineers

## Education

**Bachelor of Computer Science** · 2017
University of Technology

## Skills & Competencies

**Technical:** React, Node.js

## Referees

Available upon request.
`;

    const result = checkGrounding(output, sampleResume, sampleJobDescription);
    expect(result.violations).toContain('Number "90%" does not appear in the resume or job description');
  });

  it('should flag invented employers', () => {
    const output = `
# John Smith

*Senior Developer*

john.smith@email.com | +61 412 345 678

## Professional Summary

Experienced developer.

## Work Experience

### Senior Developer | TechCorp
*Jan 2020 - Present*

- Built a team

### CTO | FakeCompany Inc
*Jan 2015 - Dec 2017*

- Led operations

## Education

**Bachelor of Computer Science** · 2017
University of Technology

## Referees

Available upon request.
`;

    const result = checkGrounding(output, sampleResume, sampleJobDescription);
    expect(result.violations).toContain('Employer "FakeCompany Inc" does not appear in the resume');
  });

  it('should flag invented institutions', () => {
    const output = `
# John Smith

*Senior Developer*

john.smith@email.com | +61 412 345 678

## Professional Summary

Experienced developer.

## Work Experience

### Senior Developer | TechCorp
*Jan 2020 - Present*

- Built a team

## Education

**Bachelor of Computer Science** · 2017
Fake University

## Referees

Available upon request.
`;

    const result = checkGrounding(output, sampleResume, sampleJobDescription);
    expect(result.violations).toContain('Institution "Fake University" does not appear in the resume');
  });

  it('should exempt bare years (1950-2035) from number checking', () => {
    const output = `
# John Smith

*Senior Developer*

john.smith@email.com | +61 412 345 678

## Professional Summary

Experienced developer with expertise gained since 2015.

## Work Experience

### Senior Developer | TechCorp
*Jan 2020 - Present*

- Built a team of 15 engineers

## Education

**Bachelor of Computer Science** · 2017
University of Technology

## Referees

Available upon request.
`;

    const result = checkGrounding(output, sampleResume, sampleJobDescription);
    // Years like 2015, 2020, 2017 should be exempt from number checking
    const yearViolations = result.violations.filter(v => v.includes('2015') || v.includes('2020') || v.includes('2017'));
    expect(yearViolations).toHaveLength(0);
  });

  it('should flag invented email addresses', () => {
    const output = `
# John Smith

*Senior Developer*

fake.email@notreal.com | +61 412 345 678

## Professional Summary

Experienced developer.

## Work Experience

### Senior Developer | TechCorp
*Jan 2020 - Present*

- Built a team

## Referees

Available upon request.
`;

    const result = checkGrounding(output, sampleResume, sampleJobDescription);
    expect(result.violations).toContain('Email "fake.email@notreal.com" does not appear in the resume');
  });

  it('should flag invented phone numbers', () => {
    const output = `
# John Smith

*Senior Developer*

john.smith@email.com | (02) 9999 8888

## Professional Summary

Experienced developer.

## Work Experience

### Senior Developer | TechCorp
*Jan 2020 - Present*

- Built a team

## Referees

Available upon request.
`;

    const result = checkGrounding(output, sampleResume, sampleJobDescription);
    expect(result.violations).toContain('Phone number "(02) 9999 8888" does not appear in the resume');
  });

  it('should allow numbers that appear in the job description', () => {
    const output = `
# John Smith

*Senior Developer*

john.smith@email.com | +61 412 345 678

## Professional Summary

Looking for a role paying $150,000.

## Work Experience

### Senior Developer | TechCorp
*Jan 2020 - Present*

- Built a team

## Referees

Available upon request.
`;

    // $150,000 appears in the job description
    const result = checkGrounding(output, sampleResume, sampleJobDescription);
    const salaryViolation = result.violations.find(v => v.includes('$150,000'));
    expect(salaryViolation).toBeUndefined();
  });

  it('should not flag date line numbers', () => {
    const output = `
# John Smith

*Senior Developer*

john.smith@email.com | +61 412 345 678

## Work Experience

### Senior Developer | TechCorp
*Jan 2020 - Dec 2022*

- Built a team of 15 engineers

## Referees

Available upon request.
`;

    const result = checkGrounding(output, sampleResume, sampleJobDescription);
    // Date lines should not trigger number violations
    const dateViolations = result.violations.filter(v => v.includes('2020') || v.includes('2022'));
    expect(dateViolations).toHaveLength(0);
  });
});
