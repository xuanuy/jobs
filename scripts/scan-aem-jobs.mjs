#!/usr/bin/env node

import { chromium } from 'playwright';
import fs from 'fs';

const TODAY = new Date().toISOString().split('T')[0].replace(/-/g, '');
const FILENAME = `aem_jobs_${TODAY}.md`;

const SEARCHES = [
  {
    name: 'LinkedIn - AEM Developer',
    url: 'https://www.linkedin.com/jobs/search/?keywords=AEM%20developer&location=Singapore&geoId=102454443'
  },
  {
    name: 'Indeed - AEM Singapore',
    url: 'https://sg.indeed.com/jobs?q=AEM+developer&l=Singapore'
  },
  {
    name: 'JobsDB - AEM Singapore',
    url: 'https://sg.jobsdb.com/jobs?keyword=AEM%20developer&location=Singapore'
  }
];

async function scanJobs() {
  const browser = await chromium.launch({ headless: true });
  const jobs = [];
  const results = [];

  for (const search of SEARCHES) {
    console.log(`Searching: ${search.name}`);
    try {
      const page = await browser.newPage();
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      );
      await page.goto(search.url, { waitUntil: 'domcontentloaded', timeout: 15000 });

      let pageJobs = [];

      if (search.name.includes('LinkedIn')) {
        pageJobs = await page.evaluate(() => {
          const jobs = [];
          document.querySelectorAll('div.base-search-card').forEach(card => {
            const title = card.querySelector('h3')?.textContent?.trim();
            const company = card.querySelector('.base-search-card__subtitle')?.textContent?.trim();
            const link = card.querySelector('a')?.href;
            if (title && company && link) {
              jobs.push({ title, company, link, source: 'LinkedIn' });
            }
          });
          return jobs.slice(0, 5);
        });
      } else if (search.name.includes('Indeed')) {
        pageJobs = await page.evaluate(() => {
          const jobs = [];
          document.querySelectorAll('[data-testid="job-item"]').forEach(card => {
            const title = card.querySelector('[data-testid="job-card-title"]')?.textContent?.trim();
            const company = card.querySelector('[data-testid="company-name"]')?.textContent?.trim();
            const link = card.querySelector('a')?.href;
            if (title && company && link) {
              jobs.push({ title, company, link, source: 'Indeed' });
            }
          });
          return jobs.slice(0, 5);
        });
      } else if (search.name.includes('JobsDB')) {
        pageJobs = await page.evaluate(() => {
          const jobs = [];
          document.querySelectorAll('[data-testid="job-item"]').forEach(card => {
            const title = card.querySelector('h2')?.textContent?.trim();
            const company = card.querySelector('[data-testid="company-name"]')?.textContent?.trim();
            const link = card.querySelector('a')?.href;
            if (title && company && link) {
              jobs.push({ title, company, link, source: 'JobsDB' });
            }
          });
          return jobs.slice(0, 5);
        });
      }

      jobs.push(...pageJobs);
      results.push({
        search: search.name,
        found: pageJobs.length
      });

      console.log(`  ✓ Found ${pageJobs.length} jobs`);
      await page.close();
    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
      results.push({
        search: search.name,
        found: 0,
        error: error.message
      });
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  await browser.close();
  return { jobs, results };
}

async function main() {
  console.log(`Starting AEM job scan for Singapore...\n`);

  try {
    const { jobs, results } = await scanJobs();

    let markdown = `# AEM Jobs Scan - Singapore\n\n`;
    markdown += `**Scan Date:** ${new Date().toISOString()}\n`;
    markdown += `**Total Jobs Found:** ${jobs.length}\n\n`;

    if (jobs.length > 0) {
      markdown += `## Jobs\n\n`;
      markdown += `| Company | Role | Source |\n`;
      markdown += `|---------|------|--------|\n`;
      jobs.forEach(job => {
        markdown += `| ${job.company} | [${job.title}](${job.link}) | ${job.source} |\n`;
      });
    } else {
      markdown += `## No jobs found today\n\n`;
    }

    markdown += `\n## Scan Summary\n\n`;
    results.forEach(r => {
      markdown += `- **${r.search}:** ${r.found} jobs${r.error ? ` (Error: ${r.error})` : ''}\n`;
    });

    markdown += `\n_Automated by GitHub Actions_\n`;

    fs.writeFileSync(FILENAME, markdown, 'utf-8');
    console.log(`✓ Results written to ${FILENAME}`);

  } catch (error) {
    console.error(`✗ Fatal error:`, error.message);
    const errorMd = `# AEM Jobs Scan - Error\n\n${error.message}\n`;
    fs.writeFileSync(FILENAME, errorMd, 'utf-8');
    process.exit(1);
  }
}

main();
