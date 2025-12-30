import React from 'react';

export interface Model {
  name: string;
  alias: string;
}

interface ModelSelectorProps {
  models: Model[];
  selectedModel: Model;
  modelPath: string;
  isInitialized: boolean;
  isInitializing: boolean;
  onModelChange: (model: Model) => void;
  onPathChange: (path: string) => void;
  onSelectFile: () => void;
  onInitialize: () => void;
  onReset: () => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  selectedModel,
  modelPath,
  isInitialized,
  isInitializing,
  onModelChange,
  onPathChange,
  onSelectFile,
  onInitialize,
  onReset,
}) => {
  return (
    <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
      <select
        value={selectedModel.alias}
        onChange={(e) => {
          const model = models.find((m) => m.alias === e.target.value);
          if (model) onModelChange(model);
        }}
        disabled={isInitialized || isInitializing}
        style={{
          padding: '8px 12px',
          backgroundColor: '#2d2d2d',
          color: '#fff',
          border: '1px solid #444',
          borderRadius: '4px',
          fontSize: '14px',
          cursor: isInitialized || isInitializing ? 'not-allowed' : 'pointer',
        }}
      >
        {models.map((model) => (
          <option key={model.alias} value={model.alias}>
            {model.name}
          </option>
        ))}
      </select>

      <div style={{ flex: 1, minWidth: '200px', display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={modelPath}
          onChange={(e) => onPathChange(e.target.value)}
          placeholder="Model alias (e.g., llama-3-8b) or full path..."
          disabled={isInitialized || isInitializing}
          style={{
            flex: 1,
            padding: '8px 12px',
            backgroundColor: '#2d2d2d',
            color: '#fff',
            border: '1px solid #444',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        />
        <button
          onClick={onSelectFile}
          disabled={isInitialized || isInitializing}
          style={{
            padding: '8px 16px',
            backgroundColor: '#64B5F6',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: isInitialized || isInitializing ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            opacity: isInitialized || isInitializing ? 0.6 : 1,
          }}
          title="Browse for GGUF file"
        >
          Browse
        </button>
      </div>

      <button
        onClick={onInitialize}
        disabled={isInitialized || isInitializing || !modelPath.trim()}
        style={{
          padding: '8px 16px',
          backgroundColor: isInitialized ? '#4CAF50' : '#64B5F6',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: isInitialized || isInitializing || !modelPath.trim() ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          opacity: isInitialized || isInitializing || !modelPath.trim() ? 0.6 : 1,
        }}
      >
        {isInitialized ? '✓ Initialized' : isInitializing ? 'Initializing...' : 'Initialize Model'}
      </button>

      {isInitialized && (
        <button
          onClick={onReset}
          disabled={isInitializing}
          style={{
            padding: '8px 16px',
            backgroundColor: '#ff6b6b',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: isInitializing ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            opacity: isInitializing ? 0.6 : 1,
          }}
          title="Reset conversation and clear LLM session state"
        >
          Reset
        </button>
      )}
    </div>
  );
};

