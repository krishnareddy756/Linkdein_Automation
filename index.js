import { chromium } from 'playwright';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Configuration from environment variables
const EMAIL = process.env.LINKEDIN_EMAIL || 'sampleemail@example.com';
const PASSWORD = process.env.LINKEDIN_PASSWORD || 'samplepassword';
const HEADLESS = process.env.HEADLESS === 'false' ? false : true;
const SLOW_MO = parseInt(process.env.SLOW_MO || '500');

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
  
  try {
    // Step 1: Click the search bar at the top
    console.log('🎯 Clicking on search bar...');
    await page.click('[placeholder*="Search"]', { timeout: 10000 });
    await page.waitForTimeout(randomDelay(500, 1000));
    
    // Step 2: Clear any existing text and type the search query
    console.log(`📝 Typing search query: ${searchQuery}`);
    await page.fill('[placeholder*="Search"]', searchQuery);
    await page.waitForTimeout(randomDelay(500, 1000));
    
    // Step 3: Press Enter to perform search
    console.log('⏎ Pressing Enter to search...');
    await page.press('[placeholder*="Search"]', 'Enter');
    await page.waitForTimeout(randomDelay(1000, 2000));
    
    // Step 4: Wait for search results to load
    console.log('⏳ Waiting for search results to load...');
    try {
      await page.waitForLoadState('networkidle', { timeout: 15000 });
    } catch (error) {
      console.warn('⚠️  Network timeout, continuing with available results...');
    }
    
    console.log(`✅ Search results loaded for ${searchQuery}`);
    
    // Step 5: Scroll through search results (random scrolls 2-4 times)
    const scrollCount = Math.floor(Math.random() * 3) + 2; // 2-4 scrolls
    console.log(`📜 Scrolling through ${scrollCount} times in search results...`);
    
    for (let i = 0; i < scrollCount; i++) {
      const scrollAmount = Math.random() * 400 + 200;
      await page.evaluate((pixels) => {
        window.scrollBy(0, pixels);
      }, scrollAmount);
      
      const delay = randomDelay(1000, 2000);
      await page.waitForTimeout(delay);
      console.log(`   ↳ Result scroll ${i + 1}/${scrollCount} completed`);
    }
    
    // Step 6: Wait 10 seconds on search results page
    console.log('⏱️  Waiting 10 seconds on search results page...');
    for (let i = 10; i > 0; i--) {
      if (i % 2 === 0) {
        console.log(`   ↳ ${i} seconds remaining...`);
      }
      await page.waitForTimeout(1000);
    }
    
    console.log(`✅ Completed search for: ${searchQuery}\n`);
    
  } catch (error) {
    console.error(`❌ Error during search for ${searchQuery}:`, error.message);
  }
};

// Main automation function
const runLinkedInAutomation = async () => {
  let browser;
  let page;
  
  try {
    console.log('🚀 Starting LinkedIn Playwright Automation...\n');
    
    // Step 1: Launch Chromium browser
    console.log('📱 Launching Chromium browser...');
    browser = await chromium.launch({
      headless: HEADLESS,
      slowMo: SLOW_MO, // Slow motion for human-like behavior
    });
    
    // Create a new page with proper viewport
    page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    
    // Step 2: Navigate to LinkedIn login page
    console.log('🔗 Navigating to LinkedIn login page...');
    await page.goto('https://www.linkedin.com/login', {
      waitUntil: 'networkidle',
    });
    
    console.log('✅ Login page loaded\n');
    
    // Step 3: Fill in email
    console.log('📝 Filling in email...');
    await page.fill('input[name="session_key"]', EMAIL);
    await page.waitForTimeout(randomDelay(500, 1000));
    
    // Step 4: Fill in password
    console.log('🔐 Filling in password...');
    await page.fill('input[name="session_password"]', PASSWORD);
    await page.waitForTimeout(randomDelay(500, 1000));
    
    // Step 5: Click Sign In button
    console.log('🔓 Clicking Sign In button...');
    await page.click('button[type="submit"]');
    
    // Step 6: Wait for login to complete and homepage/feed to load
    console.log('⏳ Waiting for login to complete and feed to load...');
    try {
      // Wait for the page to load completely
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      console.log('✅ Successfully logged in!\n');
    } catch (error) {
      console.warn('⚠️  Network idle timeout - page may still be loading, continuing...');
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
    
    // Step 9: Search for #cto
    await performSearch(page, '#cto');
    
    // Step 10: Search for #hiring
    await performSearch(page, '#hiring');
    
    // Step 11: Wait gracefully before closing
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
