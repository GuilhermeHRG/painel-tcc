import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";
import "./login.css";
import { useNavigate } from "react-router-dom";
import logo from '../public/logo-time-to-code.png'



export default function Login() {
    const [email, setEmail] = useState("");
    const [senha, setSenha] = useState("");
    const navigate = useNavigate();

    const handleLogin = async () => {
        try {
            await signInWithEmailAndPassword(auth, email, senha);
            navigate("/"); // redireciona após login com sucesso
        } catch (err) {
            alert("Erro ao fazer login");
        }
    };


    return (
        <main className="login-wrapper">
            <section className="login-card">
                <img src={logo} alt="Logo Time to Code" className="login-logo" />
                <h1 className="login-title">Acessar o Painel</h1>
                <p className="login-subtitle">Use sua conta de Administrador para continuar</p>
                <form className="login-form" onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
                    <label className="login-label">
                        Email
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            className="login-input"
                        />
                    </label>
                    <label className="login-label">
                        Senha
                        <input
                            type="password"
                            value={senha}
                            onChange={e => setSenha(e.target.value)}
                            required
                            className="login-input"
                        />
                    </label>
                    <button type="submit" className="login-button">Entrar</button>
                </form>
            </section>
        </main>
    );
}
