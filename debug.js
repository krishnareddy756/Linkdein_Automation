import { chromium } from 'playwright';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const EMAIL = process.env.LINKEDIN_EMAIL;
const PASSWORD = process.env.LINKEDIN_PASSWORD;

async function debugSearch() {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    // Load session
    const sessionPath = './sessions/linkedin_session.json';
    if (fs.existsSync(sessionPath)) {
      const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
      await context.addCookies(sessionData.cookies);
      console.log('✅ Session loaded');
    }

    // Go to LinkedIn
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Search for #cto
    const searchInput = await page.$('[placeholder*="Search"]');
    await searchInput.click();
    await page.keyboard.type('#cto', { delay: 50 });
    await page.keyboard.press('Enter');
    
    console.log('⏳ Waiting for search results to load...');
    await page.waitForTimeout(5000);
    
    try {
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      console.log('✅ Page loaded (networkidle)');
    } catch (e) {
      console.warn('⚠️  Network timeout, continuing anyway');
    }

    // Debug: Look for ANY element containing "Posts"
    console.log('\n🔍 SEARCHING FOR "POSTS" TEXT:');
    const postsElements = await page.evaluate(() => {
      const results = [];
      document.body.innerText.split('\n').forEach((line, i) => {
        if (line.toLowerCase().trim() === 'posts') {
          results.push({ line, lineNum: i });
        }
      });
      return results;
    });
    console.log(`  Found ${postsElements.length} lines with "Posts" text`);

    // Debug: Look for filter bar with broader selectors
    console.log('\n🔍 FILTER BAR SEARCH:');
    const filterBars = await page.evaluate(() => {
      const results = {};
      
      // Search 1: Original selector
      results['ul.search-reusables_filter-list'] = document.querySelectorAll('ul.search-reusables_filter-list').length;
      
      // Search 2: Any nav with "filter"
      results['nav'] = document.querySelectorAll('nav').length;
      
      // Search 3: Any div with "filter" in class
      results['div[class*="filter"]'] = document.querySelectorAll('div[class*="filter"]').length;
      
      // Search 4: Any element with "Posts" button text
      const allElements = document.querySelectorAll('*');
      let postsCount = 0;
      allElements.forEach(el => {
        if (el.textContent.trim() === 'Posts' && el.offsetHeight > 0) {
          postsCount++;
        }
      });
      results['elements with "Posts" text'] = postsCount;
      
      // Search 5: Look at all li elements
      results['li elements'] = document.querySelectorAll('li').length;
      
      return results;
    });
    console.log(`  ${JSON.stringify(filterBars, null, 2)}`);

    // Debug: Find all nav elements and their content
    console.log('\n🔍 ALL NAVS ON PAGE:');
    const navs = await page.$$('nav');
    console.log(`  Found ${navs.length} nav elements`);
    for (let i = 0; i < navs.length; i++) {
      const text = await navs[i].textContent();
      const ariaLabel = await navs[i].getAttribute('aria-label');
      console.log(`    Nav ${i}: aria-label="${ariaLabel}" | text="${text?.substring(0, 50)}..."`);
    }

    // Debug: Find all buttons and links
    console.log('\n🔍 ALL BUTTONS/LINKS:');
    const allButtons = await page.$$('button, a, [role="button"]');
    console.log(`  Found ${allButtons.length} clickable elements`);
    
    const postsButtons = [];
    for (let i = 0; i < allButtons.length; i++) {
      const text = await allButtons[i].textContent();
      if (text && text.trim().toLowerCase() === 'posts') {
        const tag = await allButtons[i].evaluate(el => el.tagName);
        const className = await allButtons[i].getAttribute('class');
        postsButtons.push({
          idx: i,
          tag,
          text: text.trim(),
          className: className?.substring(0, 50)
        });
      }
    }
    console.log(`  Found ${postsButtons.length} elements with "Posts" text:`);
    postsButtons.forEach(pb => {
      console.log(`    <${pb.tag}> | class="${pb.className}"`);
    });

    // Try to click the first Posts button found
    if (postsButtons.length > 0) {
      console.log('\n🎯 ATTEMPTING TO CLICK POSTS FILTER:');
      try {
        const buttons = await page.$$('button, a, [role="button"]');
        for (let i = 0; i < buttons.length; i++) {
          const text = await buttons[i].textContent();
          if (text && text.trim().toLowerCase() === 'posts') {
            console.log(`  ✅ Found Posts button at index ${i}, clicking...`);
            await buttons[i].click();
            
            console.log('  ⏳ Waiting for page to update...');
            await page.waitForTimeout(2000);
            
            const newUrl = await page.url();
            console.log(`  📍 URL after click: ${newUrl}`);
            
            if (newUrl.includes('/content/')) {
              console.log('  ✅ SUCCESS! URL changed to /content/');
            }
            
            break;
          }
        }
      } catch (error) {
        console.error('  ❌ Error clicking Posts:', error.message);
      }
    } else {
      console.log('\n⚠️  No "Posts" button found on page');
    }

    // Debug: Check current page state
    const pageState = await page.evaluate(() => ({
      title: document.title,
      url: window.location.href,
      bodyLength: document.body.innerText.length,
      hasSearchResults: document.body.innerText.toLowerCase().includes('result'),
    }));
    console.log('\n📄 PAGE STATE:');
    console.log(`  ${JSON.stringify(pageState, null, 2)}`);

    console.log('\n✅ Debug complete. Review the browser to see the page structure.');
    console.log('⏳ Keeping browser open for 60 seconds for manual inspection...');
    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

debugSearch();
