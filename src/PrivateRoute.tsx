// src/PrivateRoute.tsx
import { useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { Navigate } from "react-router-dom";

export default function PrivateRoute({ children }: { children: ReactNode }) {
    const [loading, setLoading] = useState(true);
    const [usuario, setUsuario] = useState<any>(null);

    useEffect(() => {
        onAuthStateChanged(auth, user => {
            setUsuario(user);
            setLoading(false);
        });
    }, []);

    if (loading) return <p>Carregando...</p>;

    return usuario?.email === "admin@admin.com" ? children : <Navigate to="/login" />;
}
