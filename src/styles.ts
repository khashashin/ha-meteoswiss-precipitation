import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    height: 100%;
  }
  
  ha-card {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: white; 
  }
  
  .card-content {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 0; /* Remove default padding if needed, or keep it */
  }
  
  .map-wrapper {
    position: relative;
    flex-grow: 1;
    width: 100%;
    min-height: 200px;
    z-index: 0;
  }

  .map-container {
    width: 100%;
    height: 100%;
    z-index: 0;
  }

  .reset-button {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 1000;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    opacity: 1;
    transform: translateY(0);
    color: #444;
  }

  .reset-button:hover {
    background: #f4f4f4;
    color: #000;
  }

  .reset-button.hidden {
    opacity: 0;
    pointer-events: none;
    transform: translateY(-10px);
  }

  .reset-button svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
  }

  .controls {
    display: flex;
    flex-direction: column;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 -2px 4px rgba(0,0,0,0.1);
    z-index: 1000;
    gap: 4px;
    flex-shrink: 0; 
  }
  .time-label {
    text-align: center;
    font-size: 14px;
    font-weight: 500;
    color: #333;
    padding-bottom: 4px;
  }

  .controls-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }
  
  .controls button {
    border: none;
    background: transparent;
    color: #444; 
    padding: 8px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, color 0.2s;
    width: 32px;
    height: 32px;
  }
  
  .controls button:hover {
    background: rgba(0,0,0,0.05);
    color: #000;
  }

  .controls button.active {
    color: #1976d2;
  }

  .controls input {
    flex-grow: 1;
    margin: 0 8px;
    padding: 4px;
    border: 1px solid #ccc;
    border-radius: 4px;
    cursor: pointer;
  }

  .controls input:focus {
    outline: none;
    border-color: #1976d2;
  }
  
  .map-legend {
      position: absolute;
      bottom: 20px;
      right: 10px;
      z-index: 1000;
      background: rgba(255, 255, 255, 0.9);
      padding: 10px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      pointer-events: none;
  }
  
  .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
  }
  
  .color-box {
      width: 16px;
      height: 16px;
      border-radius: 2px;
  }

  /* Leaflet overrides */
  .leaflet-container {
    height: 100%;
    width: 100%;
    background: #f0f0f0; /* Fallback color */
  }
`;
