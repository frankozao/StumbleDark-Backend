# Asset Update System - Complete Integration Guide

## 📋 Overview

This document provides complete instructions for integrating the Asset Update System into your Stumble Guys backend and Unity client.

## 🎯 Features

✅ **Backend Version Control** - Manage asset versions dynamically  
✅ **Version Check API** - Detect if clients need updates  
✅ **Download Manifest API** - List all downloadable assets  
✅ **Asset Download** - Download individual assets with resume support  
✅ **Hash Verification** - Verify downloaded assets (SHA256 + CRC32)  
✅ **Retry & Resume** - Handle interrupted downloads  
✅ **Local Storage** - Track downloaded assets on device  
✅ **Admin Panel** - Update configuration without recompiling  
✅ **Comprehensive Logging** - Track all download activity  
✅ **Force Update** - Block gameplay until update completes  

---

## 🔧 Backend Setup

### Step 1: Files Created

The following files have been created in your backend:

```
Backend OG/
├── AssetController.js          # Main asset management controller
├── assetConfig.json            # Asset configuration file
├── test-download-assets.js     # Comprehensive test suite
├── UnityAssetDownloader.cs     # Unity client script
├── AssetUpdateUI.cs            # Unity UI controller
└── ASSET_UPDATE_INTEGRATION_GUIDE.md  # This file
```

### Step 2: Verify Backend Integration

The following changes were made to your existing files:

**index.js:**
- Imported `AssetController`
- Created `assetController` instance
- Added 9 new API endpoints

**BackendUtils.js:**
- Exported `AssetController`
- Login response already includes `DownloadAssetsVersion` field

### Step 3: Test Backend

1. Start your backend server:
```bash
node index.js
```

2. Run the test suite:
```bash
node test-download-assets.js
```

Expected output: All 10 tests should pass ✓

### Step 4: Verify API Endpoints

Your backend now has these endpoints:

#### Public Endpoints (No Auth Required)

```
GET  /api/assets/version          # Check if update is needed
GET  /api/assets/manifest         # Get full asset list
GET  /api/assets/download/:id     # Download specific asset
POST /api/assets/verify           # Verify downloaded asset
POST /api/assets/complete         # Mark download as complete
```

#### Admin Endpoints

```
POST /api/assets/admin/update-version  # Change asset version
GET  /api/assets/admin/config          # Get current config
POST /api/assets/admin/config          # Update entire config
GET  /api/assets/admin/logs            # View download logs
```

---

## 📱 Unity Client Integration

### Step 1: Add Scripts to Unity Project

1. Copy `UnityAssetDownloader.cs` to: `Assets/Scripts/AssetDownloader/`
2. Copy `AssetUpdateUI.cs` to: `Assets/Scripts/UI/`

### Step 2: Setup Scene

1. **Create Asset Downloader GameObject:**
   - Create empty GameObject: `AssetDownloadManager`
   - Add component: `UnityAssetDownloader`
   - Set `Backend URL` to your server address (e.g., `http://your-server.com`)

2. **Create UI Canvas:**
   - Create Canvas: `AssetUpdateCanvas`
   - Add component: `AssetUpdateUI`
   - Create child panels:
     - `UpdatePopupPanel` (contains title, message, buttons)
     - `ProgressPanel` (contains progress bar, status text)

3. **Link References:**
   - Drag `AssetDownloadManager` to `AssetUpdateUI.assetDownloader`
   - Assign UI elements to `AssetUpdateUI` properties

### Step 3: Modify Game Startup Flow

In your game's startup script (e.g., `MainMenuController.cs`):

