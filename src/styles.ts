import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    height: 100%; /* Ensure host takes height */
  }
  
  ha-card {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: white; /* Ensure visible background */
  }
  
  .card-content {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    height: 400px; /* Fallback height */
  }
  
  .map-container {
    flex-grow: 1;
    width: 100%;
    min-height: 400px;
    padding: 8px 16px;
    border-radius: 20px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    backdrop-filter: blur(4px);
  }

  .controls {
    display: flex;
    justify-content: space-between;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 -2px 4px rgba(0,0,0,0.1);
    z-index: 1000;
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
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
  }

  .controls input:focus {
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
    border-radius: 8px;
  }
`;
