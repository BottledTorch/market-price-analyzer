import React from 'react';
import './App.css';
import ExcelUpload from './ExcelUpload';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        
        {/* Embed the ExcelUpload component */}
        <ExcelUpload />
        
      </header>
    </div>
  );
}

export default App;
