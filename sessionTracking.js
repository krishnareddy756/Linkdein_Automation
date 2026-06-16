import { google } from 'googleapis';
import fs from 'fs';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config({ override: false });

// Session Sheet Configuration
const SESSIONS_SHEET_ID = process.env.SESSIONS_SHEET_ID || 'YOUR_SESSION_SHEET_ID';
const SESSIONS_SHEET_NAME = process.env.SESSIONS_SHEET_NAME || 'Sheet1';
const CREDENTIALS_FILE = './credentials.json';

// Helper to format sheet name with quotes if needed
const formatSheetName = (name) => {
  return name.includes(' ') || name.includes('_') ? `'${name}'` : name;
};

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
    console.error('❌ Failed to initialize Google Sheets for session tracking:', error.message);
    throw error;
  }
};

// Generate unique session ID
const generateSessionId = () => {
  return `sess_${uuidv4().substring(0, 8)}`;
};

// Create a new session object
const createSession = () => {
  return {
    session_id: generateSessionId(),
    started_at: new Date().toISOString(),
    ended_at: null,
    total_keywords: 0,
    total_posts: 0,
    total_leads: 0,
    linkedin_account: process.env.LINKEDIN_EMAIL || 'N/A',
    proxy_used: 'N/A',
    status: 'running',
    detection_flag: false,
    errors: '',
  };
};

// Log session start to Google Sheets
const logSessionStart = async (session) => {
  try {
    const sheets = await initializeSheets();
    const range = `${formatSheetName(SESSIONS_SHEET_NAME)}!A:K`;
    
    const rowData = [
      [
        session.session_id,
        session.started_at,
        '',  // ended_at (empty at start)
        session.total_keywords,
        session.total_posts,
        session.total_leads,
        session.linkedin_account,
        session.proxy_used,
        session.status,
        session.detection_flag ? 'TRUE' : 'FALSE',
        session.errors,
      ]
    ];
    
    const request = {
      spreadsheetId: SESSIONS_SHEET_ID,
      range,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: rowData },
    };
    
    await sheets.spreadsheets.values.append(request);
    console.log(`✅ Session ${session.session_id} logged to Google Sheets`);
    return session;
  } catch (error) {
    console.error('❌ Error logging session start:', error.message);
    // Don't throw - allow automation to continue even if logging fails
    return session;
  }
};

// Update session with final data
const updateSessionEnd = async (session, results) => {
  try {
    const sheets = await initializeSheets();
    
    // Fetch all rows to find the session row
    const readRange = `${formatSheetName(SESSIONS_SHEET_NAME)}!A:K`;
    const readRequest = {
      spreadsheetId: SESSIONS_SHEET_ID,
      range: readRange,
    };
    
    const response = await sheets.spreadsheets.values.get(readRequest);
    const rows = response.data.values || [];
    
    // Find row index with matching session_id
    let sessionRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === session.session_id) {
        sessionRowIndex = i + 1; // Google Sheets uses 1-indexed rows
        break;
      }
    }
    
    if (sessionRowIndex === -1) {
      console.warn(`⚠️  Session ${session.session_id} not found in sheet`);
      return;
    }
    
    // Prepare updated row
    const detectionFlag = results.detection_flag || false;
    const errors = results.errors || session.errors;
    
    const updatedRow = [
      [
        session.session_id,
        session.started_at,
        new Date().toISOString(),  // ended_at
        results.total_keywords || session.total_keywords,
        results.total_posts || session.total_posts,
        results.total_leads || session.total_leads,
        session.linkedin_account,
        session.proxy_used,
        results.status || 'completed',
        detectionFlag ? 'TRUE' : 'FALSE',
        errors,
      ]
    ];
    
    // Update the row
    const updateRange = `${formatSheetName(SESSIONS_SHEET_NAME)}!A${sessionRowIndex}:K${sessionRowIndex}`;
    const updateRequest = {
      spreadsheetId: SESSIONS_SHEET_ID,
      range: updateRange,
      valueInputOption: 'RAW',
      resource: { values: updatedRow },
    };
    
    await sheets.spreadsheets.values.update(updateRequest);
    console.log(`✅ Session ${session.session_id} updated (status: ${results.status || 'completed'})`);
  } catch (error) {
    console.error('❌ Error updating session:', error.message);
    // Don't throw - allow process to complete
  }
};

// Check for detection signals
const checkDetectionSignals = (error, postsFound) => {
  if (!error && postsFound > 0) {
    return false; // No detection
  }
  
  if (error && error.includes('429')) {
    return true; // Rate limited
  }
  
  if (error && error.toLowerCase().includes('blocked')) {
    return true; // Blocked
  }
  
  if (postsFound === 0 && error && error.includes('iframe')) {
    return true; // Likely detection (can't access search iframe)
  }
  
  return false;
};

export { 
  createSession, 
  logSessionStart, 
  updateSessionEnd, 
  generateSessionId, 
  checkDetectionSignals 
};
