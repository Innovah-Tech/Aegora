// IPFS File Upload Component
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, File, Loader } from 'lucide-react';
import { uploadToIPFS, isValidIPFSHash } from '../utils/ipfs';
import { showToast } from '../utils/toast';

export function IPFSUpload({ onUploadComplete, label = 'Upload File', accept = {}, maxSize = 10485760 }) {
  const [uploading, setUploading] = useState(false);
  const [uploadedHash, setUploadedHash] = useState(null);

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    
    if (file.size > maxSize) {
      showToast.error(`File size exceeds ${maxSize / 1024 / 1024}MB limit`);
      return;
    }

    setUploading(true);
    try {
      const hash = await uploadToIPFS(file, 'file');
      setUploadedHash(hash);
      if (onUploadComplete) {
        onUploadComplete(hash);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadedHash(null);
    } finally {
      setUploading(false);
    }
  }, [onUploadComplete, maxSize]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple: false,
  });

  const clearUpload = () => {
    setUploadedHash(null);
    if (onUploadComplete) {
      onUploadComplete(null);
    }
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      
      {uploadedHash ? (
        <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center space-x-3">
            <File className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-900 dark:text-green-100">Uploaded</p>
              <p className="text-xs text-green-700 dark:text-green-300 font-mono break-all">
                {uploadedHash}
              </p>
            </div>
          </div>
          <button
            onClick={clearUpload}
            className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
            aria-label="Remove file"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
            ${isDragActive 
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
              : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
            }
            ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} disabled={uploading} />
          {uploading ? (
            <div className="flex flex-col items-center space-y-2">
              <Loader className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Uploading to IPFS...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-2">
              <Upload className="w-8 h-8 text-gray-400" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {isDragActive ? 'Drop file here' : 'Drag & drop or click to upload'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Max size: {maxSize / 1024 / 1024}MB
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function IPFSHashInput({ value, onChange, label = 'IPFS Hash', required = false }) {
  const [isValid, setIsValid] = useState(true);

  const handleChange = (e) => {
    const hash = e.target.value;
    const valid = !hash || isValidIPFSHash(hash);
    setIsValid(valid);
    if (onChange) {
      onChange(hash);
    }
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type="text"
        value={value || ''}
        onChange={handleChange}
        placeholder="Qm..."
        className={`
          w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent
          font-mono text-sm
          ${isValid 
            ? 'border-gray-300 dark:border-gray-600' 
            : 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20'
          }
        `}
        required={required}
      />
      {!isValid && value && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          Invalid IPFS hash format
        </p>
      )}
    </div>
  );
}

export default IPFSUpload;

