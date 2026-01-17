import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Checkout from './pages/Checkout'

function App() {
  return (
    <Routes>
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/" element={<Navigate to="/checkout" replace />} />
    </Routes>
  )
}

export default App
