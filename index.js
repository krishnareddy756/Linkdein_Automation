import { chromium } from 'playwright';
import dotenv from 'dotenv';
import { appendToSheets, prepareDataForSheets, getSearchKeywords, removeDuplicates } from './sheetsService.js';
import { 
  getSessionPath, 
  saveSession, 
  loadSession 
} from './sessionManager.js';
import {
  createSession,
  logSessionStart,
  updateSessionEnd,
  checkDetectionSignals,
} from './sessionTracking.js';
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
  
  // Initialize session tracking
  const automationSession = createSession();
  let sessionLoggingError = '';
  automationSession.status = 'running';
  
  try {
    console.log('Starting LinkedIn Playwright Automation...\n');
    
    // Log session start to Google Sheets
    try {
      await logSessionStart(automationSession);
      console.log(`📊 Session ID: ${automationSession.session_id}\n`);
    } catch (error) {
      sessionLoggingError = `Failed to log session start: ${error.message}`;
      console.warn(`⚠️  ${sessionLoggingError}`);
    }
    
    browser = await chromium.launch({
      headless: HEADLESS,
      slowMo: SLOW_MO,
    });
    
    let context;
    let sessionLoaded = false;
    
    console.log('Checking for saved session...\n');
    try {
      context = await browser.newContext({
        permissions: ['clipboard-read', 'clipboard-write'],
      });
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
      
      context = await browser.newContext({
        permissions: ['clipboard-read', 'clipboard-write'],
      });
      page = await context.newPage({
        viewport: { width: 1280, height: 720 },
      });
      
      // Strategy 1: Try home page sign-in button approach (more reliable)
      console.log('📍 Strategy 1: Using home page sign-in button...');
      try {
        await page.goto('https://www.linkedin.com/', {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        });
        
        // Click sign in button
        console.log('   Clicking sign-in button...');
        try {
          await page.locator('[data-test-id="home-hero-sign-in-cta"]').click({ timeout: 5000 });
        } catch (e) {
          // Fallback to getByRole
          console.log('   Fallback: Using getByRole...');
          await page.getByRole('button', { name: /sign in|log in/i }).first().click();
        }
        
        await page.waitForTimeout(randomDelay(1500, 2500));
        
        // Fill email/phone
        console.log('   Filling email...');
        try {
          await page.getByRole('textbox', { name: 'Email or phone' }).fill(EMAIL);
        } catch (e) {
          console.log('   Fallback: Using input selector for email...');
          await page.locator('input[type="text"], input[type="email"]').first().fill(EMAIL);
        }
        
        await page.waitForTimeout(randomDelay(500, 1000));
        
        // Fill password
        console.log('   Filling password...');
        try {
          await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD);
        } catch (e) {
          console.log('   Fallback: Using input[type="password"] for password...');
          await page.locator('input[type="password"]').fill(PASSWORD);
        }
        
        await page.waitForTimeout(randomDelay(500, 1000));
        
        // Click sign in button
        console.log('   Clicking sign in button...');
        try {
          await page.getByRole('button', { name: 'Sign in', exact: true }).click();
        } catch (e) {
          console.log('   Fallback: Using getByRole for button click...');
          await page.getByRole('button', { name: /sign in|log in/i }).first().click();
        }
        
        await page.waitForTimeout(2000);
        
        try {
          await page.waitForLoadState('networkidle', { timeout: 20000 });
          console.log('✅ Successfully logged in via Strategy 1\n');
        } catch (error) {
          console.log('⚠️  Network idle timeout, but continuing...');
        }
        
      } catch (error) {
        console.log(`\n⚠️  Strategy 1 failed: ${error.message}`);
        console.log('📍 Strategy 2: Using direct login page...');
        
        try {
          await page.goto('https://www.linkedin.com/login', {
            waitUntil: 'domcontentloaded',
            timeout: 15000,
          });
          
          // Wait for login form to load
          await page.waitForTimeout(2000);
          
          // Try multiple email/phone input selectors
          console.log('   Trying to fill email field...');
          let emailFilled = false;
          
          // Try strategy 1: by role
          try {
            await page.getByRole('textbox', { name: 'Email or phone' }).fill(EMAIL);
            emailFilled = true;
            console.log('   ✅ Email filled (by role)');
          } catch (e1) {
            // Try strategy 2: name attribute
            try {
              await page.locator('input[name="session_key"]').fill(EMAIL);
              emailFilled = true;
              console.log('   ✅ Email filled (by name)');
            } catch (e2) {
              // Try strategy 3: type=text
              try {
                await page.locator('input[type="text"]').first().fill(EMAIL);
                emailFilled = true;
                console.log('   ✅ Email filled (by type)');
              } catch (e3) {
                console.log(`   ❌ Could not fill email: ${e3.message}`);
              }
            }
          }
          
          if (emailFilled) {
            await page.waitForTimeout(randomDelay(500, 1000));
            
            // Try multiple password input selectors
            console.log('   Trying to fill password field...');
            let passwordFilled = false;
            
            try {
              await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD);
              passwordFilled = true;
              console.log('   ✅ Password filled (by role)');
            } catch (e1) {
              try {
                await page.locator('input[name="session_password"]').fill(PASSWORD);
                passwordFilled = true;
                console.log('   ✅ Password filled (by name)');
              } catch (e2) {
                try {
                  await page.locator('input[type="password"]').fill(PASSWORD);
                  passwordFilled = true;
                  console.log('   ✅ Password filled (by type)');
                } catch (e3) {
                  console.log(`   ❌ Could not fill password: ${e3.message}`);
                }
              }
            }
            
            if (passwordFilled) {
              await page.waitForTimeout(randomDelay(500, 1000));
              
              // Click sign in
              console.log('   Clicking sign in button...');
              try {
                await page.getByRole('button', { name: 'Sign in' }).click();
              } catch (e1) {
                try {
                  await page.locator('button[type="submit"]').click();
                } catch (e2) {
                  await page.getByRole('button', { name: /log in|sign in/i }).first().click();
                }
              }
              
              try {
                await page.waitForLoadState('networkidle', { timeout: 20000 });
                console.log('✅ Successfully logged in via Strategy 2\n');
              } catch (error) {
                console.log('⚠️  Network idle timeout, but continuing...');
              }
            } else {
              throw new Error('Could not fill password field with any strategy');
            }
          } else {
            throw new Error('Could not fill email field with any strategy');
          }
        } catch (strategyError) {
          console.error(`❌ All login strategies failed: ${strategyError.message}\n`);
        }
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
    
    // Get search keywords from Google Sheets
    let keywords = [];
    try {
      keywords = await getSearchKeywords();
      automationSession.total_keywords = keywords.length;
      console.log(`\n📋 Found ${keywords.length} keyword(s) to process\n`);
    } catch (error) {
      console.error('Failed to fetch keywords, using defaults:', error.message);
      keywords = ['#cto', '#hiring']; // Fallback to defaults
      automationSession.total_keywords = keywords.length;
      automationSession.errors = `Failed to fetch keywords: ${error.message}`;
    }
    
    // Loop through each keyword and perform search
    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i];
      console.log(`\n🔍 Searching for keyword ${i + 1}/${keywords.length}: ${keyword}`);
      
      if (await isPageValid(page)) {
        try {
          const posts = await performSearch(page, keyword);
          allCollectedPosts.push(...posts);
          automationSession.total_keywords += 1;
        } catch (searchError) {
          console.error(`❌ Error searching for ${keyword}:`, searchError.message);
          automationSession.detection_flag = checkDetectionSignals(searchError.message, allCollectedPosts.length);
          if (automationSession.detection_flag) {
            console.warn('⚠️  DETECTION FLAG TRIGGERED - LinkedIn may have detected bot behavior');
            automationSession.status = 'detection_suspected';
            automationSession.errors = `Detection signal at keyword: ${keyword}`;
            break; // Stop further searches
          }
        }
        
        // Return to feed before next search (except for last keyword)
        if (i < keywords.length - 1) {
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
        }
      } else {
        console.warn(`⚠️  Page invalid, skipping '${keyword}' search`);
      }
    }
    
    if (allCollectedPosts.length > 0) {
      console.log(`\nUploading ${allCollectedPosts.length} posts to Google Sheets...\n`);
      
      // Remove duplicate posts before uploading
      const uniquePosts = await removeDuplicates(allCollectedPosts);
      
      if (uniquePosts.length > 0) {
        const dataToUpload = prepareDataForSheets(uniquePosts);
        await appendToSheets(dataToUpload);
        automationSession.total_posts = allCollectedPosts.length;
      } else {
        console.log('\n✅ All posts are duplicates - nothing new to upload');
      }
    } else {
      console.log('\nNo posts collected to upload');
    }
    
    await page.waitForTimeout(randomDelay(2000, 4000));
    console.log('Task completed!');
    
  } catch (error) {
    console.error('Error:', error.message);
    automationSession.status = 'failed';
    automationSession.errors = error.message;
    automationSession.detection_flag = checkDetectionSignals(error.message, allCollectedPosts.length);
    if (automationSession.detection_flag) {
      console.warn('⚠️  DETECTION FLAG TRIGGERED');
      automationSession.status = 'detection_suspected';
    }
  } finally {
    if (browser) {
      await browser.close();
      console.log('\nAutomation completed.\n');
    }
    
    // Set final status if still running
    if (automationSession.status === 'running') {
      automationSession.status = 'completed';
    }
    
    // Update session with final results
    try {
      await updateSessionEnd(automationSession, {
        total_keywords: automationSession.total_keywords,
        total_posts: allCollectedPosts.length,
        total_leads: 0, // Will be updated manually by user
        status: automationSession.status,
        detection_flag: automationSession.detection_flag,
        errors: automationSession.errors || sessionLoggingError,
      });
      console.log(`📊 Session ${automationSession.session_id} finalized in Google Sheets`);
    } catch (error) {
      console.error('⚠️  Could not update session:', error.message);
    }
  }
};

runLinkedInAutomation();
