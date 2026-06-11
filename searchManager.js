import { randomDelay } from './scrolling.js';
import { isPageValid, collectPostsFromPage, capturePageDiagnostics } from './pageUtils.js';

// Helper function to click the "Date posted" filter inside iframe
const clickDatePostedFilter = async (page, filterLabel = 'Past 24 hours Filter by Past', maxRetries = 3) => {
  console.log(`\n[FILTER] Attempting to click "Date posted" filter (max ${maxRetries} retries)`);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[FILTER] Date posted retry attempt ${attempt}/${maxRetries}`);

      const iframe = page.frameLocator('[data-testid="interop-iframe"]');

      console.log(`[FILTER] Clicking "Date posted" filter button...`);
      await iframe.getByRole('button', { name: /Date posted filter/i }).first().click();
      await page.waitForTimeout(500);

      console.log(`[FILTER] Selecting "${filterLabel}" option...`);
      await iframe.locator('label').filter({ hasText: filterLabel }).first().click();
      await page.waitForTimeout(500);

      console.log(`[FILTER] Applying current date filter...`);
      await iframe.getByRole('button', { name: /Apply current filter to show/i }).first().click();

      await page.waitForTimeout(randomDelay(1500, 2500));
      console.log(`[FILTER] ✅ Successfully applied "Date posted" filter`);
      return true;
    } catch (error) {
      console.log(`[FILTER] ❌ Date posted attempt ${attempt} failed: ${error.message}`);

      if (attempt < maxRetries) {
        console.log(`[FILTER] Waiting 2 seconds before retry...`);
        await page.waitForTimeout(2000);
      }
    }
  }

  console.log(`[FILTER] ⚠️  Failed to apply "Date posted" filter after ${maxRetries} attempts`);
  return false;
};

// Helper function to click the "Posts" filter inside iframe
const clickPostsFilter = async (page, searchQuery = '', maxRetries = 3) => {
  console.log(`\n[FILTER] Attempting to click "Posts" filter (max ${maxRetries} retries)`);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[FILTER] Retry attempt ${attempt}/${maxRetries}`);
      
      // Wait for iframe to be available
      console.log(`[FILTER] Waiting for search results iframe to load...`);
      try {
        await page.waitForSelector('[data-testid="interop-iframe"]', { timeout: 10000 });
        console.log(`[FILTER] ✅ Iframe found`);
      } catch (error) {
        console.log(`[FILTER] ⚠️  Iframe not found: ${error.message}`);
      }
      
      // Wait for iframe content to fully load
      await page.waitForTimeout(2000);
      
      // Get the iframe element using frameLocator
      const iframe = page.frameLocator('[data-testid="interop-iframe"]');
      
      console.log(`[FILTER] ✅ Iframe accessible, finding Posts button...`);
      
      // Find the Posts button inside the iframe using getByRole
      // Use .first() to avoid strict mode violation when multiple 'Posts' buttons exist
      const postsButton = iframe.getByRole('button', { name: 'Posts' }).first();
      
      // Wait for button to be visible - increased timeout to 8 seconds
      console.log(`[FILTER] Waiting for Posts button to be visible (up to 8 seconds)...`);
      await postsButton.waitFor({
        state: 'visible',
        timeout: 8000
      });
      console.log(`[FILTER] ✅ Posts button is visible`);
      
      // Scroll into view
      console.log(`[FILTER] Scrolling Posts button into view`);
      await postsButton.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      
      // Click the button
      console.log(`[FILTER] Clicking Posts button`);
      await postsButton.click();
      console.log(`[FILTER] ✅ Successfully clicked "Posts" filter`);
      
      // Wait for filter to apply and content to update
      await page.waitForTimeout(randomDelay(2000, 3000));
      
      // Scroll inside iframe to ensure posts are loaded
      console.log(`[FILTER] Scrolling inside iframe to load posts...`);
      try {
        await iframe.locator('body').evaluate(el => el.scrollTop = 0);
        await page.waitForTimeout(1000);
      } catch (e) {
        console.log(`[FILTER] ℹ️  Scroll not needed`);
      }
      
      return true;
      
    } catch (error) {
      console.log(`[FILTER] ❌ Attempt ${attempt} failed: ${error.message}`);
      
      if (attempt < maxRetries) {
        console.log(`[FILTER] Waiting 2 seconds before retry...`);
        await page.waitForTimeout(2000);
      }
    }
  }
  
  console.log(`[FILTER] ⚠️  Failed to click "Posts" filter after ${maxRetries} attempts`);
  return false;
};

// Helper function to wait for posts to load after filter click
const waitForPostsToLoad = async (page, maxWaitTime = 15000) => {
  console.log(`[POSTS] Waiting for posts/content to load (max ${maxWaitTime}ms)...`);
  
  try {
    // Scroll inside iframe multiple times to load content
    try {
      const iframe = page.frameLocator('[data-testid="interop-iframe"]');
      for (let i = 0; i < 3; i++) {
        await iframe.locator('body').evaluate(el => {
          el.scrollTop += window.innerHeight;
        });
        await page.waitForTimeout(500);
      }
    } catch (e) {
      // Scroll might fail, continue anyway
    }
    
    // Search results may not have traditional feed-update containers
    // Look for common indicators that content has loaded
    await page.waitForSelector('a[href*="/feed/update/"], a[href*="/posts/"], li, .search-result', 
      { timeout: maxWaitTime, strict: false });
    console.log(`[POSTS] ✅ Content loaded on page`);
    await page.waitForTimeout(randomDelay(1000, 2000));
    return true;
  } catch (error) {
    console.log(`[POSTS] ⚠️  Content selector not found within ${maxWaitTime}ms: ${error.message}`);
    // Don't return false - proceed anyway with graceful degradation
    await page.waitForTimeout(3000);
    return false; // Indicate timeout but don't stop execution
  }
};

