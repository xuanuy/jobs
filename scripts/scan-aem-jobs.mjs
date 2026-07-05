#!/usr/bin/env node

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const TODAY = new Date().toISOString().split('T')[0].replace(/-/g, '');
const FILENAME = `aem_jobs_${TODAY}.md`;

// Job board search configurations
const SEARCHES = [
  {
    name: 'LinkedIn - AEM Developer',
    url: 'https://www.linkedin.com/jobs/search/?keywords=AEM%20developer&location=Singapore&geoId=102454443',
    selector: 'a[data-job-id]'
  },
  {
    name: 'Indeed - AEM Singapore',
    url: 'https://sg.indeed.com/jobs?q=AEM+developer&l=Singapore',
    selector: '.jcs-JobTitle'
  },
  {
    name: 'JobsDB - AEM Singapore',
    url: 'https://sg.jobsdb.com/jobs?keyword=AEM%20developer&location=Singapore',
    selector: 'a[data-testid="job-item"]'
  }
];

async function scanJobs() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.createBrowserContext();
  const page = await context.newPage();

  const jobs = [];
  const results = [];

  // Set a user agent to avoid blocks
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  for (const search of SEARCHES) {
    console.log(`Searching: ${search.name}`);
    try {
      await page.goto(search.url, { waitUntil: 'domcontentloaded', timeout: 15000 });

      // Wait for job listings to load
      await page.waitForSelector(search.selector, { timeout: 5000 }).catch(() => {
        console.log(`  ⚠ Selector not found, trying generic approach...`);
      });

      // Extract job titles and links based on platform
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
          return jobs.slice(0, 5); // Top 5 from this search
        });
      } else if (search.name.includes('Indeed')) {
        pageJobs = await page.evaluate(() => {
          const jobs = [];
          document.querySelectorAll('.job-search-results [data-job-id]').forEach(card => {
            const title = card.querySelector('.jcs-JobTitle')?.textContent?.trim();
            const company = card.querySelector('[data-company-name]')?.textContent?.trim();
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
            const title = card.querySelector('[data-testid="job-title"]')?.textContent?.trim();
            const company = card.querySelector('[data-company-name]')?.textContent?.trim();
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
        found: pageJobs.length,
        jobs: pageJobs
      });

      console.log(`  ✓ Found ${pageJobs.length} jobs`);
    } catch (error) {
      console.error(`  ✗ Error scanning ${search.name}: ${error.message}`);
      results.push({
        search: search.name,
        found: 0,
        error: error.message
      });
    }

    // Small delay between requests
    await new Promise(r => setTimeout(r, 1000));
  }

  await browser.close();
  return { jobs, results };
}

async function main() {
  console.log(`Starting AEM job scan for Singapore...`);
  console.log(`Output file: ${FILENAME}\n`);

  try {
    const { jobs, results } = await scanJobs();

    // Build markdown
    let markdown = `# AEM Jobs Scan - Singapore\n\n`;
    markdown += `**Scan Date:** ${new Date().toISOString()}\n`;
    markdown += `**Total Jobs Found:** ${jobs.length}\n\n`;

    if (jobs.length > 0) {
      markdown += `## Jobs\n\n`;
      markdown += `| Company | Role | Source | Link |\n`;
      markdown += `|---------|------|--------|------|\n`;

      jobs.forEach(job => {
        const link = `[Apply](${job.link})`;
        markdown += `| ${job.company} | ${job.title} | ${job.source} | ${link} |\n`;
      });
    } else {
      markdown += `## No jobs found\n\nThe scanners did not find any matching AEM jobs. This may be due to:\n`;
      markdown += `- Network restrictions\n`;
      markdown += `- Page structure changes on job boards\n`;
      markdown += `- No matching jobs available today\n\n`;
    }

    markdown += `## Scan Details\n\n`;
    results.forEach(r => {
      if (r.error) {
        markdown += `- **${r.search}:** Error - ${r.error}\n`;
      } else {
        markdown += `- **${r.search}:** ${r.found} jobs found\n`;
      }
    });

    markdown += `\n_Automated by GitHub Actions_\n`;

    // Write file
    fs.writeFileSync(FILENAME, markdown, 'utf-8');
    console.log(`\n✓ Scan complete. Results written to ${FILENAME}`);
    console.log(`\nSummary:`);
    console.log(`- Total jobs found: ${jobs.length}`);
    console.log(`- File size: ${fs.statSync(FILENAME).size} bytes`);

  } catch (error) {
    console.error(`\n✗ Fatal error during scan:`, error);

    // Write error report
    const errorMd = `# AEM Jobs Scan - Singapore\n\n**Status:** Failed\n\n**Error:**\n\`\`\`\n${error.message}\n${error.stack}\n\`\`\`\n\n_Automated by GitHub Actions_\n`;
    fs.writeFileSync(FILENAME, errorMd, 'utf-8');
    process.exit(1);
  }
}

main();
