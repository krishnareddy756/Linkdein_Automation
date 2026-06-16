const isPageValid = async (page) => {
  try {
    await page.evaluate(() => true);
    return true;
  } catch {
    return false;
  }
};

const collectPostsFromPage = async (page, searchTerm) => {
  const posts = [];

  try {
    console.log(`  [COLLECT] ========== POST EXTRACTION START ==========`);
    console.log(`  [COLLECT] Search term: ${searchTerm}`);
    console.log(`  [COLLECT] Using "Open control menu" → "Copy link to post" method...`);

    // Scroll the page to load more posts before collecting (target: 20)
    console.log(`  [COLLECT] Scrolling page to load posts (target: 20)...`);
    let previousCount = 0;
    let sameCountAttempts = 0;

    for (let scrollAttempt = 0; scrollAttempt < 30; scrollAttempt++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
      await new Promise(r => setTimeout(r, 1500));

      const currentCount = await page.locator('button[aria-label*="Open control menu"]').count();
      console.log(`  [COLLECT] Scroll ${scrollAttempt + 1}: ${currentCount} posts visible`);

      if (currentCount >= 20) {
        console.log(`  [COLLECT] ✅ 20+ posts loaded, stopping scroll`);
        break;
      }

      if (currentCount === previousCount) {
        sameCountAttempts++;
        if (sameCountAttempts >= 3) {
          console.log(`  [COLLECT] ⚠️  No new posts after 3 attempts, reached end (${currentCount} posts)`);
          break;
        }
      } else {
        sameCountAttempts = 0;
      }

      previousCount = currentCount;
    }

    // Count available posts
    const totalButtons = await page.locator('button[aria-label*="Open control menu"]').count();
    const postsToCollect = Math.min(totalButtons, 20);
    console.log(`  [COLLECT] Found ${totalButtons} posts, collecting up to ${postsToCollect}`);

    for (let i = 0; i < postsToCollect; i++) {
      try {
        console.log(`  [COLLECT] Processing post ${i + 1}/${postsToCollect}...`);

        // Fresh reference each iteration — DOM may shift after scrolling
        const menuBtn = page.locator('button[aria-label*="Open control menu"]').nth(i);
        await menuBtn.scrollIntoViewIfNeeded();
        await new Promise(r => setTimeout(r, 400));

        // Open the post's control menu
        await menuBtn.click();
        await new Promise(r => setTimeout(r, 500));

        // Click "Copy link to post" — recorded as getByText in the Inspector
        const copyOption = page.getByText('Copy link to post').first();
        await copyOption.waitFor({ state: 'visible', timeout: 3000 });
        await copyOption.click();
        console.log(`  [COLLECT] Clicked "Copy link to post"`);

        await new Promise(r => setTimeout(r, 400));

        // Read from clipboard
        const link = await page.evaluate(() =>
          navigator.clipboard.readText().catch(() => '')
        );

        if (link && link.includes('linkedin.com')) {
          posts.push({ searchTerm, postUrl: link });
          console.log(`  [COLLECT] ✅ Post ${i + 1}: ${link.substring(0, 75)}`);
        } else {
          console.log(`  [COLLECT] ⚠️  Post ${i + 1}: clipboard empty or non-LinkedIn URL`);
        }

        // Dismiss the menu
        await page.keyboard.press('Escape');
        await new Promise(r => setTimeout(r, 300));

        // Light scroll to keep the next post in view
        if (i < postsToCollect - 1) {
          await page.evaluate(() => window.scrollBy(0, window.innerHeight));
          await new Promise(r => setTimeout(r, 600));
        }

      } catch (error) {
        console.log(`  [COLLECT] ⚠️  Error on post ${i + 1}: ${error.message}`);
        try { await page.keyboard.press('Escape'); } catch (_) {}
        continue;
      }
    }

    console.log(`  [COLLECT] Collected ${posts.length} post(s)`);
    console.log(`  [COLLECT] ========== POST EXTRACTION COMPLETE ==========`);

  } catch (error) {
    console.error(`  [COLLECT] ❌ Fatal error during collection: ${error.message}`);
  }

  return posts;
};

