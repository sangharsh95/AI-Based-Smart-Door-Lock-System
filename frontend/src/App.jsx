import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import CameraScanner from './components/CameraScanner';
import AdminDashboard from './components/AdminDashboard';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-900 text-white font-sans">
        <nav className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
          <Link to="/" className="text-xl font-bold text-blue-400">SmartLock</Link>
          <Link to="/admin" className="text-sm bg-slate-700 px-3 py-1 rounded hover:bg-slate-600">Admin</Link>
        </nav>
        <Routes>
          <Route path="/" element={<CameraScanner />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
