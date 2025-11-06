const logger = require('../utils/logger');

class IPFSService {
  constructor() {
    this.client = null;
    this.gateway = process.env.IPFS_GATEWAY || 'https://ipfs.io/ipfs/';
    this.ipfsEnabled = process.env.IPFS_ENABLED === 'true';
    this.init();
  }

  async init() {
    if (!this.ipfsEnabled) {
      logger.info('IPFS is disabled. Using gateway-only mode.');
      return;
    }

    try {
      // Try to require ipfs-http-client (will fail if not installed)
      let create;
      try {
        const ipfsModule = require('ipfs-http-client');
        create = ipfsModule.create;
      } catch (requireError) {
        logger.warn('ipfs-http-client not installed. Install with: npm install ipfs-http-client');
        logger.info('Using gateway-only mode');
        return;
      }

      const ipfsUrl = process.env.IPFS_URL || 'http://localhost:5001';
      this.client = create({ url: ipfsUrl });
      
      // Test connection
      const version = await this.client.version();
      logger.info(`Connected to IPFS node: ${version.version}`);
    } catch (error) {
      logger.error('Failed to connect to IPFS:', error);
      logger.warn('Falling back to gateway-only mode');
      // Fallback to public gateway
      this.client = null;
    }
  }

  /**
   * Upload a file to IPFS
   * @param {Object} file - File object with name, content, size, type
   * @returns {Promise<string>} - IPFS hash
   */
  async uploadFile(file) {
    try {
      if (!this.client) {
        throw new Error('IPFS client not available. Enable IPFS_ENABLED=true or install ipfs-http-client');
      }

      const result = await this.client.add(file.content, {
        pin: true,
        progress: (progress) => {
          logger.debug(`Upload progress: ${progress}`);
        }
      });

      logger.info(`File uploaded to IPFS: ${result.path}`);
      return result.path;
    } catch (error) {
      logger.error('Error uploading file to IPFS:', error);
      throw error;
    }
  }

  /**
   * Upload JSON data to IPFS
   * @param {Object} data - JSON data to upload
   * @returns {Promise<string>} - IPFS hash
   */
  async uploadJSON(data) {
    try {
      if (!this.client) {
        throw new Error('IPFS client not available. Enable IPFS_ENABLED=true or install ipfs-http-client');
      }

      const jsonString = JSON.stringify(data, null, 2);
      const result = await this.client.add(jsonString, {
        pin: true
      });

      logger.info(`JSON uploaded to IPFS: ${result.path}`);
      return result.path;
    } catch (error) {
      logger.error('Error uploading JSON to IPFS:', error);
      throw error;
    }
  }

  /**
   * Retrieve data from IPFS
   * @param {string} hash - IPFS hash
   * @returns {Promise<Buffer>} - File content
   */
  async getFile(hash) {
    try {
      if (!this.client) {
        // Fallback to public gateway
        const response = await fetch(`${this.gateway}${hash}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return Buffer.from(await response.arrayBuffer());
      }

      const chunks = [];
      for await (const chunk of this.client.cat(hash)) {
        chunks.push(chunk);
      }
      
      return Buffer.concat(chunks);
    } catch (error) {
      logger.error('Error retrieving file from IPFS:', error);
      throw error;
    }
  }

  /**
   * Retrieve JSON data from IPFS
   * @param {string} hash - IPFS hash
   * @returns {Promise<Object>} - Parsed JSON data
   */
  async getJSON(hash) {
    try {
      const buffer = await this.getFile(hash);
      const jsonString = buffer.toString();
      return JSON.parse(jsonString);
    } catch (error) {
      logger.error('Error retrieving JSON from IPFS:', error);
      throw error;
    }
  }

  /**
   * Pin a hash to IPFS
   * @param {string} hash - IPFS hash to pin
   * @returns {Promise<boolean>} - Success status
   */
  async pinHash(hash) {
    try {
      if (!this.client) {
        throw new Error('IPFS client not available');
      }

      await this.client.pin.add(hash);
      logger.info(`Hash pinned to IPFS: ${hash}`);
      return true;
    } catch (error) {
      logger.error('Error pinning hash to IPFS:', error);
      return false;
    }
  }

  /**
   * Unpin a hash from IPFS
   * @param {string} hash - IPFS hash to unpin
   * @returns {Promise<boolean>} - Success status
   */
  async unpinHash(hash) {
    try {
      if (!this.client) {
        throw new Error('IPFS client not available');
      }

      await this.client.pin.rm(hash);
      logger.info(`Hash unpinned from IPFS: ${hash}`);
      return true;
    } catch (error) {
      logger.error('Error unpinning hash from IPFS:', error);
      return false;
    }
  }

  /**
   * Get file info from IPFS
   * @param {string} hash - IPFS hash
   * @returns {Promise<Object>} - File information
   */
  async getFileInfo(hash) {
    try {
      if (!this.client) {
        throw new Error('IPFS client not available');
      }

      const stats = await this.client.files.stat(`/ipfs/${hash}`);
      return {
        hash,
        size: stats.size,
        type: stats.type,
        blocks: stats.blocks
      };
    } catch (error) {
      logger.error('Error getting file info from IPFS:', error);
      throw error;
    }
  }

  /**
   * Get gateway URL for a hash
   * @param {string} hash - IPFS hash
   * @returns {string} - Gateway URL
   */
  getGatewayURL(hash) {
    return `${this.gateway}${hash}`;
  }

  /**
   * Validate IPFS hash format
   * @param {string} hash - Hash to validate
   * @returns {boolean} - Valid status
   */
  isValidHash(hash) {
    // Basic IPFS hash validation (starts with Qm or bafy)
    return /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z0-9]{50,})$/.test(hash);
  }
}

module.exports = new IPFSService();