```csharp
using UnityEngine;

public class GameStartup : MonoBehaviour
{
    private UnityAssetDownloader assetDownloader;
    private bool assetsReady = false;
    
    void Start()
    {
        assetDownloader = FindObjectOfType<UnityAssetDownloader>();
        
        // Subscribe to events
        assetDownloader.OnUpdateAvailable += OnUpdateDetected;
        assetDownloader.OnDownloadComplete += OnAssetsReady;
        
        // Check for updates on startup
        // The AssetDownloader already checks in Start(), 
        // but you can manually trigger it here if needed
    }
    
    void OnUpdateDetected(AssetVersionResponse updateInfo)
    {
        Debug.Log($"Update detected! Version: {updateInfo.currentVersion}");
        
        // The UI will automatically show the popup
        // Block gameplay if needed
        if (updateInfo.forceUpdate)
        {
            DisableMainMenu();
        }
    }
    
    void OnAssetsReady()
    {
        Debug.Log("Assets ready! Starting game...");
        assetsReady = true;
        
        // Enable gameplay
        EnableMainMenu();
        
        // Load downloaded assets
        LoadDownloadedAssets();
    }
    
    void LoadDownloadedAssets()
    {
        string assetPath = Application.persistentDataPath + "/DownloadedAssets";
        
        // Load your asset bundles
        // Example:
        // AssetBundle bundle = AssetBundle.LoadFromFile(assetPath + "/main.bundle");
        // GameObject prefab = bundle.LoadAsset<GameObject>("MyPrefab");
    }
    
    void DisableMainMenu()
    {
        // Disable buttons, show loading screen, etc.
    }
    
    void EnableMainMenu()
    {
        // Enable buttons, hide loading screen, etc.
    }
}
```

---

## ⚙️ Configuration

### Backend Configuration (`assetConfig.json`)

```json
{
  "currentVersion": 15,           // Increment this to trigger updates
  "forceUpdate": true,            // Block gameplay until download completes
  "downloadSize": 69620000,       // Total bytes (calculated automatically)
  "downloadSizeText": "69.62 MB", // Display text
  "popupTitle": "Update Available",
  "popupMessage": "New assets are available. Download now to continue.",
  "required": true,
  "minClientVersion": "0.56",
  "assets": [
    {
      "id": "unity-main-bundle",
      "name": "main.bundle",
      "type": "bundle",
      "platform": "android",
      "version": 15,
      "size": 45000000,
      "hash": "sha256-hash-here",
      "crc": "CRC32-here",
      "url": "/api/assets/download/unity-main-bundle",
      "priority": 1,
      "required": true
    }
    // Add more assets...
  ]
}
```

### How to Update Asset Version

**Option 1: Edit JSON file directly**
```bash
# Edit assetConfig.json
# Change "currentVersion": 15 to "currentVersion": 16
# Restart backend (or backend will auto-reload if implemented)
```

**Option 2: Use Admin API**
```bash
curl -X POST http://localhost:3000/api/assets/admin/update-version \
  -H "Content-Type: application/json" \
  -d '{
    "version": 16,
    "forceUpdate": true,
    "message": "Critical update available!",
    "title": "Update Required"
  }'
```

**Option 3: Create Admin Panel**

