import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import CheckInPage from './pages/CheckInPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/checkin" element={<CheckInPage />} />
    </Routes>
  );
}
