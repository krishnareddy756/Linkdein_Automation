import { randomDelay } from './scrolling.js';
import { isPageValid, collectPostsFromPage } from './pageUtils.js';

const performSearch = async (page, searchQuery) => {
  console.log(`\n🔍 Searching for: ${searchQuery}`);
  console.log(`[DEBUG] performSearch started for: ${searchQuery}`);
  
  const collectedPosts = [];
  
  try {
    // Validate page before starting
    if (!(await isPageValid(page))) {
      console.warn('Page is no longer valid');
      return collectedPosts;
    }
    
    console.log(`[DEBUG] Page is valid, proceeding with search`);
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
      console.log(`[DEBUG] Searched with selectors: ${searchSelectors.join(', ')}`);
      return collectedPosts;
    }
    
    console.log(`[DEBUG] Search input found, typing query`);
    await page.waitForTimeout(randomDelay(500, 1000));
    await page.keyboard.press('Control+A');
    await page.keyboard.type(searchQuery, { delay: 50 });
    await page.waitForTimeout(randomDelay(500, 1000));
    
    console.log(`[DEBUG] Pressing Enter to search`);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(randomDelay(2000, 3000));
    
    console.log(`[DEBUG] Waiting for search results to load`);
    try {
      await page.waitForLoadState('networkidle', { timeout: 15000 });
      console.log(`[DEBUG] Page reached networkidle state`);
    } catch (error) {
      console.log(`[DEBUG] Network timeout, continuing anyway: ${error.message}`);
    }
    
    await page.waitForTimeout(3000);
    console.log(`[DEBUG] Search results should be loaded`);
    
    // DEBUG: Dump the page structure
    console.log(`[DEBUG] ========== PAGE STRUCTURE DEBUG ==========`);
    const pageInfo = await page.evaluate(() => {
      const info = {
        title: document.title,
        url: window.location.href,
        filterButton: !!document.querySelector('#navigational-filter_resultType'),
        feedUpdates: document.querySelectorAll('[data-testid="feed-update"]').length,
        allDivs: document.querySelectorAll('div[data-testid*="update"]').length,
        allArticles: document.querySelectorAll('article').length,
        allSections: document.querySelectorAll('section').length,
        allLinks: document.querySelectorAll('a[href*="linkedin.com/feed"]').length,
      };
      return info;
    });
    console.log(`[DEBUG] Page Info:`, pageInfo);
    
    // Try clicking filter using XPath
    try {
      console.log(`[DEBUG] Attempting to click Posts filter via XPath...`);
      const filterXPath = `/html/body/div[6]/div[3]/div[2]/section/div/nav/div/ul/li[1]/div/button`;
      const filterElement = await page.evaluate((xpath) => {
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        return result.singleNodeValue ? 'found' : 'not found';
      }, filterXPath);
      console.log(`[DEBUG] Filter element via XPath: ${filterElement}`);
      
      if (filterElement === 'found') {
        await page.evaluate((xpath) => {
          const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          if (result.singleNodeValue) {
            result.singleNodeValue.click();
          }
        }, filterXPath);
        console.log(`[DEBUG] ✓ Clicked Posts filter via XPath`);
        await page.waitForTimeout(randomDelay(2000, 3000));
      }
    } catch (error) {
      console.log(`[DEBUG] XPath click failed: ${error.message}`);
    }
    
    // Try label selector (Posts is a label, not a button)
    try {
      console.log(`[DEBUG] Attempting to click Posts filter via label selector...`);
      const labels = await page.$$('label');
      for (const label of labels) {
        const text = await label.evaluate(el => el.textContent.trim());
        if (text === 'Posts') {
          console.log(`[DEBUG] Found Posts label, clicking it`);
          await label.click();
          console.log(`[DEBUG] ✓ Clicked Posts label`);
          await page.waitForTimeout(randomDelay(2000, 3000));
          break;
        }
      }
    } catch (error) {
      console.log(`[DEBUG] Label click failed: ${error.message}`);
    }
    
    // Scroll and collect posts using keyboard scrolling
    const scrollCount = 5;
    console.log(`[DEBUG] Starting scroll loop with ${scrollCount} iterations using Page Down key`);
    
    for (let i = 0; i < scrollCount; i++) {
      if (!(await isPageValid(page))) {
        console.warn('Page became invalid during scroll loop');
        break;
      }
      
      console.log(`[DEBUG] Scroll iteration ${i + 1}: Pressing Page Down`);
      
      try {
        for (let j = 0; j < 3; j++) {
          await page.keyboard.press('PageDown');
          await page.waitForTimeout(500);
        }
        
        console.log(`[DEBUG] Scroll iteration ${i + 1}: Waiting for content to load`);
        await page.waitForTimeout(2000);
        
        console.log(`[DEBUG] Scroll iteration ${i + 1}: Collecting posts`);
        const posts = await collectPostsFromPage(page, searchQuery);
        console.log(`[DEBUG] Scroll iteration ${i + 1}: Collected ${posts.length} posts`);
        
        if (posts.length > 0) {
          collectedPosts.push(...posts);
        }
      } catch (error) {
        console.warn(`Error during scroll iteration ${i + 1}:`, error.message);
        break;
      }
    }
    
    console.log(`[DEBUG] Total posts collected: ${collectedPosts.length}`);
    await page.waitForTimeout(1000);
    
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

export { performSearch };
