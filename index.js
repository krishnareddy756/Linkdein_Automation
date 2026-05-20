import { chromium } from 'playwright';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { appendToSheets, prepareDataForSheets } from './sheetsService.js';

dotenv.config();

const EMAIL = process.env.LINKEDIN_EMAIL || 'sampleemail@example.com';
const PASSWORD = process.env.LINKEDIN_PASSWORD || 'samplepassword';
const HEADLESS = process.env.HEADLESS === 'false' ? false : true;
const SLOW_MO = parseInt(process.env.SLOW_MO || '500');
const SESSION_DIR = process.env.SESSION_DIR || './sessions';
const SESSION_EXPIRY_HOURS = parseInt(process.env.SESSION_EXPIRY_HOURS || '24');

const ensureSessionDir = () => {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }
};

const getSessionPath = () => {
  return path.join(SESSION_DIR, 'linkedin_session.json');
};

const isSessionValid = () => {
  const sessionPath = getSessionPath();
  
  if (!fs.existsSync(sessionPath)) {
    return false;
  }
  
  try {
    const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
    const createdAt = new Date(sessionData.createdAt);
    const now = new Date();
    const hoursPassed = (now - createdAt) / (1000 * 60 * 60);
    
    if (hoursPassed > SESSION_EXPIRY_HOURS) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
};

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
  } catch (error) {
    // Session save failed
  }
};

const loadSession = async (context) => {
  try {
    const sessionPath = getSessionPath();
    const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
    await context.addCookies(sessionData.cookies);
    return true;
  } catch (error) {
    return false;
  }
};

const randomDelay = (min = 1000, max = 3000) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const scrollDown = async (page, scrollCount = 3) => {
  for (let i = 0; i < scrollCount; i++) {
    const scrollAmount = Math.random() * 400 + 200;
    await page.evaluate((pixels) => {
      let scrollElement = document.querySelector('[role="main"]') || 
                         document.querySelector('main') ||
                         document.querySelector('.scaffold-layout__main') ||
                         document.documentElement;
      
      if (scrollElement.scrollTop !== undefined && scrollElement.scrollHeight > scrollElement.clientHeight) {
        scrollElement.scrollTop += pixels;
      } else {
        window.scrollBy(0, pixels);
      }
    }, scrollAmount);
    
    await page.waitForTimeout(randomDelay(800, 2000));
  }
};

const scrollUp = async (page, scrollCount = 3) => {
  for (let i = 0; i < scrollCount; i++) {
    const scrollAmount = Math.random() * 400 + 200;
    await page.evaluate((pixels) => {
      let scrollElement = document.querySelector('[role="main"]') || 
                         document.querySelector('main') ||
                         document.querySelector('.scaffold-layout__main') ||
                         document.documentElement;
      
      if (scrollElement.scrollTop !== undefined && scrollElement.scrollHeight > scrollElement.clientHeight) {
        scrollElement.scrollTop -= pixels;
      } else {
        window.scrollBy(0, -pixels);
      }
    }, scrollAmount);
    
    await page.waitForTimeout(randomDelay(800, 2000));
  }
};

const collectPostsFromPage = async (page, searchTerm) => {
  const posts = [];
  
  try {
    let postElements = await page.$$('div[class*="update-components"]');
    if (postElements.length === 0) {
      postElements = await page.$$('div[class*="update"]');
    }
    if (postElements.length === 0) {
      postElements = await page.$$('article');
    }
    
    const postsToProcess = Math.min(postElements.length, 5);
    
    for (let i = 0; i < postsToProcess; i++) {
      try {
        const postElement = postElements[i];
        await postElement.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        
        const moreButtons = await postElement.$$('button');
        let moreButton = null;
        
        for (let btn of moreButtons) {
          try {
            const ariaLabel = await btn.getAttribute('aria-label');
            const btnText = await btn.evaluate(el => el.textContent);
            
            if ((ariaLabel && (ariaLabel.toLowerCase().includes('more') || ariaLabel.toLowerCase().includes('menu'))) ||
                (btnText && (btnText.includes('⋯') || btnText.includes('...')))) {
              moreButton = btn;
              break;
            }
          } catch (e) {
            // Continue
          }
        }
        
        if (moreButton) {
          try {
            await moreButton.click();
            await page.waitForTimeout(randomDelay(500, 800));
            
            let clickedCopy = false;
            const copySelectors = [
              '[role="menuitem"] >> text=Copy link to post',
              '[role="menuitem"] >> text=Copy link',
              'div >> text=Copy link to post',
              'div >> text=Copy link',
              'li >> text=Copy link',
            ];
            
            for (let selector of copySelectors) {
              try {
                const el = await page.$(selector);
                if (el) {
                  await el.click();
                  clickedCopy = true;
                  await page.waitForTimeout(500);
                  break;
                }
              } catch (e) {
                // Continue
              }
            }
            
            if (clickedCopy) {
              try {
                const clipboardText = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
                if (clipboardText && clipboardText.includes('linkedin.com')) {
                  posts.push({
                    searchTerm: searchTerm,
                    postUrl: clipboardText,
                  });
                }
              } catch (clipboardError) {
                // Clipboard error
              }
            }
            
            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
          } catch (clickError) {
            // Error clicking menu
          }
        }
      } catch (error) {
        // Error processing post
      }
    }
  } catch (error) {
    // Error collecting posts
  }
  
  return posts;
};

