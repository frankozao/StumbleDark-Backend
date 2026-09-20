using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

// Unity Client-Side Asset Update Manager
// Place this script in your Unity project: Assets/Scripts/AssetDownloader/

[System.Serializable]
public class AssetVersionResponse
{
    public int currentVersion;
    public int clientVersion;
    public bool needsUpdate;
    public bool forceUpdate;
    public int assetVersion;
    public long downloadSize;
    public string downloadSizeText;
    public string message;
    public string title;
    public bool required;
    public bool updateAvailable;
    public int manifestVersion;
    public string[] updateNotes;
    public string minClientVersion;
}

[System.Serializable]
public class AssetInfo
{
    public string id;
    public string name;
    public string type;
    public int version;
    public long size;
    public string sizeText;
    public string hash;
    public string crc;
    public string url;
    public string downloadUrl;
    public int priority;
    public bool required;
    public bool needsDownload;
}

[System.Serializable]
public class AssetManifest
{
    public int version;
    public int manifestVersion;
    public string platform;
    public string timestamp;
    public int totalAssets;
    public int requiredAssets;
    public long totalSize;
    public AssetInfo[] assets;
    public string[] cdnUrls;
    public string[] updateNotes;
}

[System.Serializable]
public class LocalAssetData
{
    public int currentVersion;
    public List<string> downloadedAssets = new List<string>();
    public Dictionary<string, string> assetHashes = new Dictionary<string, string>();
}

public class UnityAssetDownloader : MonoBehaviour
{
    // Backend Configuration
    [Header("Backend Settings")]
    public string backendUrl = "http://localhost:3000";
    
    [Header("Local Storage")]
    public string assetStoragePath;
    private string localDataPath;
    
    [Header("Current State")]
    public int localAssetVersion = 0;
    public bool isDownloading = false;
    public float downloadProgress = 0f;
    
    private LocalAssetData localData;
    private AssetManifest currentManifest;
    
    // Events
    public event Action<AssetVersionResponse> OnUpdateAvailable;
    public event Action<float> OnDownloadProgress;
    public event Action OnDownloadComplete;
    public event Action<string> OnDownloadError;
    
    private void Awake()
    {
        // Set up local storage paths
        assetStoragePath = Path.Combine(Application.persistentDataPath, "DownloadedAssets");
        localDataPath = Path.Combine(Application.persistentDataPath, "assetData.json");
        
        // Create directories if they don't exist
        if (!Directory.Exists(assetStoragePath))
        {
            Directory.CreateDirectory(assetStoragePath);
        }
        
        // Load local asset data
        LoadLocalData();
    }
    
    private void Start()
    {
        // Check for updates on startup
        StartCoroutine(CheckForUpdates());
    }
    
    // ===== PUBLIC API =====
    
