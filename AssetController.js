const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const Console = require("./ConsoleUtils");

class AssetController {
  constructor() {
    this.configPath = path.join(__dirname, 'assetConfig.json');
    this.config = null;
    this.downloadLogs = [];
    this.loadConfig();
  }

  async loadConfig() {
    try {
      const data = await fs.readFile(this.configPath, 'utf8');
      this.config = JSON.parse(data);
      Console.log('AssetController', `Loaded asset config - Version: ${this.config.currentVersion}`);
    } catch (err) {
      Console.error('AssetController', 'Failed to load asset config:', err.message);
      // Create default config if file doesn't exist
      this.config = {
        currentVersion: 1,
        forceUpdate: false,
        downloadSize: 0,
        downloadSizeText: "0 MB",
        popupTitle: "Update Available",
        popupMessage: "New assets are available.",
        required: false,
        assets: []
      };
    }
  }

  async saveConfig() {
    try {
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
      Console.log('AssetController', `Saved asset config - Version: ${this.config.currentVersion}`);
      return true;
    } catch (err) {
      Console.error('AssetController', 'Failed to save asset config:', err.message);
      return false;
    }
  }

  // GET /api/assets/version - Check if update is needed
  async checkVersion(req, res) {
    try {
      const clientVersion = parseInt(req.query.version || req.query.clientVersion || 0);
      const platform = req.query.platform || 'android';
      
      Console.log('AssetVersion', `Client version: ${clientVersion}, Server version: ${this.config.currentVersion}, Platform: ${platform}`);

      const needsUpdate = clientVersion < this.config.currentVersion;

      // Filter assets by platform
      const platformAssets = this.config.assets.filter(asset => 
        asset.platform === platform || asset.platform === 'all'
      );

      // Calculate total size of required assets
      const totalSize = platformAssets
        .filter(asset => asset.required)
        .reduce((sum, asset) => sum + asset.size, 0);

      const response = {
        currentVersion: this.config.currentVersion,
        clientVersion: clientVersion,
        needsUpdate: needsUpdate,
        forceUpdate: this.config.forceUpdate,
        assetVersion: this.config.currentVersion,
        downloadSize: totalSize,
        downloadSizeText: this.formatBytes(totalSize),
        message: this.config.popupMessage,
        title: this.config.popupTitle,
        required: this.config.required && needsUpdate,
        updateAvailable: needsUpdate,
        manifestVersion: this.config.manifestVersion || 1,
        updateNotes: this.config.updateNotes || [],
        minClientVersion: this.config.minClientVersion || "0.0"
      };

      // Log the version check
      this.logDownload({
        type: 'VERSION_CHECK',
        clientVersion: clientVersion,
        serverVersion: this.config.currentVersion,
        needsUpdate: needsUpdate,
        platform: platform,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      res.json(response);
    } catch (err) {
      Console.error('AssetVersion', 'Error:', err);
      res.status(500).json({ 
        error: 'Failed to check asset version',
        message: err.message 
      });
    }
  }

  // GET /api/assets/manifest - Get full asset manifest
  async getManifest(req, res) {
    try {
      const clientVersion = parseInt(req.query.version || 0);
      const platform = req.query.platform || 'android';
      
      Console.log('AssetManifest', `Client version: ${clientVersion}, Platform: ${platform}`);

      // Filter assets by platform
      const platformAssets = this.config.assets.filter(asset => 
        asset.platform === platform || asset.platform === 'all'
      );

      // Determine which assets need to be downloaded
      const assetsToDownload = clientVersion < this.config.currentVersion 
        ? platformAssets.filter(asset => asset.version > clientVersion || asset.required)
        : [];

      const baseUrl = `${req.protocol}://${req.get('host')}`;

      const manifest = {
        version: this.config.currentVersion,
        manifestVersion: this.config.manifestVersion || 1,
        platform: platform,
        timestamp: new Date().toISOString(),
        totalAssets: platformAssets.length,
        requiredAssets: assetsToDownload.length,
        totalSize: assetsToDownload.reduce((sum, asset) => sum + asset.size, 0),
        assets: platformAssets.map(asset => ({
          id: asset.id,
          name: asset.name,
          type: asset.type,
          version: asset.version,
          size: asset.size,
          sizeText: asset.sizeText,
          hash: asset.hash,
          crc: asset.crc,
          url: `${baseUrl}${asset.url}`,
          downloadUrl: `${baseUrl}${asset.url}`,
          priority: asset.priority || 1,
          required: asset.required || false,
          needsDownload: assetsToDownload.some(a => a.id === asset.id)
        })),
        cdnUrls: this.config.cdnUrls || [],
        updateNotes: this.config.updateNotes || []
      };

      // Log manifest request
      this.logDownload({
        type: 'MANIFEST_REQUEST',
        clientVersion: clientVersion,
        platform: platform,
        assetsCount: manifest.assets.length,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      res.json(manifest);
    } catch (err) {
      Console.error('AssetManifest', 'Error:', err);
      res.status(500).json({ 
        error: 'Failed to get asset manifest',
        message: err.message 
      });
    }
  }

  // GET /api/assets/download/:assetId - Download specific asset
  async downloadAsset(req, res) {
    try {
      const assetId = req.params.assetId;
      const asset = this.config.assets.find(a => a.id === assetId);

      if (!asset) {
        Console.error('AssetDownload', `Asset not found: ${assetId}`);
        return res.status(404).json({ 
          error: 'Asset not found',
          assetId: assetId 
        });
      }

      Console.log('AssetDownload', `Downloading asset: ${assetId} (${asset.sizeText})`);

      // In a real implementation, you would serve the actual file
      // For now, we'll send mock data with proper headers
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${asset.name}"`);
      res.setHeader('Content-Length', asset.size);
      res.setHeader('X-Asset-Version', asset.version);
      res.setHeader('X-Asset-Hash', asset.hash);
      res.setHeader('X-Asset-CRC', asset.crc);
      res.setHeader('Accept-Ranges', 'bytes');

      // Handle range requests for resume functionality
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : asset.size - 1;
        const chunksize = (end - start) + 1;
        
        res.setHeader('Content-Range', `bytes ${start}-${end}/${asset.size}`);
        res.setHeader('Content-Length', chunksize);
        res.status(206);
      }

      // Log download
      this.logDownload({
        type: 'ASSET_DOWNLOAD',
        assetId: assetId,
        assetName: asset.name,
        size: asset.size,
        ip: req.ip,
        timestamp: new Date().toISOString(),
        rangeRequest: !!range
      });

      // Generate mock data (in production, stream the actual file)
      const mockData = Buffer.alloc(Math.min(asset.size, 1024)); // Send small chunk for testing
      res.send(mockData);

    } catch (err) {
      Console.error('AssetDownload', 'Error:', err);
      res.status(500).json({ 
        error: 'Failed to download asset',
        message: err.message 
      });
    }
  }

  // POST /api/assets/verify - Verify downloaded asset
  async verifyAsset(req, res) {
    try {
      const { assetId, hash, crc } = req.body;

      if (!assetId) {
        return res.status(400).json({ error: 'Asset ID is required' });
      }

      const asset = this.config.assets.find(a => a.id === assetId);
      if (!asset) {
        return res.status(404).json({ error: 'Asset not found' });
      }

      const hashValid = !hash || asset.hash === hash;
      const crcValid = !crc || asset.crc === crc;
      const valid = hashValid && crcValid;

      Console.log('AssetVerify', `Asset: ${assetId}, Valid: ${valid}, Hash: ${hashValid}, CRC: ${crcValid}`);

      // Log verification
      this.logDownload({
        type: 'ASSET_VERIFICATION',
        assetId: assetId,
        valid: valid,
        hashValid: hashValid,
        crcValid: crcValid,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      res.json({
        valid: valid,
        assetId: assetId,
        hashValid: hashValid,
        crcValid: crcValid,
        expectedHash: asset.hash,
        expectedCrc: asset.crc
      });

    } catch (err) {
      Console.error('AssetVerify', 'Error:', err);
      res.status(500).json({ 
        error: 'Failed to verify asset',
        message: err.message 
      });
    }
  }

  // POST /api/assets/complete - Mark download as complete
  async completeDownload(req, res) {
    try {
      const { version, platform, assets } = req.body;

      Console.log('AssetComplete', `Version: ${version}, Platform: ${platform}, Assets: ${assets?.length || 0}`);

      // Log completion
      this.logDownload({
        type: 'DOWNLOAD_COMPLETE',
        version: version,
        platform: platform,
        assetsCount: assets?.length || 0,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Download completed successfully',
        version: version
      });

    } catch (err) {
      Console.error('AssetComplete', 'Error:', err);
      res.status(500).json({ 
        error: 'Failed to complete download',
        message: err.message 
      });
    }
  }

  // Admin endpoints

  // POST /api/assets/admin/update-version - Update asset version
  async updateVersion(req, res) {
    try {
      const { version, forceUpdate, message, title } = req.body;

      if (version !== undefined) {
        this.config.currentVersion = parseInt(version);
      }
      if (forceUpdate !== undefined) {
        this.config.forceUpdate = forceUpdate;
      }
      if (message !== undefined) {
        this.config.popupMessage = message;
      }
      if (title !== undefined) {
        this.config.popupTitle = title;
      }

      await this.saveConfig();

      Console.log('AssetAdmin', `Updated version to ${this.config.currentVersion}, Force: ${this.config.forceUpdate}`);

      res.json({
        success: true,
        currentVersion: this.config.currentVersion,
        forceUpdate: this.config.forceUpdate,
        message: 'Asset configuration updated successfully'
      });

    } catch (err) {
      Console.error('AssetAdmin', 'Error updating version:', err);
      res.status(500).json({ 
        error: 'Failed to update version',
        message: err.message 
      });
    }
  }

  // GET /api/assets/admin/config - Get current config
  async getConfig(req, res) {
    try {
      res.json(this.config);
    } catch (err) {
      Console.error('AssetAdmin', 'Error getting config:', err);
      res.status(500).json({ 
        error: 'Failed to get config',
        message: err.message 
      });
    }
  }

  // POST /api/assets/admin/config - Update entire config
  async updateConfig(req, res) {
    try {
      const newConfig = req.body;
      
      // Validate required fields
      if (!newConfig.currentVersion || !newConfig.assets) {
        return res.status(400).json({ 
          error: 'Invalid config',
          message: 'currentVersion and assets are required' 
        });
      }

      this.config = { ...this.config, ...newConfig };
      await this.saveConfig();

      Console.log('AssetAdmin', 'Config updated successfully');

      res.json({
        success: true,
        message: 'Configuration updated successfully',
        config: this.config
      });

    } catch (err) {
      Console.error('AssetAdmin', 'Error updating config:', err);
      res.status(500).json({ 
        error: 'Failed to update config',
        message: err.message 
      });
    }
  }

  // GET /api/assets/admin/logs - Get download logs
  async getLogs(req, res) {
    try {
      const limit = parseInt(req.query.limit || 100);
      const type = req.query.type;

      let logs = this.downloadLogs;
      
      if (type) {
        logs = logs.filter(log => log.type === type);
      }

      logs = logs.slice(-limit);

      res.json({
        total: logs.length,
        logs: logs
      });

    } catch (err) {
      Console.error('AssetAdmin', 'Error getting logs:', err);
      res.status(500).json({ 
        error: 'Failed to get logs',
        message: err.message 
      });
    }
  }

  // Utility functions

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  logDownload(logEntry) {
    this.downloadLogs.push(logEntry);
    
    // Keep only last 1000 logs in memory
    if (this.downloadLogs.length > 1000) {
      this.downloadLogs = this.downloadLogs.slice(-1000);
    }
  }

  // Calculate hash for a file (for asset validation)
  calculateHash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  calculateCRC(data) {
    // Simple CRC32 calculation
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
      crc = crc ^ data[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
      }
    }
    return ((crc ^ 0xFFFFFFFF) >>> 0).toString(16).toUpperCase().padStart(8, '0');
  }
}

module.exports = AssetController;
