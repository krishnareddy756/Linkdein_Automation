import { google } from 'googleapis';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ override: false });

// Google Sheets configuration - TWO SEPARATE SHEETS
const KEYWORDS_SHEET_ID = process.env.KEYWORDS_SHEET_ID || '1nd2WdchB7Rqw5CblrlV1DpUN99HYR2dznpY7gXYU1q8';
const KEYWORDS_SHEET_NAME = process.env.KEYWORDS_SHEET_NAME || 'Keywords';
// Add quotes around sheet name if it contains spaces or special characters
const KEYWORDS_RANGE = KEYWORDS_SHEET_NAME.includes(' ') || KEYWORDS_SHEET_NAME.includes('_') 
  ? `'${KEYWORDS_SHEET_NAME}'!A2:A` 
  : `${KEYWORDS_SHEET_NAME}!A2:A`;

const POSTS_SHEET_ID = process.env.POSTS_SHEET_ID || '1vdzQgeX-EG7qH7_yIdtPRTh2eOPJCRW9IpkZ8BRH-_I';
const POSTS_SHEET_NAME = process.env.POSTS_SHEET_NAME || 'Linkdein_posts';
// Add quotes around sheet name if it contains spaces or special characters
const RESULTS_RANGE = POSTS_SHEET_NAME.includes(' ') || POSTS_SHEET_NAME.includes('_')
  ? `'${POSTS_SHEET_NAME}'!A1`
  : `${POSTS_SHEET_NAME}!A1`;

const CREDENTIALS_FILE = './credentials.json';

// Initialize Google Sheets API
const initializeSheets = async () => {
  try {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf-8'));
    
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    const sheets = google.sheets({ version: 'v4', auth });
    return sheets;
  } catch (error) {
    console.error('❌ Failed to initialize Google Sheets:', error.message);
    throw error;
  }
};

// Append data to Google Sheets
const appendToSheets = async (data) => {
  try {
    const sheets = await initializeSheets();
    
    console.log('📤 Uploading data to Google Sheets...');
    
    const request = {
      spreadsheetId: POSTS_SHEET_ID,
      range: RESULTS_RANGE,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: data,
      },
    };
    
    const response = await sheets.spreadsheets.values.append(request);
    console.log(`✅ Successfully added ${data.length} rows to Google Sheets`);
    console.log(`   Updated cells: ${response.data.updates.updatedCells}`);
    
    return response.data;
  } catch (error) {
    console.error('❌ Error appending to Google Sheets:', error.message);
    throw error;
  }
};

// Get search keywords from Keywords sheet
const getSearchKeywords = async () => {
  try {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf-8'));
    
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    console.log('📋 Fetching keywords from Google Sheets...');
    
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: KEYWORDS_SHEET_ID,
      range: KEYWORDS_RANGE, // Skip header, read all keywords from Keywords sheet column A starting row 2
    });
    
    const keywords = result.data.values?.map(row => row[0]).filter(k => k && k.trim()) || [];
    
    if (keywords.length === 0) {
      console.warn('⚠️  No keywords found in Keywords sheet');
      return [];
    }
    
    console.log(`✅ Found ${keywords.length} keyword(s) to search:`);
    keywords.forEach((kw, idx) => console.log(`   ${idx + 1}. ${kw}`));
    
    return keywords;
  } catch (error) {
    console.error('❌ Error fetching keywords from Google Sheets:', error.message);
    throw error;
  }
};

// Get existing posts from the Posts sheet to check for duplicates
const getExistingPosts = async () => {
  try {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf-8'));
    
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Fetch all data from posts sheet (column B contains URLs)
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: POSTS_SHEET_ID,
      range: POSTS_SHEET_NAME.includes(' ') || POSTS_SHEET_NAME.includes('_') 
        ? `'${POSTS_SHEET_NAME}'!B:B` 
        : `${POSTS_SHEET_NAME}!B:B`,
    });
    
    // Extract URLs, skip header, and filter empty rows
    const existingUrls = result.data.values?.slice(1).map(row => row[0]).filter(url => url) || [];
    
    return existingUrls;
  } catch (error) {
    console.warn('⚠️  Could not fetch existing posts (sheet may be empty):', error.message);
    return [];
  }
};

// Filter out duplicate posts based on URL
const removeDuplicates = async (newPosts) => {
  try {
    console.log('🔍 Checking for duplicate posts...');
    const existingUrls = await getExistingPosts();
    
    if (existingUrls.length === 0) {
      console.log('   📝 No existing posts found - all new posts are unique');
      return newPosts;
    }
    
    // Filter posts that are NOT in existing URLs
    const uniquePosts = newPosts.filter(post => !existingUrls.includes(post.postUrl));
    
    const duplicateCount = newPosts.length - uniquePosts.length;
    if (duplicateCount > 0) {
      console.log(`   ⚠️  Found ${duplicateCount} duplicate(s) - skipping them`);
    }
    console.log(`   ✅ ${uniquePosts.length} unique post(s) ready to upload`);
    
    return uniquePosts;
  } catch (error) {
    console.warn('⚠️  Duplicate check failed, proceeding with all posts:', error.message);
    return newPosts;
  }
};

// Format and prepare data for sheets
const prepareDataForSheets = (posts) => {
  return posts.map(post => [
    post.searchTerm,
    post.postUrl,
    new Date().toLocaleString(),
  ]);
};

export { initializeSheets, appendToSheets, prepareDataForSheets, getSearchKeywords, removeDuplicates };
