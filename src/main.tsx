import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { syncManager } from './lib/syncManager';

// Show loading screen
const root = document.getElementById("root")!;
root.innerHTML = `
  <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
    <div style="text-align: center; color: white;">
      <div style="font-size: 48px; margin-bottom: 16px;">🎵</div>
      <div style="font-size: 24px; font-weight: bold; margin-bottom: 8px;">טוען נתונים מהענן...</div>
      <div style="font-size: 16px; opacity: 0.9;">אנא המתן</div>
    </div>
  </div>
`;

// Load data from Dropbox before starting the app
async function initializeApp() {
  try {
    console.log('🚀 Starting app initialization...');
    await syncManager.loadDataOnInit();
    console.log('✅ Data loaded successfully, rendering app...');
  } catch (error) {
    console.error('⚠️ Error loading data, continuing with local data:', error);
  } finally {
    createRoot(root).render(<App />);
  }
}

initializeApp();
