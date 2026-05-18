import { chromium } from 'playwright';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { appendToSheets, prepareDataForSheets } from './sheetsService.js';

// Load environment variables from .env file
dotenv.config();

// Configuration from environment variables
const EMAIL = process.env.LINKEDIN_EMAIL || 'sampleemail@example.com';
const PASSWORD = process.env.LINKEDIN_PASSWORD || 'samplepassword';
const HEADLESS = process.env.HEADLESS === 'false' ? false : true;
const SLOW_MO = parseInt(process.env.SLOW_MO || '500');
const SESSION_DIR = process.env.SESSION_DIR || './sessions';
const SESSION_EXPIRY_HOURS = parseInt(process.env.SESSION_EXPIRY_HOURS || '24');

// Create sessions directory if it doesn't exist
const ensureSessionDir = () => {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
    console.log(`📁 Created sessions directory: ${SESSION_DIR}`);
  }
};

// Get session file path
const getSessionPath = () => {
  return path.join(SESSION_DIR, 'linkedin_session.json');
};

// Check if session exists and is valid
const isSessionValid = () => {
  const sessionPath = getSessionPath();
  
  if (!fs.existsSync(sessionPath)) {
    console.log('❌ No saved session found');
    return false;
  }
  
  try {
    const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
    const createdAt = new Date(sessionData.createdAt);
    const now = new Date();
    const hoursPassed = (now - createdAt) / (1000 * 60 * 60);
    
    if (hoursPassed > SESSION_EXPIRY_HOURS) {
      console.log(`⏰ Session expired (${Math.floor(hoursPassed)} hours old)`);
      return false;
    }
    
    console.log(`✅ Valid session found (${Math.floor(hoursPassed)} hours old)`);
    return true;
  } catch (error) {
    console.log('❌ Session file corrupted, starting fresh login');
    return false;
  }
};

// Save session after successful login
const saveSession = async (page) => {
  try {
    ensureSessionDir();
    const cookies = await page.context().cookies();
    const localStorage = await page.evaluate(() => JSON.stringify(localStorage));
    const sessionStorage = await page.evaluate(() => JSON.stringify(sessionStorage));
    
    const sessionData = {
      cookies,
      localStorage: JSON.parse(localStorage),
      sessionStorage: JSON.parse(sessionStorage),
      createdAt: new Date().toISOString(),
    };
    
    fs.writeFileSync(getSessionPath(), JSON.stringify(sessionData, null, 2));
    console.log('💾 Session saved successfully');
  } catch (error) {
    console.warn('⚠️  Could not save session:', error.message);
  }
};

// Load session
const loadSession = async (context) => {
  try {
    const sessionPath = getSessionPath();
    const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
    
    // Add cookies to context
    await context.addCookies(sessionData.cookies);
    console.log('🔄 Session loaded from storage');
    return true;
  } catch (error) {
    console.warn('⚠️  Could not load session:', error.message);
    return false;
  }
};

// Helper function to generate random delay (in milliseconds)
const randomDelay = (min = 1000, max = 3000) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Helper function to scroll down
const scrollDown = async (page, scrollCount = 3) => {
  console.log(`🔻 Scrolling down ${scrollCount} times...`);
  
  for (let i = 0; i < scrollCount; i++) {
    const scrollAmount = Math.random() * 400 + 200; // Random scroll between 200-600px
    await page.evaluate((pixels) => {
      window.scrollBy(0, pixels);
    }, scrollAmount);
    
    // Random delay between scrolls for realistic behavior
    const delay = randomDelay(800, 2000);
    await page.waitForTimeout(delay);
    console.log(`   ↳ Scroll ${i + 1}/${scrollCount} completed`);
  }
};

// Helper function to scroll up
const scrollUp = async (page, scrollCount = 3) => {
  console.log(`🔺 Scrolling up ${scrollCount} times...`);
  
  for (let i = 0; i < scrollCount; i++) {
    const scrollAmount = Math.random() * 400 + 200; // Random scroll between 200-600px
    await page.evaluate((pixels) => {
      window.scrollBy(0, -pixels);
    }, scrollAmount);
    
    // Random delay between scrolls for realistic behavior
    const delay = randomDelay(800, 2000);
    await page.waitForTimeout(delay);
    console.log(`   ↳ Scroll ${i + 1}/${scrollCount} completed`);
  }
};

