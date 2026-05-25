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

export { randomDelay, scrollDown, scrollUp };
