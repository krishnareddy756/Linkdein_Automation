import fs from 'fs';
import path from 'path';

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

export { ensureSessionDir, getSessionPath, isSessionValid, saveSession, loadSession };
