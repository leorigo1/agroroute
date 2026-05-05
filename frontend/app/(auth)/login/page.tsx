"use client";
 
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/features/auth/authService";
 
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
 
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
 
    try {
      const data = await login({ email, password });
      localStorage.setItem("agroroute_token", data.access_token);
      window.dispatchEvent(new Event("agroroute-auth-change"));
      router.replace("/");
    } catch (err) {
      console.error(err);
      setError("E-mail ou senha inválidos. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }
 
  return (
    <div className="login-root">
      {/* Background decorativo */}
      <div className="bg-pattern" aria-hidden />
 
      <div className="login-split">
        {/* Painel esquerdo — branding */}
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
              Inteligência de rotas para o agronegócio brasileiro
            </p>
 
            <ul className="brand-features">
              <li>
                <span className="feat-icon">◆</span>
                Otimização de rotas agrícolas
              </li>
              <li>
                <span className="feat-icon">◆</span>
                Monitoramento em tempo real
              </li>
              <li>
                <span className="feat-icon">◆</span>
                Relatórios de produtividade
              </li>
            </ul>
          </div>
 
          <div className="brand-footer">
            &copy; {new Date().getFullYear()} AgroRouting · Todos os direitos reservados
          </div>
        </aside>
 
        {/* Painel direito — formulário */}
        <main className="form-panel">
          <div className="form-card">
            <div className="form-header">
              <h2>Bem-vindo de volta</h2>
              <p>Acesse sua conta para continuar</p>
            </div>
 
            <form onSubmit={handleSubmit} noValidate>
              <div className="field">
                <label htmlFor="email">E-mail</label>
                <div className="input-wrapper">
                  <span className="input-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2"/>
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                    </svg>
                  </span>
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
                <label htmlFor="password">
                  Senha
                  <a href="/forgot-password" className="forgot-link">Esqueceu a senha?</a>
                </label>
                <div className="input-wrapper">
                  <span className="input-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </span>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
 
              {error && (
                <div className="error-msg" role="alert">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                </div>
              )}
 
              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? (
                  <span className="spinner" />
                ) : (
                  "Entrar"
                )}
              </button>
            </form>
 
            <div className="form-divider"><span>ou continue com</span></div>
 
            <div className="sso-buttons">
              <button type="button" className="btn-sso">
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </button>
              <button type="button" className="btn-sso">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3H5C3.9 3 3 3.9 3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/>
                </svg>
                SSO Corporativo
              </button>
            </div>
 
            <p className="signup-link">
              Não tem conta?{" "}
              <a href="/register">Solicitar acesso</a>
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
 
        .bg-pattern {
          position: fixed;
          inset: 0;
          background-image:
            radial-gradient(circle at 20% 80%, rgba(74,124,63,0.08) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(180,140,60,0.07) 0%, transparent 50%),
            url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%234a7c3f' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='1.5'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
          pointer-events: none;
          z-index: 0;
        }
 
        .login-split {
          position: relative;
          z-index: 1;
          display: flex;
          min-height: 100vh;
        }
 
        /* ——— Brand panel ——— */
        .brand-panel {
          width: 420px;
          flex-shrink: 0;
          background: linear-gradient(160deg, #2D5A27 0%, #1E3D1A 60%, #162E13 100%);
          color: #D4E9B0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 3rem 2.5rem;
          position: relative;
          overflow: hidden;
        }
 
        .brand-panel::before {
          content: '';
          position: absolute;
          top: -80px; right: -80px;
          width: 280px; height: 280px;
          border-radius: 50%;
          background: rgba(74,124,63,0.15);
        }
 
        .brand-panel::after {
          content: '';
          position: absolute;
          bottom: -60px; left: -60px;
          width: 200px; height: 200px;
          border-radius: 50%;
          background: rgba(180,140,60,0.1);
        }
 
        .brand-content { position: relative; z-index: 1; }
 
        .brand-logo {
          width: 64px; height: 64px;
          background: rgba(212,233,176,0.12);
          border: 1px solid rgba(212,233,176,0.2);
          border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 1.5rem;
        }
 
        .brand-name {
          font-size: 2rem;
          font-weight: normal;
          letter-spacing: -0.5px;
          color: #EEF5E0;
          margin-bottom: 0.75rem;
        }
 
        .brand-name span {
          color: #A8CC6E;
        }
 
        .brand-tagline {
          font-size: 0.95rem;
          color: rgba(212,233,176,0.7);
          line-height: 1.5;
          margin-bottom: 3rem;
          font-family: 'Helvetica Neue', sans-serif;
          font-weight: 300;
        }
 
        .brand-features {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
 
        .brand-features li {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-family: 'Helvetica Neue', sans-serif;
          font-size: 0.875rem;
          color: rgba(212,233,176,0.85);
          font-weight: 300;
        }
 
        .feat-icon {
          font-size: 0.5rem;
          color: #A8CC6E;
          flex-shrink: 0;
        }
 
        .brand-footer {
          font-family: 'Helvetica Neue', sans-serif;
          font-size: 0.75rem;
          color: rgba(212,233,176,0.35);
          position: relative; z-index: 1;
        }
 
        /* ——— Form panel ——— */
        .form-panel {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }
 
        .form-card {
          width: 100%;
          max-width: 420px;
        }
 
        .form-header {
          margin-bottom: 2rem;
        }
 
        .form-header h2 {
          font-size: 1.75rem;
          font-weight: normal;
          color: #2D2A1E;
          letter-spacing: -0.3px;
          margin-bottom: 0.4rem;
        }
 
        .form-header p {
          font-family: 'Helvetica Neue', sans-serif;
          font-size: 0.9rem;
          color: #7A7060;
          font-weight: 300;
        }
 
        /* ——— Fields ——— */
        .field {
          margin-bottom: 1.25rem;
        }
 
        .field label {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-family: 'Helvetica Neue', sans-serif;
          font-size: 0.8rem;
          font-weight: 500;
          color: #4A4030;
          letter-spacing: 0.3px;
          text-transform: uppercase;
          margin-bottom: 0.5rem;
        }
 
        .forgot-link {
          font-size: 0.8rem;
          color: #5A8A50;
          text-decoration: none;
          font-weight: 400;
          text-transform: none;
          letter-spacing: 0;
        }
 
        .forgot-link:hover { text-decoration: underline; }
 
        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
 
        .input-icon {
          position: absolute;
          left: 14px;
          color: #9A8E7A;
          display: flex;
          align-items: center;
          pointer-events: none;
        }
 
        .input-wrapper input {
          width: 100%;
          height: 48px;
          padding: 0 44px 0 44px;
          background: #FDFAF4;
          border: 1.5px solid #D8CEB8;
          border-radius: 10px;
          font-family: 'Helvetica Neue', sans-serif;
          font-size: 0.95rem;
          color: #2D2A1E;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
 
        .input-wrapper input::placeholder {
          color: #B8AB96;
        }
 
        .input-wrapper input:focus {
          border-color: #4A7C3F;
          box-shadow: 0 0 0 3px rgba(74,124,63,0.12);
        }
 
        .toggle-password {
          position: absolute;
          right: 14px;
          background: none;
          border: none;
          cursor: pointer;
          color: #9A8E7A;
          display: flex;
          align-items: center;
          padding: 0;
          transition: color 0.2s;
        }
 
        .toggle-password:hover { color: #4A7C3F; }
 
        /* ——— Error ——— */
        .error-msg {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #FEF2F0;
          border: 1px solid #F0C8C0;
          border-radius: 8px;
          padding: 10px 14px;
          font-family: 'Helvetica Neue', sans-serif;
          font-size: 0.85rem;
          color: #993C1D;
          margin-bottom: 1rem;
        }
 
        /* ——— Submit button ——— */
        .btn-submit {
          width: 100%;
          height: 50px;
          background: #2D5A27;
          color: #EEF5E0;
          border: none;
          border-radius: 10px;
          font-family: 'Helvetica Neue', sans-serif;
          font-size: 0.95rem;
          font-weight: 500;
          letter-spacing: 0.3px;
          cursor: pointer;
          margin-top: 0.5rem;
          transition: background 0.2s, transform 0.1s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
 
        .btn-submit:hover:not(:disabled) { background: #3A6E33; }
        .btn-submit:active:not(:disabled) { transform: scale(0.99); }
        .btn-submit:disabled { opacity: 0.7; cursor: not-allowed; }
 
        .spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(238,245,224,0.3);
          border-top-color: #EEF5E0;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
 
        @keyframes spin { to { transform: rotate(360deg); } }
 
        /* ——— Divider ——— */
        .form-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 1.5rem 0 1.25rem;
        }
 
        .form-divider::before,
        .form-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #D8CEB8;
        }
 
        .form-divider span {
          font-family: 'Helvetica Neue', sans-serif;
          font-size: 0.75rem;
          color: #9A8E7A;
          white-space: nowrap;
        }
 
        /* ——— SSO buttons ——— */
        .sso-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
 
        .btn-sso {
          height: 44px;
          background: #FDFAF4;
          border: 1.5px solid #D8CEB8;
          border-radius: 10px;
          font-family: 'Helvetica Neue', sans-serif;
          font-size: 0.875rem;
          color: #4A4030;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: border-color 0.2s, background 0.2s;
          font-weight: 400;
        }
 
        .btn-sso:hover {
          border-color: #4A7C3F;
          background: #F5F0E8;
        }
 
        /* ——— Sign up link ——— */
        .signup-link {
          text-align: center;
          font-family: 'Helvetica Neue', sans-serif;
          font-size: 0.875rem;
          color: #7A7060;
          margin-top: 1.5rem;
          font-weight: 300;
        }
 
        .signup-link a {
          color: #4A7C3F;
          text-decoration: none;
          font-weight: 500;
        }
 
        .signup-link a:hover { text-decoration: underline; }
 
        /* ——— Responsive ——— */
        @media (max-width: 768px) {
          .brand-panel { display: none; }
          .form-panel { padding: 1.5rem; align-items: flex-start; padding-top: 3rem; }
        }
      `}</style>
    </div>
  );
}