Create a simple web page to manage updates:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Asset Admin Panel</title>
</head>
<body>
    <h1>Asset Update Manager</h1>
    
    <label>Asset Version:</label>
    <input type="number" id="version" value="15">
    
    <label>Force Update:</label>
    <input type="checkbox" id="forceUpdate" checked>
    
    <label>Message:</label>
    <textarea id="message">New assets available!</textarea>
    
    <button onclick="updateVersion()">Update Version</button>
    
    <script>
        function updateVersion() {
            const data = {
                version: parseInt(document.getElementById('version').value),
                forceUpdate: document.getElementById('forceUpdate').checked,
                message: document.getElementById('message').value
            };
            
            fetch('http://localhost:3000/api/assets/admin/update-version', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            .then(res => res.json())
            .then(data => alert('Updated: ' + JSON.stringify(data)))
            .catch(err => alert('Error: ' + err));
        }
    </script>
</body>
</html>
```

---

## 🧪 Testing

### Test Scenario 1: New User (No Assets Downloaded)

1. Clear Unity's `Application.persistentDataPath`
2. Start the game
3. Expected: Download popup appears immediately
4. Click "Download"
5. Expected: Progress bar shows download progress
6. Expected: Game continues after download completes

### Test Scenario 2: Existing User (Assets Up-to-date)

1. Start game with `localAssetVersion = 15`
2. Backend has `currentVersion = 15`
3. Expected: No popup, game starts normally

### Test Scenario 3: Force Update

1. Backend: Set `currentVersion = 16`, `forceUpdate = true`
2. Start game with `localAssetVersion = 15`
3. Expected: Popup shows, "Cancel" button hidden
4. Expected: Main menu disabled until download completes

### Test Scenario 4: Optional Update

1. Backend: Set `forceUpdate = false`
2. User clicks "Cancel"
3. Expected: Popup closes, game continues

### Test Scenario 5: Download Failure

1. Stop backend server mid-download
2. Expected: Error message shows
3. Expected: "Retry" button appears

---

## 📊 Monitoring & Logs

### View Download Logs

```bash
curl http://localhost:3000/api/assets/admin/logs?limit=50
```

Response:
```json
{
  "total": 127,
  "logs": [
    {
      "type": "VERSION_CHECK",
      "clientVersion": 15,
      "serverVersion": 16,
      "needsUpdate": true,
      "platform": "android",
      "timestamp": "2024-01-15T10:30:00Z"
    },
    {
      "type": "ASSET_DOWNLOAD",
      "assetId": "unity-main-bundle",
      "assetName": "main.bundle",
      "size": 45000000,
      "timestamp": "2024-01-15T10:31:00Z"
    },
    {
      "type": "DOWNLOAD_COMPLETE",
      "version": 16,
      "platform": "android",
      "assetsCount": 4,
      "timestamp": "2024-01-15T10:35:00Z"
    }
  ]
}
```

### Log Types

- `VERSION_CHECK` - Client checked for updates
- `MANIFEST_REQUEST` - Client requested asset list
- `ASSET_DOWNLOAD` - Client downloaded an asset
- `ASSET_VERIFICATION` - Client verified an asset
- `DOWNLOAD_COMPLETE` - Client completed full download

---

## 🔐 Security Considerations

### Production Recommendations

1. **Add Authentication to Admin Endpoints:**

```javascript
// In index.js, add middleware
function adminAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Apply to admin routes
app.post('/api/assets/admin/update-version', adminAuth, (req, res) => ...);
```

2. **Use HTTPS in Production:**

```csharp
// In Unity
public string backendUrl = "https://your-server.com";  // Use HTTPS
```

3. **Add Rate Limiting:**

```javascript
const rateLimit = require('express-rate-limit');

const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.get('/api/assets/download/:assetId', downloadLimiter, (req, res) => ...);
```

4. **Validate File Hashes:**

Always verify downloaded files on the client using SHA256 hashes.

---

## 🚀 Deployment Checklist

- [ ] Backend server running and accessible
- [ ] `assetConfig.json` configured correctly
- [ ] Unity scripts added to project
- [ ] UI setup in Unity scene
- [ ] Test all scenarios (new user, update, force update, etc.)
- [ ] Verify hash validation works
- [ ] Test on actual mobile devices
- [ ] Setup CDN for asset hosting (optional)
- [ ] Add admin authentication
- [ ] Configure HTTPS
- [ ] Monitor logs for errors

---

## 📞 Troubleshooting

### Issue: "Download Assets" popup doesn't appear

**Solution:**
1. Check console logs in Unity
2. Verify `backendUrl` is correct
3. Ensure backend is running
4. Check network connectivity
5. Verify `localAssetVersion < currentVersion`

### Issue: Downloads fail immediately

**Solution:**
1. Check backend logs for errors
2. Verify asset URLs are correct
3. Ensure asset files exist on server
4. Check network firewall settings

### Issue: Hash verification fails

**Solution:**
1. Recalculate hash for asset file
2. Update hash in `assetConfig.json`
3. Clear corrupted downloads on client
4. Retry download

### Issue: Backend doesn't update version

**Solution:**
1. Check file permissions on `assetConfig.json`
2. Verify JSON syntax is valid
3. Check backend logs for errors
4. Restart backend after manual JSON edits

---

## 📚 API Reference

### GET /api/assets/version

Check if client needs to download assets.

**Query Parameters:**
- `version` (number) - Client's current asset version
- `platform` (string) - Platform: `android`, `ios`, `windows`

**Response:**
```json
{
  "currentVersion": 15,
  "clientVersion": 0,
  "needsUpdate": true,
  "forceUpdate": true,
  "downloadSize": 69620000,
  "downloadSizeText": "69.62 MB",
  "message": "New assets available",
  "title": "Update Available",
  "required": true,
  "updateNotes": ["Feature 1", "Feature 2"]
}
```

### GET /api/assets/manifest

Get list of all downloadable assets.

**Query Parameters:**
- `version` (number) - Client's current asset version
- `platform` (string) - Platform filter

**Response:**
```json
{
  "version": 15,
  "platform": "android",
  "totalAssets": 4,
  "requiredAssets": 3,
  "totalSize": 69620000,
  "assets": [
    {
      "id": "unity-main-bundle",
      "name": "main.bundle",
      "type": "bundle",
      "version": 15,
      "size": 45000000,
      "sizeText": "42.91 MB",
      "hash": "sha256-hash",
      "crc": "CRC32",
      "url": "http://server/api/assets/download/unity-main-bundle",
      "downloadUrl": "http://server/api/assets/download/unity-main-bundle",
      "priority": 1,
      "required": true,
      "needsDownload": true
    }
  ]
}
```

### GET /api/assets/download/:assetId

Download a specific asset.

**Headers:**
- `Range: bytes=0-1000` (optional) - For resume support

**Response:**
- Binary file stream with headers:
  - `Content-Type: application/octet-stream`
  - `Content-Disposition: attachment; filename="..."`
  - `X-Asset-Version: 15`
  - `X-Asset-Hash: sha256-hash`
  - `X-Asset-CRC: CRC32`
  - `Accept-Ranges: bytes`

### POST /api/assets/verify

Verify downloaded asset integrity.

**Request Body:**
```json
{
  "assetId": "unity-main-bundle",
  "hash": "sha256-hash",
  "crc": "CRC32"
}
```

**Response:**
```json
{
  "valid": true,
  "assetId": "unity-main-bundle",
  "hashValid": true,
  "crcValid": true,
  "expectedHash": "sha256-hash",
  "expectedCrc": "CRC32"
}
```

### POST /api/assets/complete

Mark download as complete (for logging).

**Request Body:**
```json
{
  "version": 15,
  "platform": "android",
  "assets": ["asset-id-1", "asset-id-2"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Download completed successfully",
  "version": 15
}
```

---

## 🎓 Best Practices

1. **Always increment version** when adding new assets
2. **Test on real devices** before pushing to production
3. **Use CDN** for large asset files
4. **Monitor download logs** to track success rate
5. **Keep backups** of old asset versions
6. **Verify hashes** on both client and server
7. **Handle network errors** gracefully
8. **Show clear progress** to users
9. **Allow resume** for interrupted downloads
10. **Cache manifests** to reduce server load

---

## 📝 License

This Asset Update System is provided as-is for your Stumble Guys backend project.

---

## 💬 Support

For issues or questions:
1. Check logs: `/api/assets/admin/logs`
2. Test endpoints: Run `node test-download-assets.js`
3. Review Unity console for client-side errors
4. Verify backend configuration in `assetConfig.json`

---

**Last Updated:** January 2025  
**Version:** 1.0.0
