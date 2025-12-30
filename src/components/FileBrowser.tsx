import React, { useState } from 'react';

interface FileItem {
  name: string;
  isDirectory: boolean;
  path: string;
}

interface FolderData {
  folderPath: string;
  files: FileItem[];
}

export const FileBrowser: React.FC = () => {
  const [folderData, setFolderData] = useState<FolderData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectFolder = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await window.electronAPI.selectFolder();
      if (result) {
        setFolderData(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read folder');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#1e1e1e', borderRadius: '8px' }}>
      <h3 style={{ color: '#fff', marginBottom: '15px' }}>File Browser</h3>
      
      <button
        onClick={handleSelectFolder}
        disabled={loading}
        style={{
          padding: '10px 20px',
          backgroundColor: '#4CAF50',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          marginBottom: '15px',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? 'Loading...' : 'Select Folder'}
      </button>

      {error && (
        <div style={{ color: '#ff4444', marginBottom: '15px', padding: '10px', backgroundColor: '#3a1a1a', borderRadius: '4px' }}>
          Error: {error}
        </div>
      )}

      {folderData && (
        <div>
          <div style={{ color: '#aaa', marginBottom: '10px', fontSize: '12px' }}>
            <strong>Path:</strong> {folderData.folderPath}
          </div>
          <div style={{ color: '#aaa', marginBottom: '10px', fontSize: '12px' }}>
            <strong>Items:</strong> {folderData.files.length}
          </div>
          <div style={{ maxHeight: '400px', overflowY: 'auto', backgroundColor: '#2d2d2d', borderRadius: '4px', padding: '10px' }}>
            {folderData.files.length === 0 ? (
              <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>
                Folder is empty
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '4px' }}>
                {folderData.files.map((file, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '8px',
                      backgroundColor: file.isDirectory ? '#2a3a2a' : '#2a2a3a',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span style={{ color: file.isDirectory ? '#4CAF50' : '#64B5F6' }}>
                      {file.isDirectory ? '📁' : '📄'}
                    </span>
                    <span style={{ color: '#fff', fontSize: '14px' }}>{file.name}</span>
                    {file.isDirectory && (
                      <span style={{ color: '#888', fontSize: '12px' }}>(directory)</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

