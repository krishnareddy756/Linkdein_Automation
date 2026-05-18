import { google } from 'googleapis';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Google Sheets configuration
const SHEET_ID = process.env.SHEET_ID || '1vdzQgeX-EG7qH7_yIdtPRTh2eOPJCRW9IpkZ8BRH-_I';
const RANGE = 'Sheet1!A:C';
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
      spreadsheetId: SHEET_ID,
      range: RANGE,
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

// Format and prepare data for sheets
const prepareDataForSheets = (posts) => {
  return posts.map(post => [
    post.searchTerm,
    post.postUrl,
    new Date().toLocaleString(),
  ]);
};

export { initializeSheets, appendToSheets, prepareDataForSheets };
