import { randomDelay } from './scrolling.js';
import { isPageValid, collectPostsFromPage } from './pageUtils.js';

// Apply the "Posts" filter using the radio button recorded by Playwright Inspector.
// The filter lives directly on the main page, NOT inside an iframe.
const clickPostsFilter = async (page, maxRetries = 3) => {
  console.log(`\n[FILTER] Applying "Posts" filter (max ${maxRetries} retries)`);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[FILTER] Attempt ${attempt}/${maxRetries}`);

      // Recorded selector: getByRole('radio', { name: 'Filter by Posts' })
      const postsRadio = page.getByRole('radio', { name: 'Filter by Posts' });
      await postsRadio.waitFor({ state: 'visible', timeout: 8000 });
      await postsRadio.click();
      console.log(`[FILTER] ✅ "Posts" filter applied`);

      await page.waitForTimeout(randomDelay(1500, 2500));
      return true;
    } catch (error) {
      console.log(`[FILTER] ❌ Attempt ${attempt} failed: ${error.message}`);
      if (attempt < maxRetries) {
        await page.waitForTimeout(2000);
      }
    }
  }

  console.log(`[FILTER] ⚠️  Failed to apply "Posts" filter after ${maxRetries} attempts`);
  return false;
};

// Apply the "Date posted → Past 24 hours" filter.
// Recorded flow: click the "Filter by Date posted" button → select "Past 24 hours" radio →
// click "Show results" link.
const clickDatePostedFilter = async (page, maxRetries = 3) => {
  console.log(`\n[FILTER] Applying "Date posted" filter (max ${maxRetries} retries)`);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[FILTER] Attempt ${attempt}/${maxRetries}`);

      // Step 1: Open the Date posted dropdown
      const dateButton = page.getByRole('button', { name: 'Filter by Date posted' });
      await dateButton.waitFor({ state: 'visible', timeout: 8000 });
      await dateButton.click();
      console.log(`[FILTER] ✅ "Filter by Date posted" button clicked`);

      await page.waitForTimeout(500);

      // Step 2: Select "Past 24 hours"
      const past24Radio = page.getByRole('radio', { name: 'Past 24 hours' });
      await past24Radio.waitFor({ state: 'visible', timeout: 5000 });
      await past24Radio.click();
      console.log(`[FILTER] ✅ "Past 24 hours" selected`);

      await page.waitForTimeout(500);

      // Step 3: Confirm with "Show results" link
      const showResultsLink = page.getByRole('link', { name: 'Show results' });
      await showResultsLink.waitFor({ state: 'visible', timeout: 5000 });
      await showResultsLink.click();
      console.log(`[FILTER] ✅ "Show results" clicked`);

      await page.waitForTimeout(randomDelay(1500, 2500));
      console.log(`[FILTER] ✅ "Date posted" filter applied`);
      return true;
    } catch (error) {
      console.log(`[FILTER] ❌ Attempt ${attempt} failed: ${error.message}`);
      if (attempt < maxRetries) {
        await page.waitForTimeout(2000);
      }
    }
  }

  console.log(`[FILTER] ⚠️  Failed to apply "Date posted" filter after ${maxRetries} attempts`);
  return false;
};

// Main search function
const performSearch = async (page, searchQuery) => {
  console.log(`\n🔍 Searching for: ${searchQuery}`);

  const collectedPosts = [];

  try {
    if (!(await isPageValid(page))) {
      console.warn('[SEARCH] ❌ Page is no longer valid');
      return collectedPosts;
    }

    await page.waitForTimeout(randomDelay(1000, 2000));

    // === STEP 1: Find and click search bar ===
    console.log(`[SEARCH] Finding search input...`);
    const searchInput = page.getByTestId('typeahead-input');

    try {
      await searchInput.waitFor({ state: 'visible', timeout: 5000 });
      await searchInput.click();
      console.log(`[SEARCH] ✅ Search bar found and clicked`);
    } catch (error) {
      console.log(`[SEARCH] ❌ Could not find search bar: ${error.message}`);
      return collectedPosts;
    }

    // === STEP 2: Type query and press Enter ===
    await page.waitForTimeout(randomDelay(500, 1000));
    await searchInput.fill(searchQuery);
    await page.waitForTimeout(randomDelay(500, 1000));
    await searchInput.press('Enter');
    console.log(`[SEARCH] ✅ Search submitted for: ${searchQuery}`);

    // === STEP 3: Wait for search results page to settle ===
    await page.waitForTimeout(randomDelay(2000, 3000));
    console.log(`[SEARCH] ✅ Search results page ready`);

    // === STEP 4: Apply "Posts" filter ===
    const postsFilterApplied = await clickPostsFilter(page);
    if (!postsFilterApplied) {
      console.warn(`[FILTER] ⚠️  Posts filter not applied, continuing anyway`);
    }

    // === STEP 5: Apply "Date posted → Past 24 hours" filter ===
    const dateFilterApplied = await clickDatePostedFilter(page);
    if (!dateFilterApplied) {
      console.warn(`[FILTER] ⚠️  Date filter not applied, continuing anyway`);
    }

    // === STEP 6: Wait for filtered results to load ===
    await page.waitForTimeout(randomDelay(2000, 3000));
    console.log(`[POSTS] ✅ Waiting for filtered posts to render...`);

    // === STEP 7: Collect posts ===
    console.log(`[COLLECT] Starting post collection...`);
    const posts = await collectPostsFromPage(page, searchQuery);
    collectedPosts.push(...posts);

    // Deduplicate and cap at 20
    const uniquePosts = Array.from(
      new Map(collectedPosts.map(post => [post.postUrl, post])).values()
    ).slice(0, 20);

    console.log(`[COLLECT] ✅ Collected ${uniquePosts.length} unique post(s)`);

    if (uniquePosts.length === 0) {
      console.warn(`[COLLECT] ⚠️  No posts collected for: ${searchQuery}`);
    }

    return uniquePosts;

  } catch (error) {
    console.error(`[ERROR] Search failed for "${searchQuery}": ${error.message}`);
    return collectedPosts;
  }
};

export { performSearch, clickPostsFilter, clickDatePostedFilter };
