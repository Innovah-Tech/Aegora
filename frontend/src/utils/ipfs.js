// IPFS upload utility
import { showToast } from './toast';
import config from '../config/env';

/**
 * Upload file or text to IPFS via backend API
 */
export async function uploadToIPFS(data, type = 'json') {
  try {
    const formData = new FormData();
    
    if (type === 'file' && data instanceof File) {
      formData.append('file', data);
    } else {
      // For JSON/text, stringify it
      const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data)], {
        type: 'application/json',
      });
      formData.append('file', blob, 'data.json');
    }

    const response = await fetch(`${config.apiUrl}/api/ipfs/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.success && result.data?.hash) {
      showToast.success('File uploaded to IPFS successfully');
      return result.data.hash;
    } else {
      throw new Error(result.message || 'Upload failed');
    }
  } catch (error) {
    console.error('IPFS upload error:', error);
    showToast.error('Failed to upload to IPFS', error);
    throw error;
  }
}

/**
 * Retrieve file from IPFS hash
 */
export async function getFromIPFS(hash) {
  try {
    // Try gateway first
    const gatewayUrl = `${config.ipfsGateway || 'https://ipfs.io/ipfs/'}${hash}`;
    const response = await fetch(gatewayUrl);
    
    if (!response.ok) {
      throw new Error('Failed to fetch from IPFS');
    }

    return await response.json();
  } catch (error) {
    console.error('IPFS fetch error:', error);
    showToast.error('Failed to fetch from IPFS', error);
    throw error;
  }
}

/**
 * Validate IPFS hash format
 */
export function isValidIPFSHash(hash) {
  if (!hash) return false;
  return /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z0-9]{50,})$/.test(hash);
}

export default {
  uploadToIPFS,
  getFromIPFS,
  isValidIPFSHash,
};

