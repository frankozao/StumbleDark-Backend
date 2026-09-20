# 🚀 Asset Update System - Quick Start

## ⚡ 5-Minute Setup

### Step 1: Test the Backend (1 minute)

```bash
# Start your backend server
node index.js

# In another terminal, run tests
node test-download-assets.js
```

✅ You should see all 10 tests pass!

### Step 2: Change Asset Version (30 seconds)

**Method 1: Using curl**
```bash
curl -X POST http://localhost:3000/api/assets/admin/update-version \
  -H "Content-Type: application/json" \
  -d '{"version": 20, "forceUpdate": true}'
```

**Method 2: Edit file directly**
Open `assetConfig.json` and change:
```json
"currentVersion": 15  →  "currentVersion": 20
```

### Step 3: Verify Update Works (30 seconds)

```bash
# Check if update is detected
curl "http://localhost:3000/api/assets/version?version=15&platform=android"
```

Expected response:
```json
{
  "needsUpdate": true,
  "downloadSizeText": "69.62 MB"
}
```

### Step 4: Add to Unity (2 minutes)

1. Copy `UnityAssetDownloader.cs` to your Unity project
2. Copy `AssetUpdateUI.cs` to your Unity project
3. Create empty GameObject → Add `UnityAssetDownloader` component
4. Set `Backend URL` to your server address
5. Run the game!

---

## 🎮 How It Works

**When player starts the game:**

1. Unity calls: `GET /api/assets/version?version=15`
2. Backend responds: `{ needsUpdate: true }`
3. Unity shows popup: "Download Assets (69.62 MB)"
4. Player clicks "Download"
5. Unity downloads assets from: `GET /api/assets/download/:id`
6. Unity verifies with: `POST /api/assets/verify`
7. Unity saves version locally
8. Game continues!

---

## 📱 Client Flow Diagram

```
Game Startup
    ↓
Check Version (/api/assets/version)
    ↓
Needs Update? 
    ↓ YES
Show Popup
    ↓
User Clicks "Download"
    ↓
Get Manifest (/api/assets/manifest)
    ↓
Download Assets (/api/assets/download/:id)
    ↓
Verify Hashes
    ↓
Save Version Locally
    ↓
Continue Game
```

---

## 🔧 Common Tasks

### How to push a new asset update?

1. **Upload new asset files to server**
2. **Update `assetConfig.json`:**
   ```json
   {
     "currentVersion": 16,  // Increment this
     "assets": [
       {
         "id": "new-asset",
         "name": "newLevel.bundle",
         "size": 5000000,
         "hash": "calculate-with-sha256",
         "url": "/api/assets/download/new-asset"
       }
     ]
   }
   ```
3. **Done!** All clients will detect update on next launch

### How to make update mandatory?

In `assetConfig.json`:
```json
{
  "forceUpdate": true,    // User cannot skip
  "required": true        // Blocks gameplay
}
```

### How to make update optional?

```json
{
  "forceUpdate": false,   // User can skip
  "required": false       // Allows gameplay
}
```

### How to view download statistics?

```bash
curl http://localhost:3000/api/assets/admin/logs?limit=100
```

---

## 🎯 API Endpoints Cheat Sheet

| Endpoint | Purpose | Auth |
|----------|---------|------|
| `GET /api/assets/version` | Check for updates | No |
| `GET /api/assets/manifest` | Get asset list | No |
| `GET /api/assets/download/:id` | Download asset | No |
| `POST /api/assets/verify` | Verify download | No |
| `POST /api/assets/complete` | Log completion | No |
| `POST /api/assets/admin/update-version` | Change version | Yes* |
| `GET /api/assets/admin/config` | View config | Yes* |
| `GET /api/assets/admin/logs` | View logs | Yes* |

*Should add authentication in production

---

## 🐛 Troubleshooting

**Problem:** Tests fail with connection error  
**Solution:** Make sure backend is running on port 3000

**Problem:** Unity can't connect to backend  
**Solution:** Check `backendUrl` in UnityAssetDownloader (use IP, not localhost)

**Problem:** Download popup doesn't show  
**Solution:** Verify `localAssetVersion < currentVersion`

**Problem:** Hash verification fails  
**Solution:** Recalculate hash and update `assetConfig.json`

---

## 📝 Example: Releasing Update v16

**Day 1: Development**
- Create new game levels
- Export Unity asset bundles
- Calculate SHA256 hashes

**Day 2: Backend Setup**
```bash
# Edit assetConfig.json
{
  "currentVersion": 16,
  "assets": [
    {
      "id": "levels-v16",
      "name": "levels.bundle",
      "size": 8000000,
      "hash": "YOUR_SHA256_HASH_HERE"
    }
  ]
}

# Restart backend
node index.js
```

**Day 3: Testing**
```bash
# Test update detection
node test-download-assets.js

# Test on Android device
# Launch game → Popup should appear
```

**Day 4: Release**
- Monitor logs: `curl .../api/assets/admin/logs`
- Check download success rate
- Fix any issues

---

## 🎉 Success!

Your Asset Update System is now working!

Players will automatically receive new content when you:
1. Increment `currentVersion`
2. Add assets to `assetConfig.json`
3. Upload asset files

No APK rebuild needed! 🚀

---

**Need more details?** Read `ASSET_UPDATE_INTEGRATION_GUIDE.md`

**Questions?** Check the logs: `/api/assets/admin/logs`
