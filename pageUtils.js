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
    console.log(`  [DEBUG] ========== POST COLLECTION DEBUG ==========`);
    
    // First, dump all available selectors
    const selectors = {
      'data-testid="feed-update"': await page.$$('[data-testid="feed-update"]').then(x => x.length),
      'article': await page.$$('article').then(x => x.length),
      'div[data-testid*="post"]': await page.$$('div[data-testid*="post"]').then(x => x.length),
      'div[data-testid*="update"]': await page.$$('div[data-testid*="update"]').then(x => x.length),
      'a[href*="/posts/"]': await page.$$('a[href*="/posts/"]').then(x => x.length),
    };
    console.log(`  [DEBUG] Available selectors:`, selectors);
    
    // ALSO dump ALL linkedin links to see what's available
    const allLinksInfo = await page.evaluate(() => {
      const allLinks = document.querySelectorAll('a[href*="linkedin.com"]');
      const linkSummary = {
        totalLinkedInLinks: allLinks.length,
        feedLinks: 0,
        postLinks: 0,
        companyLinks: 0,
        otherLinks: 0,
        sampleLinks: []
      };
      
      for (let i = 0; i < allLinks.length; i++) {
        const href = allLinks[i].getAttribute('href');
        if (!href) continue;
        
        if (href.includes('/feed/')) linkSummary.feedLinks++;
        else if (href.includes('/posts/')) linkSummary.postLinks++;
        else if (href.includes('/company/')) linkSummary.companyLinks++;
        else linkSummary.otherLinks++;
        
        // Collect first 15 links as samples
        if (linkSummary.sampleLinks.length < 15) {
          linkSummary.sampleLinks.push(href.substring(0, 70));
        }
      }
      
      return linkSummary;
    });
    
    console.log(`  [DEBUG] All LinkedIn links on page:`, allLinksInfo);
    
    // Try to find post containers using multiple selectors
    let postContainers = await page.$$('[data-testid="feed-update"]');
    
    if (postContainers.length === 0) {
      console.log(`  [DEBUG] Trying: article`);
      postContainers = await page.$$('article');
    }
    
    if (postContainers.length === 0) {
      console.log(`  [DEBUG] Trying: div[data-testid*="update"]`);
      postContainers = await page.$$('div[data-testid*="update"]');
    }
    
    if (postContainers.length === 0) {
      console.log(`  [DEBUG] Extracting post links directly from page`);
      const links = await page.evaluate(() => {
        const postLinks = [];
        const allLinks = document.querySelectorAll('a[href*="linkedin.com"]');
        
        console.log(`Scanning ${allLinks.length} links...`);
        
        for (const link of allLinks) {
          const href = link.getAttribute('href');
          if (!href) continue;
          
          // Debug: log all links with /posts/
          if (href.includes('/posts/')) {
            console.log(`Found /posts/ link: ${href.substring(0, 100)}`);
          }
          
          // Simple approach: just grab anything with /posts/ that's not obviously a company page
          const isCompanyPostsPage = href.includes('/company/') && href.includes('/posts');
          
          if (href.includes('/posts/') && !isCompanyPostsPage) {
            postLinks.push(href);
            console.log(`✓ Added: ${href.substring(0, 80)}`);
          }
        }
        
        return postLinks;
      });
      
      console.log(`  [DEBUG] Extracted ${links.length} total post links before dedup`);
      
      if (links.length > 0) {
        const uniqueLinks = [...new Set(links)];
        console.log(`  [DEBUG] After dedup: ${uniqueLinks.length} unique links`);
        
        const selectedLinks = uniqueLinks.slice(0, 5);
        console.log(`  [DEBUG] Final selected links: ${selectedLinks.length}`);
        
        for (const link of selectedLinks) {
          posts.push({
            searchTerm: searchTerm,
            postUrl: link,
          });
          console.log(`  [DEBUG] ✓ Added link: ${link.substring(0, 60)}`);
        }
      } else {
        console.log(`  [DEBUG] No /posts/ links found after filtering. Trying alternative: grab ALL /posts/ links regardless`);
        const allPostsLinks = await page.evaluate(() => {
          const result = [];
          const allLinks = document.querySelectorAll('a[href*="/posts/"]');
          for (const link of allLinks) {
            const href = link.getAttribute('href');
            if (href) result.push(href);
          }
          return result;
        });
        
        console.log(`  [DEBUG] All /posts/ links found: ${allPostsLinks.length}`);
        allPostsLinks.forEach((link, i) => console.log(`    ${i+1}. ${link.substring(0, 80)}`));
        
        const uniqueLinks = [...new Set(allPostsLinks)].slice(0, 5);
        for (const link of uniqueLinks) {
          posts.push({
            searchTerm: searchTerm,
            postUrl: link,
          });
          console.log(`  [DEBUG] ✓ Added link: ${link.substring(0, 60)}`);
        }
      }
      
      return posts;
    }
    
    console.log(`  [DEBUG] Found ${postContainers.length} post containers`);
    
    for (let i = 0; i < Math.min(postContainers.length, 5); i++) {
      try {
        await postContainers[i].scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        
        console.log(`  [DEBUG] Post ${i + 1}: Looking for three-dot menu button`);
        
        let menuButton = await postContainers[i].$('button[aria-label*="More"]');
        
        if (!menuButton) {
          menuButton = await postContainers[i].$('[role="button"][aria-label*="more"]');
        }
        
        if (!menuButton) {
          menuButton = await postContainers[i].$('[role="button"][aria-label*="More"]');
        }
        
        if (!menuButton) {
          const buttons = await postContainers[i].$$('button');
          for (const btn of buttons) {
            const ariaLabel = await btn.getAttribute('aria-label');
            if (ariaLabel && (ariaLabel.toLowerCase().includes('more') || ariaLabel.includes('…'))) {
              menuButton = btn;
              break;
            }
          }
        }
        
        if (!menuButton) {
          console.log(`  [DEBUG] Post ${i + 1}: No menu button found, skipping`);
          continue;
        }
        
        console.log(`  [DEBUG] Post ${i + 1}: Clicking three-dot menu`);
        await menuButton.click();
        await page.waitForTimeout(600);
        
        const menuItems = await page.$$('[role="menuitem"]');
        console.log(`  [DEBUG] Post ${i + 1}: Found ${menuItems.length} menu items`);
        
        let copyLinkItem = null;
        for (const item of menuItems) {
          const text = await item.evaluate(el => el.textContent.trim());
          console.log(`  [DEBUG] Post ${i + 1}: Menu item: "${text}"`);
          if (text.toLowerCase().includes('copy link')) {
            copyLinkItem = item;
            break;
          }
        }
        
        if (!copyLinkItem) {
          console.log(`  [DEBUG] Post ${i + 1}: "Copy link to post" not found, trying alternative selectors`);
          const allMenuItems = await page.$$('div[role="option"]');
          for (const item of allMenuItems) {
            const text = await item.evaluate(el => el.textContent.trim());
            if (text.toLowerCase().includes('copy link')) {
              copyLinkItem = item;
              break;
            }
          }
        }
        
        if (!copyLinkItem) {
          console.log(`  [DEBUG] Post ${i + 1}: "Copy link" option not found, closing menu`);
          await page.keyboard.press('Escape');
          continue;
        }
        
        console.log(`  [DEBUG] Post ${i + 1}: Clicking "Copy link to post"`);
        await copyLinkItem.click();
        await page.waitForTimeout(800);
        
        const clipboardText = await page.evaluate(() => {
          return navigator.clipboard.readText().catch(() => '');
        });
        
        if (clipboardText && clipboardText.includes('linkedin.com')) {
          console.log(`  [DEBUG] Post ${i + 1}: ✓ Copied link: ${clipboardText.substring(0, 60)}`);
          posts.push({
            searchTerm: searchTerm,
            postUrl: clipboardText,
          });
        } else {
          console.log(`  [DEBUG] Post ${i + 1}: Clipboard empty or invalid: "${clipboardText}"`);
        }
        
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        
      } catch (error) {
        console.log(`  [DEBUG] Post ${i + 1}: Error: ${error.message}`);
        try {
          await page.keyboard.press('Escape');
        } catch (e) {}
      }
    }
    
    console.log(`  [DEBUG] Collection complete: ${posts.length} posts collected`);
    
  } catch (error) {
    console.log(`  [DEBUG] Error during post collection: ${error.message}`);
  }
  
  return posts;
};

export { isPageValid, collectPostsFromPage };
