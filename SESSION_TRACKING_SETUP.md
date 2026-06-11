# Session Tracking Setup Guide

## ✅ What Has Been Done

### 1. **New Google Sheet Created**
- **Name**: LinkedIn-Automation-Sessions
- **Sheet ID**: `11DG9qhg-h05ZIb6-rbyWkCO8y-mS24rFcAsKeS0HFgs`
- **URL**: https://docs.google.com/spreadsheets/d/11DG9qhg-h05ZIb6-rbyWkCO8y-mS24rFcAsKeS0HFgs/

### 2. **Sheet Structure (Auto-Created on First Run)**
| Column | Header | Type | Notes |
|--------|--------|------|-------|
| A | session_id | Text | Auto-generated UUID (sess_xxxx) |
| B | started_at | Timestamp | Session start time |
| C | ended_at | Timestamp | Session completion time |
| D | total_keywords | Number | Keywords processed |
| E | total_posts | Number | Posts collected |
| F | total_leads | Number | Qualified leads (0 initially, update manually) |
| G | linkedin_account | Text | Email used for scraping |
| H | proxy_used | Text | Always "N/A" for now |
| I | status | Text | running → completed / failed / detection_suspected |
| J | detection_flag | Boolean | TRUE if LinkedIn bot detection suspected |
| K | errors | Text | Error message/details |

### 3. **Code Changes Made**

#### **New File: sessionTracking.js**
- `createSession()` - Creates session object with UUID
- `logSessionStart()` - Writes initial session to sheet
- `updateSessionEnd()` - Updates sheet row with final results
- `generateSessionId()` - Creates unique session ID
- `checkDetectionSignals()` - Auto-flags detection patterns

#### **Updated: package.json**
- Added `uuid` dependency (v9.0.0)

#### **Updated: .env**
- Added `SESSIONS_SHEET_ID=11DG9qhg-h05ZIb6-rbyWkCO8y-mS24rFcAsKeS0HFgs`
- Added `SESSIONS_SHEET_NAME=Sheet1`

#### **Updated: index.js**
- Imports session tracking functions
- Creates session at startup with unique ID
- Logs session start to sheet
- Tracks total keywords/posts during execution
- Updates session with final status/errors
- Auto-detects LinkedIn bot detection signals

---

## 🚀 Next Steps to Run

### Step 1: Install New Dependency
```bash
npm install
```
This will install the `uuid` package.

### Step 2: Verify Google Sheets Access

**Your service account has access:**
```
linkedin-automation@linkedin-automation-496703.iam.gserviceaccount.com
```

**Verify sheet is shared:**
1. Go to: https://docs.google.com/spreadsheets/d/11DG9qhg-h05ZIb6-rbyWkCO8y-mS24rFcAsKeS0HFgs/
2. Click **Share** button
3. Confirm service account email has **Editor** access

### Step 3: Run the Automation
```bash
npm start
```

**Expected console output:**
```
Starting LinkedIn Playwright Automation...

📊 Session ID: sess_a1b2c3d4

Checking for saved session...
[...]
📋 Found 2 keyword(s) to process

🔍 Searching for keyword 1/2: #cto
[...]
✅ Successfully clicked "Posts" filter
[...]
✅ Successfully collected 10 posts

📊 Session sess_a1b2c3d4 logged to Google Sheets
📊 Session sess_a1b2c3d4 updated (status: completed)
📊 Session sess_a1b2c3d4 finalized in Google Sheets
```

### Step 4: Check Your Google Sheet
After running, open: https://docs.google.com/spreadsheets/d/11DG9qhg-h05ZIb6-rbyWkCO8y-mS24rFcAsKeS0HFgs/

You'll see a new row with:
- ✅ session_id: `sess_xxxx`
- ✅ started_at: `2026-06-09T10:30:45.123Z`
- ✅ ended_at: `2026-06-09T10:35:12.456Z`
- ✅ total_keywords: `2`
- ✅ total_posts: `15`
- ✅ status: `completed`
- ✅ detection_flag: `FALSE`

---