const capturePageDiagnostics = async (page, searchTerm = 'unknown') => {
  console.log(`\n[DIAG] 🔍 CAPTURING PAGE DIAGNOSTICS FOR SEARCH: ${searchTerm}`);
  console.log(`[DIAG] ================================================`);
  
  try {
    // 1. Page title and URL
    const pageInfo = await page.evaluate(() => ({
      title: document.title,
      url: window.location.href,
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      scrollTop: window.scrollY,
    }));
    console.log(`[DIAG] Page URL: ${pageInfo.url}`);
    console.log(`[DIAG] Page Title: ${pageInfo.title}`);
    console.log(`[DIAG] Viewport: ${pageInfo.innerWidth}x${pageInfo.innerHeight}, Scroll: ${pageInfo.scrollTop}px`);
    
    // 2. Check for filter elements (multiple patterns)
    const filterInfo = await page.evaluate(() => {
      const results = {
        ariaLabelFilter: document.querySelector('a[aria-label*="Filter"]') ? 'FOUND' : 'NOT FOUND',
        ariaLabelPosts: document.querySelector('a[aria-label="Filter by Posts"]') ? 'FOUND' : 'NOT FOUND',
        allAnchorTags: document.querySelectorAll('a').length,
        allWithAriaLabel: document.querySelectorAll('[aria-label*="Filter"]').length,
        allWithAriaChecked: document.querySelectorAll('[aria-checked]').length,
      };
      return results;
    });
    console.log(`[DIAG] Filter elements found:`);
    console.log(`[DIAG]   - a[aria-label*="Filter"]: ${filterInfo.ariaLabelFilter}`);
    console.log(`[DIAG]   - a[aria-label="Filter by Posts"]: ${filterInfo.ariaLabelPosts}`);
    console.log(`[DIAG]   - Total <a> tags: ${filterInfo.allAnchorTags}`);
    console.log(`[DIAG]   - Elements with aria-label containing "Filter": ${filterInfo.allWithAriaLabel}`);
    
    // 3. Check for post containers
    const postContainerInfo = await page.evaluate(() => ({
      feedUpdate: document.querySelectorAll('[data-testid="feed-update"]').length,
      articles: document.querySelectorAll('article').length,
      feedUpdateDiv: document.querySelectorAll('div[data-testid*="feed-update"]').length,
      allFeedItems: document.querySelectorAll('[data-testid*="update"]').length,
      feedContainers: document.querySelectorAll('[data-testid*="feed"]').length,
    }));
    console.log(`[DIAG] Post container elements found:`);
    console.log(`[DIAG]   - [data-testid="feed-update"]: ${postContainerInfo.feedUpdate}`);
    console.log(`[DIAG]   - <article>: ${postContainerInfo.articles}`);
    console.log(`[DIAG]   - div[data-testid*="feed-update"]: ${postContainerInfo.feedUpdateDiv}`);
    console.log(`[DIAG]   - [data-testid*="update"]: ${postContainerInfo.allFeedItems}`);
    console.log(`[DIAG]   - [data-testid*="feed"]: ${postContainerInfo.feedContainers}`);
    
    // 4. Sample all data-testid attributes
    const allDataTestIds = await page.evaluate(() => {
      const testIds = new Set();
      document.querySelectorAll('[data-testid]').forEach(el => {
        testIds.add(el.getAttribute('data-testid'));
      });
      return Array.from(testIds).slice(0, 15);
    });
    console.log(`[DIAG] Sample data-testid values on page: ${allDataTestIds.join(', ')}`);
    
    // 5. Count post URLs found
    const postUrlCount = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href*="linkedin.com/feed/update"]');
      return links.length;
    });
    console.log(`[DIAG] Post URLs found (/feed/update/): ${postUrlCount}`);
    
    // 6. Take screenshot
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = `./debug-${searchTerm}-${timestamp}.png`;
    await page.screenshot({ path: screenshotPath });
    console.log(`[DIAG] Screenshot saved: ${screenshotPath}`);
    
    console.log(`[DIAG] ================================================\n`);
    
    return {
      pageInfo,
      filterInfo,
      postContainerInfo,
      allDataTestIds,
      postUrlCount,
      screenshotPath,
    };
    
  } catch (error) {
    console.error(`[DIAG] ❌ Error capturing diagnostics: ${error.message}`);
  }
};

export { isPageValid, collectPostsFromPage, capturePageDiagnostics };
