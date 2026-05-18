# LinkedIn Automation - Complete Setup Guide

## ✅ Setup Checklist

### Step 1: Install Dependencies
```bash
npm install
```

This installs:
- **playwright** - Browser automation
- **dotenv** - Environment variables
- **googleapis** - Google Sheets API client

### Step 2: Verify Files

Ensure these files exist in your project:
- ✅ `index.js` - Main automation script
- ✅ `sheetsService.js` - Google Sheets integration
- ✅ `credentials.json` - Service account credentials
- ✅ `.env` - Configuration file
- ✅ `package.json` - Dependencies

### Step 3: Configuration

Your `.env` file should have:
```bash
LINKEDIN_EMAIL=your_email@example.com
LINKEDIN_PASSWORD=your_password
HEADLESS=false
SLOW_MO=500
SESSION_DIR=./sessions
SESSION_EXPIRY_HOURS=24
SHEET_ID=1vdzQgeX-EG7qH7_yIdtPRTh2eOPJCRW9IpkZ8BRH-_I
```

### Step 4: Google Sheets Access

Your sheet (`1vdzQgeX-EG7qH7_yIdtPRTh2eOPJCRW9IpkZ8BRH-_I`) has:
- ✅ Service account `linkedin-automation@linkedin-automation-496703.iam.gserviceaccount.com` with Editor access
- ✅ Columns: Search Term | Post URL | Date

---

## 🚀 How to Run

### First Time:
```bash
npm start
```

The script will:
1. Open browser (non-headless)
2. Navigate to LinkedIn login page
3. Enter credentials from `.env`
4. Log in
5. Scroll feed (3-5 times down, 3-5 times up)
6. **Search for #cto** → Collect 0-5 post URLs
7. **Search for #hiring** → Collect 0-5 post URLs
8. Upload all collected posts to Google Sheets
9. Close browser
10. Save session for next run

### Subsequent Runs (within 24 hours):
```bash
npm start
```

The script will:
1. Open browser
2. Load saved session (skip login!)
3. Verify session is valid
4. Continue with searches and data collection
5. Much faster since login is skipped!

### After 24 Hours:
Session expires → Script automatically performs fresh login → Saves new session

---

## 📊 Data Collection Process

### What Gets Collected:
1. **Search Term** - Which hashtag was searched (#cto or #hiring)
2. **Post URL** - Direct link to the LinkedIn post
3. **Date** - Timestamp when collected

### How Posts Are Selected:
- All posts found during search scrolling are initially collected
- Duplicates are removed
- Random 0-5 posts are selected per search
- Total: 0-10 posts per run (0-5 from #cto + 0-5 from #hiring)

### Upload Process:
```
1. Search #cto → Find posts → Collect URLs
2. Search #hiring → Find posts → Collect URLs
3. Deduplicate all collected posts
4. Upload to Google Sheets via API
5. Rows added to sheet automatically
```

---

## 🔐 Session Management

### How Session Persistence Works:

**First Run:**
```
Login → Save Cookies to ./sessions/linkedin_session.json → Use for future runs
```

**Second Run (within 24 hours):**
```
Load Cookies from ./sessions/linkedin_session.json → Skip login → Start searching
```

**After 24 Hours:**
```
Session Expired → Force Fresh Login → Save New Cookies → Continue
```

### Session Storage:
- Location: `./sessions/linkedin_session.json`
- Contains: Cookies + LocalStorage + SessionStorage
- Excluded from git: Added to `.gitignore`

---

## 🐛 Troubleshooting

### Issue: "Credentials file not found"
**Solution:** Ensure `credentials.json` is in your project root

### Issue: "Sheet ID not found"
**Solution:** Check `.env` file has correct SHEET_ID

### Issue: "Login failed"
**Solution:** 
- Verify credentials in `.env`
- LinkedIn may require 2FA - check account security
- Session might be invalid, delete `./sessions/linkedin_session.json` to force fresh login

### Issue: "No posts collected"
**Solution:**
- LinkedIn layout may have changed
- Check browser console for errors
- Try running script multiple times

### Issue: "Cannot upload to Google Sheets"
**Solution:**
- Verify service account email has Editor access to sheet
- Check internet connection
- Ensure credentials.json is valid

---

## 🔄 Running Automation Regularly

### Via Task Scheduler (Windows):

1. Open Task Scheduler
2. Create Basic Task → Name it "LinkedIn Automation"
3. Trigger: Daily at specific time
4. Action: Start a program
5. Program: `C:\Program Files\nodejs\node.exe`
6. Arguments: `index.js`
7. Start in: `C:\Users\saikr\OneDrive\Desktop\linkdein_automation`

### Via Cron (Mac/Linux):
```bash
0 9 * * * cd ~/Desktop/linkdein_automation && npm start
```

---

## 📝 File Structure

```
linkdein_automation/
├── index.js                 # Main automation script
├── sheetsService.js         # Google Sheets integration
├── package.json             # Dependencies
├── credentials.json         # Service account credentials (KEEP SECRET!)
├── .env                     # Configuration (KEEP SECRET!)
├── .gitignore              # Excluded files
├── README.md               # Quick start guide
├── SETUP_GUIDE.md          # This file
└── sessions/               # Session storage (auto-created)
    └── linkedin_session.json # Saved session
```

---

## 🎯 Best Practices

1. **Credentials Security**
   - Never commit `.env` or `credentials.json` to git
   - Use strong, unique passwords
   - Rotate credentials periodically

2. **Rate Limiting**
   - Don't run more than 2-3 times per hour
   - LinkedIn will detect bot behavior
   - Use session persistence to minimize login frequency

3. **Error Handling**
   - Script handles most errors gracefully
   - Check console output for issues
   - Logs are printed with clear emoji indicators

4. **Data Quality**
   - Only collects visible post URLs
   - Random selection prevents bias
   - Duplicates are automatically removed

5. **Resource Management**
   - Browser closes after each run
   - Sessions expire after 24 hours
   - Delete old session files if needed

---

## 🚀 Next Steps

1. Run the script: `npm start`
2. Monitor browser behavior
3. Check Google Sheets for collected data
4. Adjust configuration if needed
5. Schedule for regular automation

Happy automating! 🎉
