"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { register } from "@/features/auth/authService";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      await register({ email, password });
      router.replace("/login");
    } catch (err) {
      console.error(err);
      setError("Não foi possível criar a conta. Verifique os dados e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-root">
      <div className="bg-pattern" aria-hidden />

      <div className="login-split">
        <aside className="brand-panel">
          <div className="brand-content">
            <div className="brand-logo">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <path
                  d="M20 4C20 4 8 10 8 22C8 28.627 13.373 34 20 34C26.627 34 32 28.627 32 22C32 10 20 4 20 4Z"
                  fill="#4A7C3F"
                />
                <path
                  d="M20 34V16M20 16L14 22M20 16L26 22"
                  stroke="#D4E9B0"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 className="brand-name">Agro<span>Routing</span></h1>
            <p className="brand-tagline">
              Crie sua conta e comece a otimizar suas rotas agrícolas
            </p>
          </div>

          <div className="brand-footer">
            &copy; {new Date().getFullYear()} AgroRouting · Todos os direitos reservados
          </div>
        </aside>

        <main className="form-panel">
          <div className="form-card">
            <div className="form-header">
              <h2>Criar conta</h2>
              <p>Preencha os dados para começar</p>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div className="field">
                <label htmlFor="email">E-mail</label>
                <div className="input-wrapper">
                  <input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="password">Senha</label>
                <div className="input-wrapper">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? "🙈" : "👁"}
                  </button>
                </div>
              </div>

              <div className="field">
                <label htmlFor="confirm">Confirmar senha</label>
                <div className="input-wrapper">
                  <input
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {error && (
                <div className="error-msg" role="alert">
                  {error}
                </div>
              )}

              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? <span className="spinner" /> : "Criar conta"}
              </button>
            </form>

            <p className="signup-link">
              Já tem conta? <a href="/login">Entrar</a>
            </p>
          </div>
        </main>
      </div>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .login-root {
          min-height: 100vh;
          background: #F5F0E8;
          font-family: 'Georgia', 'Times New Roman', serif;
          position: relative;
          overflow: hidden;
        }
        .login-split { display: grid; grid-template-columns: 1fr 1fr; min-height: 100vh; position: relative; z-index: 1; }
        @media (max-width: 900px) { .login-split { grid-template-columns: 1fr; } .brand-panel { display: none; } }
        .brand-panel {
          background: linear-gradient(135deg, #4A7C3F 0%, #2F5A2A 100%);
          color: #F5F0E8;
          padding: 60px 50px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .brand-name { font-size: 32px; margin-top: 20px; }
        .brand-name span { color: #D4E9B0; }
        .brand-tagline { margin-top: 12px; opacity: 0.9; }
        .brand-footer { font-size: 12px; opacity: 0.7; }
        .form-panel { display: flex; align-items: center; justify-content: center; padding: 40px; }
        .form-card { width: 100%; max-width: 420px; background: #fff; border-radius: 14px; padding: 40px; box-shadow: 0 10px 40px rgba(0,0,0,0.08); }
        .form-header h2 { color: #2F5A2A; font-size: 26px; }
        .form-header p { color: #666; margin-top: 6px; margin-bottom: 24px; }
        .field { margin-bottom: 18px; }
        .field label { display: block; font-size: 13px; color: #444; margin-bottom: 6px; font-weight: 600; }
        .input-wrapper { position: relative; display: flex; align-items: center; }
        .input-wrapper input {
          width: 100%; padding: 12px 14px; border: 1px solid #d8d3c7;
          border-radius: 8px; font-size: 14px; font-family: inherit; background: #FAF8F3;
        }
        .input-wrapper input:focus { outline: none; border-color: #4A7C3F; background: #fff; }
        .toggle-password { position: absolute; right: 10px; background: none; border: none; cursor: pointer; }
        .btn-submit {
          width: 100%; padding: 13px; margin-top: 8px;
          background: #4A7C3F; color: #fff; border: none; border-radius: 8px;
          font-size: 15px; font-weight: 600; cursor: pointer; font-family: inherit;
        }
        .btn-submit:hover { background: #3d6834; }
        .btn-submit:disabled { opacity: 0.7; cursor: not-allowed; }
        .error-msg {
          background: #fde8e8; color: #b91c1c; padding: 10px 12px;
          border-radius: 6px; font-size: 13px; margin-bottom: 12px;
        }
        .signup-link { text-align: center; margin-top: 20px; color: #555; font-size: 14px; }
        .signup-link a { color: #4A7C3F; text-decoration: none; font-weight: 600; }
        .spinner {
          width: 16px; height: 16px; border: 2px solid #fff;
          border-top-color: transparent; border-radius: 50%;
          display: inline-block; animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
