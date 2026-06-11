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
    console.log(`  [COLLECT] Using "Copy link to post" method...`);
    
    // Get the iframe
    const iframe = page.frameLocator('[data-testid="interop-iframe"]');
    
    // Scroll inside iframe to load more posts - loop until we find 10 or reach end
    console.log(`  [COLLECT] Scrolling inside iframe to load posts...`);
    let previousCount = 0;
    let sameCountAttempts = 0;
    
    for (let scrollAttempt = 0; scrollAttempt < 35; scrollAttempt++) {
      try {
        // Scroll to bottom with larger increments
        const scrollableArea = iframe.locator('[role="region"], [class*="scroll"], body');
        await scrollableArea.first().evaluate(el => {
          el.scrollTop = el.scrollHeight + 500;
        });
        
        // Wait for new posts to load
        await new Promise(r => setTimeout(r, 1500));
        
        // Check current post count
        const currentPostMenuButtons = await iframe.locator('button[aria-label*="Open control menu"]').count();
        console.log(`  [COLLECT] Scroll attempt ${scrollAttempt + 1}: Found ${currentPostMenuButtons} posts`);
        
        // If we have 10+ posts or reached the end, stop scrolling
        if (currentPostMenuButtons >= 10) {
          console.log(`  [COLLECT] ✅ Found 10+ posts, stopping scroll`);
          break;
        }
        
        // If post count didn't change after 2 attempts (instead of 3), we've likely reached the end
        if (currentPostMenuButtons === previousCount) {
          sameCountAttempts++;
          if (sameCountAttempts >= 2) {
            console.log(`  [COLLECT] ⚠️  No new posts loaded after 2 attempts, reached end (found ${currentPostMenuButtons} posts)`);
            break;
          }
        } else {
          sameCountAttempts = 0;
        }
        
        previousCount = currentPostMenuButtons;
        
      } catch (e) {
        console.log(`  [COLLECT] Error during scroll: ${e.message}`);
        break;
      }
    }
    
    // Find all post containers in iframe
    console.log(`  [COLLECT] Finding post control menu buttons...`);
    const postMenuButtons = await iframe.locator('button[aria-label*="Open control menu"]').all();
    console.log(`  [COLLECT] Found ${postMenuButtons.length} posts with control menus`);
    
    // Limit to 10 posts
    const postsToCollect = Math.min(postMenuButtons.length, 10);
    console.log(`  [COLLECT] Collecting ${postsToCollect} posts (limit: 10)`);
    
    for (let i = 0; i < postsToCollect; i++) {
      try {
        console.log(`  [COLLECT] Processing post ${i + 1}/${postsToCollect}...`);
        
        // Get the button again (fresh reference)
        const postMenuBtn = await iframe.locator('button[aria-label*="Open control menu"]').nth(i);
        
        // Scroll into view
        await postMenuBtn.scrollIntoViewIfNeeded();
        await new Promise(r => setTimeout(r, 500));
        
        // Click the control menu button
        await postMenuBtn.click();
        await new Promise(r => setTimeout(r, 500));
        
        // Click "Copy link to post" button
        const copyButton = iframe.getByRole('button', { name: 'Copy link to post' });
        await copyButton.click();
        console.log(`  [COLLECT] Clicked "Copy link to post"`);
        
        // Wait a moment for clipboard update
        await new Promise(r => setTimeout(r, 300));
        
        // Read from clipboard using page context
        const link = await page.evaluate(() => {
          return navigator.clipboard.readText().catch(() => '');
        });
        
        if (link && link.includes('linkedin.com')) {
          posts.push({
            searchTerm: searchTerm,
            postUrl: link,
          });
          console.log(`  [COLLECT] ✅ Post ${i + 1}: ${link.substring(0, 75)}`);
        } else {
          console.log(`  [COLLECT] ⚠️  Post ${i + 1}: No valid link in clipboard`);
        }
        
        // Close menu by clicking elsewhere or pressing Escape
        await page.keyboard.press('Escape');
        await new Promise(r => setTimeout(r, 300));
        
        // === SCROLL TO LOAD MORE POSTS ===
        // Scroll down to trigger loading of next posts
        if (i < postsToCollect - 1) {
          console.log(`  [COLLECT] Scrolling to load more posts...`);
          for (let scrollCount = 0; scrollCount < 3; scrollCount++) {
            try {
              const scrollableArea = iframe.locator('[role="region"], [class*="scroll"], body');
              await scrollableArea.first().evaluate(el => {
                el.scrollTop += window.innerHeight * 1.5;
              });
              await new Promise(r => setTimeout(r, 600));
              console.log(`  [COLLECT]   └─ Scroll ${scrollCount + 1}/3`);
            } catch (e) {
              // Ignore scroll errors
            }
          }
        }
        
      } catch (error) {
        console.log(`  [COLLECT] ⚠️  Error processing post ${i + 1}: ${error.message}`);
        // Try to close menu
        try {
          await page.keyboard.press('Escape');
        } catch (e) {
          // Ignore
        }
        continue;
      }
    }
    
    console.log(`  [COLLECT] Successfully collected ${posts.length} posts`);
    console.log(`  [COLLECT] ========== POST EXTRACTION COMPLETE ==========`);
    
  } catch (error) {
    console.error(`  [COLLECT] ❌ Error during post collection: ${error.message}`);
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