    /// <summary>
    /// Check if asset update is available
    /// </summary>
    public IEnumerator CheckForUpdates()
    {
        string platform = GetPlatform();
        string url = $"{backendUrl}/api/assets/version?version={localAssetVersion}&platform={platform}";
        
        Debug.Log($"[AssetDownloader] Checking for updates... Local version: {localAssetVersion}");
        
        using (UnityWebRequest request = UnityWebRequest.Get(url))
        {
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                try
                {
                    AssetVersionResponse response = JsonUtility.FromJson<AssetVersionResponse>(request.downloadHandler.text);
                    
                    Debug.Log($"[AssetDownloader] Server version: {response.currentVersion}, Needs update: {response.needsUpdate}");
                    
                    if (response.needsUpdate)
                    {
                        Debug.Log($"[AssetDownloader] Update available! Size: {response.downloadSizeText}");
                        OnUpdateAvailable?.Invoke(response);
                    }
                    else
                    {
                        Debug.Log("[AssetDownloader] Assets are up to date");
                    }
                }
                catch (Exception ex)
                {
                    Debug.LogError($"[AssetDownloader] Failed to parse version response: {ex.Message}");
                    OnDownloadError?.Invoke($"Failed to check for updates: {ex.Message}");
                }
            }
            else
            {
                Debug.LogError($"[AssetDownloader] Failed to check for updates: {request.error}");
                OnDownloadError?.Invoke($"Network error: {request.error}");
            }
        }
    }
    
    /// <summary>
    /// Download all required assets
    /// </summary>
    public IEnumerator DownloadAssets()
    {
        if (isDownloading)
        {
            Debug.LogWarning("[AssetDownloader] Download already in progress");
            yield break;
        }
        
        isDownloading = true;
        downloadProgress = 0f;
        
        // Get manifest
        yield return GetManifest();
        
        if (currentManifest == null)
        {
            Debug.LogError("[AssetDownloader] Failed to get manifest");
            OnDownloadError?.Invoke("Failed to get asset manifest");
            isDownloading = false;
            yield break;
        }
        
        // Filter assets that need to be downloaded
        List<AssetInfo> assetsToDownload = new List<AssetInfo>();
        foreach (AssetInfo asset in currentManifest.assets)
        {
            if (asset.needsDownload || !IsAssetDownloaded(asset))
            {
                assetsToDownload.Add(asset);
            }
        }
        
        Debug.Log($"[AssetDownloader] Downloading {assetsToDownload.Count} assets");
        
        // Download each asset
        for (int i = 0; i < assetsToDownload.Count; i++)
        {
            AssetInfo asset = assetsToDownload[i];
            
            Debug.Log($"[AssetDownloader] Downloading {asset.name} ({asset.sizeText}) [{i + 1}/{assetsToDownload.Count}]");
            
            yield return DownloadAsset(asset);
            
            // Update progress
            downloadProgress = (float)(i + 1) / assetsToDownload.Count;
            OnDownloadProgress?.Invoke(downloadProgress);
        }
        
        // Update local version
        localAssetVersion = currentManifest.version;
        localData.currentVersion = localAssetVersion;
        SaveLocalData();
        
        // Notify completion
        Debug.Log("[AssetDownloader] All assets downloaded successfully!");
        isDownloading = false;
        downloadProgress = 1f;
        OnDownloadComplete?.Invoke();
    }
    
    // ===== PRIVATE METHODS =====
    
    private IEnumerator GetManifest()
    {
        string platform = GetPlatform();
        string url = $"{backendUrl}/api/assets/manifest?version={localAssetVersion}&platform={platform}";
        
        using (UnityWebRequest request = UnityWebRequest.Get(url))
        {
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                try
                {
                    currentManifest = JsonUtility.FromJson<AssetManifest>(request.downloadHandler.text);
                    Debug.Log($"[AssetDownloader] Manifest loaded: {currentManifest.totalAssets} assets");
                }
                catch (Exception ex)
                {
                    Debug.LogError($"[AssetDownloader] Failed to parse manifest: {ex.Message}");
                    currentManifest = null;
                }
            }
            else
            {
                Debug.LogError($"[AssetDownloader] Failed to get manifest: {request.error}");
                currentManifest = null;
            }
        }
    }
    
    private IEnumerator DownloadAsset(AssetInfo asset)
    {
        string localPath = Path.Combine(assetStoragePath, asset.name);
        
        using (UnityWebRequest request = UnityWebRequest.Get(asset.downloadUrl))
        {
            request.downloadHandler = new DownloadHandlerFile(localPath);
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                // Verify downloaded file
                if (VerifyAssetHash(localPath, asset.hash))
                {
                    Debug.Log($"[AssetDownloader] Downloaded and verified: {asset.name}");
                    
                    // Mark as downloaded
                    if (!localData.downloadedAssets.Contains(asset.id))
                    {
                        localData.downloadedAssets.Add(asset.id);
                    }
                    localData.assetHashes[asset.id] = asset.hash;
                    SaveLocalData();
                }
                else
                {
                    Debug.LogError($"[AssetDownloader] Hash verification failed for: {asset.name}");
                    
                    // Delete corrupted file
                    if (File.Exists(localPath))
                    {
                        File.Delete(localPath);
                    }
                    
                    OnDownloadError?.Invoke($"Verification failed for {asset.name}");
                }
            }
            else
            {
                Debug.LogError($"[AssetDownloader] Failed to download {asset.name}: {request.error}");
                OnDownloadError?.Invoke($"Download failed: {asset.name}");
            }
        }
    }
    
    private bool IsAssetDownloaded(AssetInfo asset)
    {
        // Check if asset is in downloaded list
        if (!localData.downloadedAssets.Contains(asset.id))
        {
            return false;
        }
        
        // Check if file exists
        string localPath = Path.Combine(assetStoragePath, asset.name);
        if (!File.Exists(localPath))
        {
            return false;
        }
        
        // Check if hash matches
        if (localData.assetHashes.ContainsKey(asset.id))
        {
            string storedHash = localData.assetHashes[asset.id];
            if (storedHash != asset.hash)
            {
                return false; // Hash mismatch, need to re-download
            }
        }
        
        return true;
    }
    
    private bool VerifyAssetHash(string filePath, string expectedHash)
    {
        if (!File.Exists(filePath))
        {
            return false;
        }
        
        try
        {
            using (FileStream stream = File.OpenRead(filePath))
            {
                using (SHA256 sha256 = SHA256.Create())
                {
                    byte[] hashBytes = sha256.ComputeHash(stream);
                    string calculatedHash = BitConverter.ToString(hashBytes).Replace("-", "").ToLower();
                    return calculatedHash == expectedHash.ToLower();
                }
            }
        }
        catch (Exception ex)
        {
            Debug.LogError($"[AssetDownloader] Failed to verify hash: {ex.Message}");
            return false;
        }
    }
    
    private void LoadLocalData()
    {
        if (File.Exists(localDataPath))
        {
            try
            {
                string json = File.ReadAllText(localDataPath);
                localData = JsonUtility.FromJson<LocalAssetData>(json);
                localAssetVersion = localData.currentVersion;
                
                Debug.Log($"[AssetDownloader] Loaded local data: Version {localAssetVersion}, {localData.downloadedAssets.Count} assets");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[AssetDownloader] Failed to load local data: {ex.Message}");
                localData = new LocalAssetData();
            }
        }
        else
        {
            localData = new LocalAssetData();
            Debug.Log("[AssetDownloader] No local data found, starting fresh");
        }
    }
    
    private void SaveLocalData()
    {
        try
        {
            string json = JsonUtility.ToJson(localData, true);
            File.WriteAllText(localDataPath, json);
            Debug.Log($"[AssetDownloader] Saved local data: Version {localData.currentVersion}");
        }
        catch (Exception ex)
        {
            Debug.LogError($"[AssetDownloader] Failed to save local data: {ex.Message}");
        }
    }
    
    private string GetPlatform()
    {
#if UNITY_ANDROID
        return "android";
#elif UNITY_IOS
        return "ios";
#elif UNITY_STANDALONE_WIN
        return "windows";
#elif UNITY_STANDALONE_OSX
        return "macos";
#elif UNITY_WEBGL
        return "webgl";
#else
        return "unknown";
#endif
    }
}
