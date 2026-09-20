using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using TMPro; // If using TextMeshPro, otherwise use UnityEngine.UI.Text

// Unity UI Controller for Asset Update Popup
// Attach this to a Canvas GameObject in your scene

public class AssetUpdateUI : MonoBehaviour
{
    [Header("UI References")]
    public GameObject updatePopupPanel;
    public TextMeshProUGUI titleText;
    public TextMeshProUGUI messageText;
    public TextMeshProUGUI downloadSizeText;
    public TextMeshProUGUI progressText;
    public Button downloadButton;
    public Button cancelButton;
    public GameObject progressPanel;
    public Slider progressBar;
    public Image progressFill;
    
    [Header("Asset Downloader")]
    public UnityAssetDownloader assetDownloader;
    
    [Header("Settings")]
    public bool blockGameplayDuringDownload = true;
    public Color progressColor = Color.green;
    
    private AssetVersionResponse currentUpdateInfo;
    private bool isForceUpdate = false;
    
    private void Awake()
    {
        // Find asset downloader if not assigned
        if (assetDownloader == null)
        {
            assetDownloader = FindObjectOfType<UnityAssetDownloader>();
            if (assetDownloader == null)
            {
                Debug.LogError("[AssetUpdateUI] UnityAssetDownloader not found in scene!");
                return;
            }
        }
        
        // Subscribe to events
        assetDownloader.OnUpdateAvailable += ShowUpdatePopup;
        assetDownloader.OnDownloadProgress += UpdateProgress;
        assetDownloader.OnDownloadComplete += OnDownloadComplete;
        assetDownloader.OnDownloadError += OnDownloadError;
        
        // Setup button listeners
        if (downloadButton != null)
        {
            downloadButton.onClick.AddListener(OnDownloadButtonClicked);
        }
        
        if (cancelButton != null)
        {
            cancelButton.onClick.AddListener(OnCancelButtonClicked);
        }
        
        // Hide UI initially
        HideAllPanels();
    }
    
    private void OnDestroy()
    {
        // Unsubscribe from events
        if (assetDownloader != null)
        {
            assetDownloader.OnUpdateAvailable -= ShowUpdatePopup;
            assetDownloader.OnDownloadProgress -= UpdateProgress;
            assetDownloader.OnDownloadComplete -= OnDownloadComplete;
            assetDownloader.OnDownloadError -= OnDownloadError;
        }
    }
    
    // ===== PUBLIC API =====
    
    public void ShowUpdatePopup(AssetVersionResponse updateInfo)
    {
        currentUpdateInfo = updateInfo;
        isForceUpdate = updateInfo.forceUpdate;
        
        Debug.Log($"[AssetUpdateUI] Showing update popup - Size: {updateInfo.downloadSizeText}, Force: {isForceUpdate}");
        
        // Show popup panel
        if (updatePopupPanel != null)
        {
            updatePopupPanel.SetActive(true);
        }
        
        // Set title
        if (titleText != null)
        {
            titleText.text = updateInfo.title;
        }
        
        // Set message
        if (messageText != null)
        {
            messageText.text = updateInfo.message;
            
            // Add update notes if available
            if (updateInfo.updateNotes != null && updateInfo.updateNotes.Length > 0)
            {
                messageText.text += "\n\nWhat's New:\n";
                foreach (string note in updateInfo.updateNotes)
                {
                    messageText.text += $"• {note}\n";
                }
            }
        }
        
        // Set download size
        if (downloadSizeText != null)
        {
            downloadSizeText.text = $"Download Size: {updateInfo.downloadSizeText}";
        }
        
        // Configure buttons
        if (cancelButton != null)
        {
            cancelButton.gameObject.SetActive(!isForceUpdate);
        }
        
        if (downloadButton != null)
        {
            TextMeshProUGUI buttonText = downloadButton.GetComponentInChildren<TextMeshProUGUI>();
            if (buttonText != null)
            {
                buttonText.text = isForceUpdate ? "Download Now" : "Download";
            }
        }
        
        // Hide progress panel initially
        if (progressPanel != null)
        {
            progressPanel.SetActive(false);
        }
        
        // Block gameplay if force update
        if (isForceUpdate && blockGameplayDuringDownload)
        {
            BlockGameplay();
        }
    }
    
    public void OnDownloadButtonClicked()
    {
        Debug.Log("[AssetUpdateUI] Download button clicked");
        
        // Hide popup, show progress
        if (updatePopupPanel != null)
        {
            updatePopupPanel.SetActive(false);
        }
        
        if (progressPanel != null)
        {
            progressPanel.SetActive(true);
        }
        
        // Start download
        StartCoroutine(assetDownloader.DownloadAssets());
    }
    
    public void OnCancelButtonClicked()
    {
        Debug.Log("[AssetUpdateUI] Cancel button clicked");
        
        if (isForceUpdate)
        {
            Debug.LogWarning("[AssetUpdateUI] Cannot cancel force update");
            return;
        }
        
        // Hide popup
        HideAllPanels();
        
        // Allow gameplay to continue
        UnblockGameplay();
    }
    
    public void UpdateProgress(float progress)
    {
        // Update progress bar
        if (progressBar != null)
        {
            progressBar.value = progress;
        }
        
        if (progressFill != null)
        {
            progressFill.color = progressColor;
        }
        
        // Update progress text
        if (progressText != null)
        {
            int percentage = Mathf.RoundToInt(progress * 100f);
            progressText.text = $"Downloading... {percentage}%";
        }
    }
    
    public void OnDownloadComplete()
    {
        Debug.Log("[AssetUpdateUI] Download complete!");
        
        // Update progress text
        if (progressText != null)
        {
            progressText.text = "Download Complete!";
        }
        
        // Hide progress panel after a delay
        StartCoroutine(HideProgressPanelDelayed(2f));
        
        // Unblock gameplay
        UnblockGameplay();
    }
    
    public void OnDownloadError(string error)
    {
        Debug.LogError($"[AssetUpdateUI] Download error: {error}");
        
        // Update progress text
        if (progressText != null)
        {
            progressText.text = $"Error: {error}";
            progressText.color = Color.red;
        }
        
        // Show retry button
        if (downloadButton != null)
        {
            downloadButton.gameObject.SetActive(true);
            TextMeshProUGUI buttonText = downloadButton.GetComponentInChildren<TextMeshProUGUI>();
            if (buttonText != null)
            {
                buttonText.text = "Retry";
            }
        }
    }
    
    // ===== PRIVATE METHODS =====
    
    private void HideAllPanels()
    {
        if (updatePopupPanel != null)
        {
            updatePopupPanel.SetActive(false);
        }
        
        if (progressPanel != null)
        {
            progressPanel.SetActive(false);
        }
    }
    
    private IEnumerator HideProgressPanelDelayed(float delay)
    {
        yield return new WaitForSeconds(delay);
        
        if (progressPanel != null)
        {
            progressPanel.SetActive(false);
        }
    }
    
    private void BlockGameplay()
    {
        Debug.Log("[AssetUpdateUI] Blocking gameplay during update");
        
        // Disable game objects that allow gameplay
        // Example: Disable main menu buttons, game scenes, etc.
        
        // You can also show a blocking overlay
        // overlayPanel.SetActive(true);
    }
    
    private void UnblockGameplay()
    {
        Debug.Log("[AssetUpdateUI] Unblocking gameplay");
        
        // Re-enable game objects
        // Example: Enable main menu buttons, allow scene transitions, etc.
        
        // Hide blocking overlay
        // overlayPanel.SetActive(false);
    }
}