const performSearch = async (page, searchQuery) => {
  console.log(`\nSearching for: ${searchQuery}`);
  
  const collectedPosts = [];
  
  try {
    await page.waitForTimeout(randomDelay(1000, 2000));
    
    const searchInputs = await page.$$('[placeholder*="Search"]');
    
    if (searchInputs.length === 0) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
    
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
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!searchInputFound) {
      console.warn('Could not find search bar');
      return collectedPosts;
    }
    
    await page.waitForTimeout(randomDelay(500, 1000));
    await page.keyboard.press('Control+A');
    await page.keyboard.type(searchQuery, { delay: 50 });
    await page.waitForTimeout(randomDelay(500, 1000));
    
    await page.keyboard.press('Enter');
    await page.waitForTimeout(randomDelay(2000, 3000));
    
    try {
      await page.waitForLoadState('networkidle', { timeout: 15000 });
    } catch (error) {
      // Network timeout, continue
    }
    
    await page.waitForTimeout(3000);
    
    // Click Posts filter button if exists
    try {
      await page.waitForTimeout(2000);
      
      let postsButton = await page.$('button:has-text("Posts")');
      
      if (!postsButton) {
        postsButton = await page.locator('button', { has: page.locator('text=Posts') }).first().elementHandle().catch(() => null);
      }
      
      if (!postsButton) {
        const allButtons = await page.$$('button');
        for (let btn of allButtons) {
          const text = await btn.evaluate(el => el.textContent.trim());
          if (text === 'Posts') {
            postsButton = btn;
            break;
          }
        }
      }
      
      if (postsButton) {
        await postsButton.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await postsButton.click({ force: true });
        await page.waitForTimeout(randomDelay(2000, 3000));
        
        try {
          await page.waitForLoadState('networkidle', { timeout: 5000 });
        } catch (e) {
          // Continue
        }
      }
    } catch (error) {
      // Continue if Posts button not found
    }
    
    // Scroll and collect posts
    const scrollCount = Math.floor(Math.random() * 3) + 3;
    
    for (let i = 0; i < scrollCount; i++) {
      const scrollAmount = Math.random() * 500 + 400;
      try {
        await page.evaluate((pixels) => {
          window.scrollBy({ top: pixels, left: 0, behavior: 'auto' });
        }, scrollAmount);
        
        await page.waitForTimeout(randomDelay(2000, 3500));
        
        const posts = await collectPostsFromPage(page, searchQuery);
        if (posts.length > 0) {
          collectedPosts.push(...posts);
        }
      } catch (error) {
        // Continue
      }
    }
    
    await page.waitForTimeout(randomDelay(5000, 10000));
    
    const uniquePosts = Array.from(
      new Map(collectedPosts.map(post => [post.postUrl, post])).values()
    );
    const selectedPosts = uniquePosts.slice(0, 5);
    
    console.log(`Found ${selectedPosts.length} posts`);
    return selectedPosts;
    
  } catch (error) {
    console.error(`Error during search for ${searchQuery}:`, error.message);
    return collectedPosts;
  }
};

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
      
      const context = await browser.newContext();
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
    
    const ctoPosts = await performSearch(page, '#cto');
    allCollectedPosts.push(...ctoPosts);
    
    console.log('\nReturning to feed...\n');
    try {
      await page.goto('https://www.linkedin.com/feed/', { 
        waitUntil: 'domcontentloaded',
        timeout: 20000 
      });
    } catch (error) {
      await page.waitForTimeout(3000);
    }
    await page.waitForTimeout(randomDelay(1000, 2000));
    
    const hiringPosts = await performSearch(page, '#hiring');
    allCollectedPosts.push(...hiringPosts);
    
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
