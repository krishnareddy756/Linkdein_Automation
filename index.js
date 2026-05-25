import { chromium } from 'playwright';
import dotenv from 'dotenv';
import { appendToSheets, prepareDataForSheets } from './sheetsService.js';
import { 
  ensureSessionDir, 
  getSessionPath, 
  isSessionValid, 
  saveSession, 
  loadSession 
} from './sessionManager.js';
import { randomDelay, scrollDown, scrollUp } from './scrolling.js';
import { isPageValid } from './pageUtils.js';
import { performSearch } from './searchManager.js';
import fs from 'fs';

dotenv.config();

const EMAIL = process.env.LINKEDIN_EMAIL || 'sampleemail@example.com';
const PASSWORD = process.env.LINKEDIN_PASSWORD || 'samplepassword';
const HEADLESS = process.env.HEADLESS === 'false' ? false : true;
const SLOW_MO = parseInt(process.env.SLOW_MO || '500');

const runLinkedInAutomation = async () => {
  let browser;
  let page;
  let allCollectedPosts = [];
  
  try {
    console.log('Starting LinkedIn Playwright Automation...\n');
    
    browser = await chromium.launch({
      headless: HEADLESS,
      slowMo: SLOW_MO,
    });
    
    let context;
    let sessionLoaded = false;
    
    console.log('Checking for saved session...\n');
    try {
      context = await browser.newContext();
      const sessionPath = getSessionPath();
      
      if (fs.existsSync(sessionPath)) {
        await loadSession(context);
        page = await context.newPage({
          viewport: { width: 1280, height: 720 },
        });
        
        await page.goto('https://www.linkedin.com/feed/', {
          waitUntil: 'domcontentloaded',
          timeout: 10000,
        });
        
        await page.waitForTimeout(2000);
        const pageUrl = page.url();
        const isOnFeed = pageUrl.includes('linkedin.com/feed');
        
        if (isOnFeed) {
          console.log('Session loaded successfully\n');
          sessionLoaded = true;
        } else {
          console.log('Session expired, logging in...');
          await context.close();
        }
      }
    } catch (error) {
      try {
        await context?.close();
      } catch (e) {}
    }
    
    if (!sessionLoaded) {
      console.log('Starting login process...\n');
      
      context = await browser.newContext();
      page = await context.newPage({
        viewport: { width: 1280, height: 720 },
      });
      
      await page.goto('https://www.linkedin.com/login', {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });
      
      await page.fill('input[name="session_key"]', EMAIL);
      await page.waitForTimeout(randomDelay(500, 1000));
      
      await page.fill('input[name="session_password"]', PASSWORD);
      await page.waitForTimeout(randomDelay(500, 1000));
      
      await page.click('button[type="submit"]');
      
      try {
        await page.waitForLoadState('networkidle', { timeout: 30000 });
        console.log('Successfully logged in\n');
      } catch (error) {
        // Continue
      }
      
      await saveSession(page);
    }
    
    await page.waitForTimeout(randomDelay(2000, 3000));
    
    const randomScrollDownCount = Math.floor(Math.random() * 3) + 3;
    await scrollDown(page, randomScrollDownCount);
    
    await page.waitForTimeout(randomDelay(1500, 2500));
    
    const randomScrollUpCount = Math.floor(Math.random() * 3) + 3;
    await scrollUp(page, randomScrollUpCount);
    
    console.log('Feed scrolling completed\n');
    
    // Check page validity before first search
    if (await isPageValid(page)) {
      const ctoPosts = await performSearch(page, '#cto');
      allCollectedPosts.push(...ctoPosts);
      
      console.log('\nReturning to feed...\n');
      try {
        await page.goto('https://www.linkedin.com/feed/', { 
          waitUntil: 'domcontentloaded',
          timeout: 20000 
        });
      } catch (error) {
        console.error('Error navigating back to feed:', error.message);
        await page.waitForTimeout(3000);
      }
      await page.waitForTimeout(randomDelay(1000, 2000));
      
      // Check page validity before second search
      if (await isPageValid(page)) {
        const hiringPosts = await performSearch(page, '#hiring');
        allCollectedPosts.push(...hiringPosts);
      } else {
        console.warn('Page invalid, skipping #hiring search');
      }
    } else {
      console.warn('Page invalid after feed scrolling, skipping searches');
    }
    
    if (allCollectedPosts.length > 0) {
      console.log(`\nUploading ${allCollectedPosts.length} posts to Google Sheets...\n`);
      const dataToUpload = prepareDataForSheets(allCollectedPosts);
      await appendToSheets(dataToUpload);
    } else {
      console.log('\nNo posts collected to upload');
    }
    
    await page.waitForTimeout(randomDelay(2000, 4000));
    console.log('Task completed!');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
      console.log('\nAutomation completed.\n');
    }
  }
};

runLinkedInAutomation();