// Helper function to perform search and scroll through results
const performSearch = async (page, searchQuery) => {
  console.log(`\n🔍 Starting search for: ${searchQuery}\n`);
  
  const collectedPosts = [];
  
  try {
    // Wait a bit before search
    await page.waitForTimeout(randomDelay(1000, 2000));
    
    // Step 1: Find and click the search bar
    console.log('🎯 Locating search bar...');
    const searchInputs = await page.$$('[placeholder*="Search"]');
    
    if (searchInputs.length === 0) {
      console.warn('⚠️  Search bar not found, trying alternative method...');
      // Try keyboard shortcut to focus search
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
    
    // Try multiple selectors for search bar
    const searchSelectors = [
      '[placeholder*="Search"]',
      'input[aria-label*="Search"]',
      '[data-test-id="search-global-typeahead--input"]',
    ];
    
    let searchInputFound = false;
    for (const selector of searchSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          await element.click();
          searchInputFound = true;
          console.log(`✅ Search bar found with selector: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!searchInputFound) {
      console.warn('⚠️  Could not find search bar, skipping search');
      return collectedPosts;
    }
    
    await page.waitForTimeout(randomDelay(500, 1000));
    
    // Step 2: Clear and type search query
    console.log(`📝 Typing search query: ${searchQuery}`);
    await page.keyboard.press('Control+A');
    await page.keyboard.type(searchQuery, { delay: 50 });
    await page.waitForTimeout(randomDelay(500, 1000));
    
    // Step 3: Press Enter
    console.log('⏎ Pressing Enter to search...');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(randomDelay(2000, 3000));
    
    // Step 4: Wait for results
    console.log('⏳ Waiting for search results to load...');
    try {
      await page.waitForLoadState('networkidle', { timeout: 15000 });
    } catch (error) {
      console.warn('⚠️  Network timeout, continuing with available results...');
    }
    
    console.log(`✅ Search results loaded for ${searchQuery}`);
    
    // Step 5: Scroll and collect posts
    const scrollCount = Math.floor(Math.random() * 4) + 2; // 2-5 scrolls
    console.log(`📜 Scrolling through ${scrollCount} times in search results...`);
    
    for (let i = 0; i < scrollCount; i++) {
      const scrollAmount = Math.random() * 400 + 200;
      await page.evaluate((pixels) => {
        window.scrollBy(0, pixels);
      }, scrollAmount);
      
      const delay = randomDelay(1000, 2000);
      await page.waitForTimeout(delay);
      console.log(`   ↳ Scroll ${i + 1}/${scrollCount} completed`);
      
      // Try to collect posts after each scroll
      const posts = await collectPostsFromPage(page, searchQuery);
      collectedPosts.push(...posts);
    }
    
    // Step 6: Wait 10 seconds on search results page
    console.log('⏱️  Waiting 10 seconds on search results page...');
    for (let i = 10; i > 0; i--) {
      if (i % 2 === 0) {
        console.log(`   ↳ ${i} seconds remaining...`);
      }
      await page.waitForTimeout(1000);
    }
    
    // Remove duplicates
    const uniquePosts = Array.from(
      new Map(collectedPosts.map(post => [post.postUrl, post])).values()
    );
    
    // Take random 0-5 posts
    const randomCount = Math.floor(Math.random() * 6); // 0-5
    const selectedPosts = uniquePosts.slice(0, randomCount);
    
    console.log(`✅ Completed search for: ${searchQuery}`);
    console.log(`   📊 Collected ${selectedPosts.length} unique posts from results\n`);
    
    return selectedPosts;
    
  } catch (error) {
    console.error(`❌ Error during search for ${searchQuery}:`, error.message);
    return collectedPosts;
  }
};

// Helper function to collect posts from current page
const collectPostsFromPage = async (page, searchTerm) => {
  const posts = [];
  
  try {
    // Get all post URLs visible on page
    const postLinks = await page.$$eval('a[href*="/feed/update"]', elements =>
      elements.map(el => ({
        url: el.href,
        visible: el.offsetHeight > 0,
      }))
    );
    
    for (const link of postLinks) {
      if (link.visible && link.url) {
        posts.push({
          searchTerm: searchTerm,
          postUrl: link.url,
        });
      }
    }
    
    // Also try alternative post selectors
    const altLinks = await page.$$eval('[data-test-id*="update"] a[href*="/feed"]', 
      elements => 
        elements
          .map(el => el.href)
          .filter(url => url && url.includes('/feed'))
    ).catch(() => []);
    
    for (const url of altLinks) {
      if (!posts.find(p => p.postUrl === url)) {
        posts.push({
          searchTerm: searchTerm,
          postUrl: url,
        });
      }
    }
  } catch (error) {
    // Silently continue if collection fails
  }
  
  return posts;
};

// Main automation function
const runLinkedInAutomation = async () => {
  let browser;
  let page;
  let allCollectedPosts = [];
  
  try {
    console.log('🚀 Starting LinkedIn Playwright Automation...\n');
    
    // Step 1: Launch Chromium browser
    console.log('📱 Launching Chromium browser...');
    browser = await chromium.launch({
      headless: HEADLESS,
      slowMo: SLOW_MO, // Slow motion for human-like behavior
    });
    
    // Check if we have a valid session
    const hasValidSession = isSessionValid();
    
    if (hasValidSession) {
      // Step 2A: Create context and load session (Skip login)
      console.log('\n🔐 Attempting to use saved session...\n');
      const context = await browser.newContext();
      await loadSession(context);
      page = await context.newPage({
        viewport: { width: 1280, height: 720 },
      });
      
      // Navigate to LinkedIn home
      console.log('🔗 Navigating to LinkedIn home...');
      await page.goto('https://www.linkedin.com/feed/', {
        waitUntil: 'networkidle',
      });
      
      // Verify we're logged in
      try {
        await page.waitForSelector('[data-test-id="profile-rail"]', { timeout: 5000 });
        console.log('✅ Session is valid, logged in successfully!\n');
      } catch (error) {
        console.warn('⚠️  Session may be expired, forcing re-login...');
        await page.close();
        throw new Error('Session validation failed');
      }
    } else {
      // Step 2B: Fresh login
      console.log('🔑 Starting fresh login...\n');
      
      const context = await browser.newContext();
      page = await context.newPage({
        viewport: { width: 1280, height: 720 },
      });
      
      // Navigate to LinkedIn login page
      console.log('🔗 Navigating to LinkedIn login page...');
      await page.goto('https://www.linkedin.com/login', {
        waitUntil: 'networkidle',
      });
      
      console.log('✅ Login page loaded\n');
      
      // Fill in email
      console.log('📝 Filling in email...');
      await page.fill('input[name="session_key"]', EMAIL);
      await page.waitForTimeout(randomDelay(500, 1000));
      
      // Fill in password
      console.log('🔐 Filling in password...');
      await page.fill('input[name="session_password"]', PASSWORD);
      await page.waitForTimeout(randomDelay(500, 1000));
      
      // Click Sign In button
      console.log('🔓 Clicking Sign In button...');
      await page.click('button[type="submit"]');
      
      // Wait for login to complete and homepage/feed to load
      console.log('⏳ Waiting for login to complete and feed to load...');
      try {
        await page.waitForLoadState('networkidle', { timeout: 30000 });
        console.log('✅ Successfully logged in!\n');
      } catch (error) {
        console.warn('⚠️  Network idle timeout - page may still be loading, continuing...');
      }
      
      // Save session for future use
      await saveSession(page);
    }
    
    // Small delay to ensure page is fully interactive
    await page.waitForTimeout(randomDelay(2000, 3000));
    
    // Step 7: Scroll down the feed
    const randomScrollDownCount = Math.floor(Math.random() * 3) + 3; // 3-5 scrolls
    await scrollDown(page, randomScrollDownCount);
    
    // Small pause between scrolling directions
    await page.waitForTimeout(randomDelay(1500, 2500));
    
    // Step 8: Scroll back up
    const randomScrollUpCount = Math.floor(Math.random() * 3) + 3; // 3-5 scrolls
    await scrollUp(page, randomScrollUpCount);
    
    // Step 9: Search for #cto and collect posts
    const ctoPosts = await performSearch(page, '#cto');
    allCollectedPosts.push(...ctoPosts);
    
    // Step 10: Go back to feed
    console.log('🏠 Returning to feed...');
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(randomDelay(2000, 3000));
    
    // Step 11: Search for #hiring and collect posts
    const hiringPosts = await performSearch(page, '#hiring');
    allCollectedPosts.push(...hiringPosts);
    
    // Step 12: Upload collected posts to Google Sheets
    if (allCollectedPosts.length > 0) {
      console.log(`\n📊 Uploading ${allCollectedPosts.length} posts to Google Sheets...\n`);
      const dataToUpload = prepareDataForSheets(allCollectedPosts);
      await appendToSheets(dataToUpload);
    } else {
      console.log('\n⚠️  No posts collected to upload');
    }
    
    // Step 13: Wait gracefully before closing
    console.log('⏱️  Waiting before closing browser...');
    await page.waitForTimeout(randomDelay(2000, 4000));
    
    console.log('✅ Task completed successfully!');
    
  } catch (error) {
    // Error handling
    console.error('❌ An error occurred during automation:', error.message);
    console.error('Error details:', error);
    
  } finally {
    // Graceful exit - close browser
    if (browser) {
      console.log('🛑 Closing browser...');
      await browser.close();
      console.log('👋 Browser closed. Exiting automation.\n');
    }
  }
};

// Run the automation
runLinkedInAutomation();
