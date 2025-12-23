import { createRoot } from 'react-dom/client';
import React from 'react';

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <h1>Hello from React!</h1>
  </React.StrictMode>
);