import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import AdminDashboard from './pages/AdminDashboard.jsx';
import Banking from './pages/Banking.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Financials from './pages/Financials.jsx';
import LinkPartner from './pages/LinkPartner.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'));
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/admin" element={<AdminDashboard theme={theme} onToggleTheme={toggleTheme} />} />
      <Route path="/link-partner" element={<LinkPartner />} />
      <Route path="/dashboard" element={<Dashboard theme={theme} onToggleTheme={toggleTheme} />} />
      <Route path="/financials" element={<Financials theme={theme} onToggleTheme={toggleTheme} />} />
      <Route path="/banking" element={<Banking theme={theme} onToggleTheme={toggleTheme} />} />
    </Routes>
  );
}

export default App;
