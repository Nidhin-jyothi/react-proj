import React from 'react';
import './App.css';
import PredictionsPanel from './components/PredictionsPanel';
import MoleculeViewer from './components/MoleculeViewer';
import SummaryPanel from './components/SummaryPanel';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <div className="app-container">
      <PredictionsPanel />
      <ErrorBoundary>
        <MoleculeViewer />
      </ErrorBoundary>
      <SummaryPanel />
    </div>
  );
}

export default App;