// Main search function
const performSearch = async (page, searchQuery) => {
  console.log(`\n🔍 Searching for: ${searchQuery}`);
  console.log(`[DEBUG] performSearch started for: ${searchQuery}`);
  
  const collectedPosts = [];
  
  try {
    // Validate page before starting
    if (!(await isPageValid(page))) {
      console.warn('❌ Page is no longer valid');
      return collectedPosts;
    }
    
    console.log(`[DEBUG] ✅ Page is valid, proceeding with search`);
    await page.waitForTimeout(randomDelay(1000, 2000));
    
    // === STEP 1: Find and click search bar ===
    console.log(`[SEARCH] Finding search input using data-testid="typeahead-input"`);
    const searchInput = page.getByTestId('typeahead-input');
    
    try {
      await searchInput.waitFor({ state: 'visible', timeout: 5000 });
      console.log(`[SEARCH] ✅ Found search bar`);
      await searchInput.click();
    } catch (error) {
      console.log(`[SEARCH] ❌ Could not find search bar: ${error.message}`);
      return collectedPosts;
    }
    
    // === STEP 2: Type query and search ===
    console.log(`[SEARCH] Typing search query: ${searchQuery}`);
    await page.waitForTimeout(randomDelay(500, 1000));
    await searchInput.fill(searchQuery);
    await page.waitForTimeout(randomDelay(500, 1000));
    
    console.log(`[SEARCH] Pressing Enter to search`);
    await searchInput.press('Enter');
    await page.waitForTimeout(randomDelay(2000, 3000));
    
    // === STEP 3: Wait for search results to load ===
    console.log(`[SEARCH] Waiting for search results page and iframe to load`);
    try {
      // Wait for the search results iframe to appear
      await page.waitForSelector('[data-testid="interop-iframe"]', { timeout: 10000 });
      console.log(`[SEARCH] ✅ Search results iframe loaded`);
    } catch (error) {
      console.log(`[SEARCH] ⚠️  Iframe timeout, continuing anyway: ${error.message}`);
    }
    
    // Wait a bit for content to render inside iframe
    await page.waitForTimeout(2000);
    console.log(`[SEARCH] ✅ Search results page ready`);
    
    // === STEP 4: Click "Posts" filter ===
    const filterClicked = await clickPostsFilter(page, searchQuery);
    
    if (!filterClicked) {
      console.warn(`[FILTER] ⚠️  Could not click filter, will attempt collection anyway`);
    }

    // === STEP 5: Click "Date posted" filter and set time range ===
    const dateFilterClicked = await clickDatePostedFilter(page);

    if (!dateFilterClicked) {
      console.warn(`[FILTER] ⚠️  Could not apply "Date posted" filter, will attempt collection anyway`);
    }
    
    // === STEP 6: Wait for posts to load and scroll to trigger dynamic loading ===
    console.log(`[POSTS] Waiting for posts to appear after filters...`);
    
    // Aggressive scrolling inside iframe to load posts
    const iframe = page.frameLocator('[data-testid="interop-iframe"]');
    console.log(`[POSTS] Starting aggressive pre-scrolling to load more posts...`);
    for (let i = 0; i < 15; i++) {
      try {
        await iframe.locator('body').evaluate(el => {
          el.scrollTop += window.innerHeight * 2;
        });
        await page.waitForTimeout(1200);
        console.log(`[POSTS] Pre-scroll attempt ${i + 1}/15`);
      } catch (e) {
        // Ignore scroll errors
      }
    }
    
    await page.waitForTimeout(randomDelay(3000, 4000));
    console.log(`[POSTS] ✅ Pre-scrolling complete, ready to collect posts`);
    
    // === STEP 7: Collect posts (exactly 5) ===
    console.log(`[COLLECT] Collecting posts from search results...`);
    const posts = await collectPostsFromPage(page, searchQuery);
    
    if (posts.length > 0) {
      collectedPosts.push(...posts);
    }
    
    // Deduplicate and limit to 10 posts
    const uniquePosts = Array.from(
      new Map(collectedPosts.map(post => [post.postUrl, post])).values()
    );
    const selectedPosts = uniquePosts.slice(0, 10);
    
    console.log(`[COLLECT] ✅ Found and collected ${selectedPosts.length} posts`);
    
    if (selectedPosts.length === 0) {
      console.warn(`[COLLECT] ⚠️  No posts collected for search: ${searchQuery}`);
    }
    
    return selectedPosts;
    
  } catch (error) {
    console.error(`[ERROR] Error during search for ${searchQuery}:`, error.message);
    return collectedPosts;
  }
};

export { performSearch, clickPostsFilter, waitForPostsToLoad };
