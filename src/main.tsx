// Block all Lovable/RudderStack console branding
(() => {
  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  
  const shouldBlock = (args: any[]) => {
    const str = args.join(' ').toLowerCase();
    return str.includes('lovable') || 
           str.includes('rudderstack') || 
           str.includes('hiring') ||
           str.includes('careers');
  };

  console.log = (...args: any[]) => {
    if (!shouldBlock(args)) originalLog.apply(console, args);
  };
  
  console.info = (...args: any[]) => {
    if (!shouldBlock(args)) originalInfo.apply(console, args);
  };
  
  console.warn = (...args: any[]) => {
    if (!shouldBlock(args)) originalWarn.apply(console, args);
  };
})();

import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);
