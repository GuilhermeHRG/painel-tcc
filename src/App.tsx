import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './login';
import AppContent from './AppContent'; // este é o conteúdo protegido
import PrivateRoute from './PrivateRoute';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route
                    path="/"
                    element={
                        <PrivateRoute>
                            <AppContent />
                        </PrivateRoute>
                    }
                />
                <Route path="/login" element={<Login />} />
                <Route path="*" element={<Navigate to="/login" />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