## 📊 Auto-Detection Signals

The system **automatically detects** LinkedIn bot detection on these signals:

| Signal | Triggers When |
|--------|---|
| **429 Error** | Rate limited by LinkedIn |
| **"blocked" Error** | Account temporarily blocked |
| **Iframe Access Fail** | Can't access search iframe (likely detected) |
| **0 Posts Found + Error** | Search failed to return results |

When detected:
- `detection_flag` → **TRUE**
- `status` → **detection_suspected**
- Automation stops further searches (graceful exit)

---

## 🔄 Session Lifecycle

### **Status Values**
- `running` - Session in progress
- `completed` - Successfully finished
- `failed` - Error occurred
- `detection_suspected` - Bot detection likely

### **Example Flow:**

**Successful Run:**
```
Session Created → Status: running
↓
Search Keywords → Track total_keywords
↓
Collect Posts → Track total_posts
↓
Complete → Status: completed
↓
Update Sheet ✅
```

**With Detection:**
```
Session Created → Status: running
↓
Search Keyword 1 ✅
↓
Search Keyword 2 → 429 Error!
↓
detection_flag = TRUE
Status = detection_suspected
Stop further searches
↓
Update Sheet (with error message) ✅
```

---

## 📋 Manual Updates Required (Post-Run)

After each run, you should update the `total_leads` column **manually** in Google Sheets:

1. Open: https://docs.google.com/spreadsheets/d/11DG9qhg-h05ZIb6-rbyWkCO8y-mS24rFcAsKeS0HFgs/
2. Find the row with your session ID
3. In column **F (total_leads)**, enter the number of qualified leads
4. Save

**Why manual?**
- Your lead qualification logic is custom
- You'll review posts in the separate "Linkdein_posts" sheet
- You decide which posts are qualified leads

---

## 🔍 Monitoring & Troubleshooting

### Check Session Sheet for Errors
```
Column K (errors) shows:
- "Failed to fetch keywords: Network error"
- "Detection signal at keyword: #cto"
- "429 Too Many Requests"
- etc.
```

### Common Issues

**Q: Sheet isn't updating?**
- A: Check service account has Editor access
- Verify `SESSIONS_SHEET_ID` in .env is correct

**Q: Detection flag always FALSE?**
- A: That's good! Means no bot detection signals
- If LinkedIn blocks you, it will auto-flag

**Q: Session ID not generating?**
- A: Run `npm install` to ensure `uuid` package installed

**Q: Multiple rows created per run?**
- A: Each run creates a new session (expected)
- You can filter/archive old sessions

---

## 📈 PostgreSQL Migration (Future)

When you're ready to migrate to PostgreSQL:

1. Create `scraping_sessions` table with same columns
2. Update `sessionTracking.js` to write to PostgreSQL instead of Sheets
3. Keep Google Sheets as backup during transition
4. Example migration query:

```sql
CREATE TABLE scraping_sessions (
  session_id UUID PRIMARY KEY,
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  total_keywords INT DEFAULT 0,
  total_posts INT DEFAULT 0,
  total_leads INT DEFAULT 0,
  linkedin_account TEXT,
  proxy_used TEXT DEFAULT 'N/A',
  status TEXT DEFAULT 'running',
  detection_flag BOOLEAN DEFAULT FALSE,
  errors TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## ✨ System Health Tracking Summary

Your system now tracks:

✅ **Session Lifecycle** - Start to end times  
✅ **Execution Metrics** - Keywords, posts, leads  
✅ **Account Health** - Detection flags, errors  
✅ **Process Status** - Running, completed, failed states  
✅ **Performance** - How many posts/keywords per session  

This is your foundation for **end-to-end system monitoring** before upgrading to PostgreSQL!

---

## 🎯 Next: Ready to Run!

```bash
# Install dependencies
npm install

# Run the automation
npm start

# Check Google Sheet for results
# https://docs.google.com/spreadsheets/d/11DG9qhg-h05ZIb6-rbyWkCO8y-mS24rFcAsKeS0HFgs/
```

Happy automating! 🚀
