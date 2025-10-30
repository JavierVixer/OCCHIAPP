
/**
 * JS_AUTH.js — Autenticación mínima en front-end (demo)
 * - Registro, Inicio de sesión y Cierre de sesión con localStorage
 * - Integra con los formularios offcanvas existentes (loginForm / registerForm)
 * - Redirige a PANTALLA_PRINCIPAL.html tras iniciar sesión
 * - Utiliza alert() para feedback rápido (puedes cambiar por toasts)
 *
 * ⚠️ Nota: Esto es únicamente para demo/local. No es seguro para producción.
 */

(function(){
  const STORAGE_USERS = "oa_users";
  const STORAGE_SESSION = "oa_session";
  const DASHBOARD_URL = "PANTALLA_PRINCIPAL.html";
  const HOME_URL = "INDEX.html";

  // ===== Helpers de storage =====
  function readUsers(){
    try { return JSON.parse(localStorage.getItem(STORAGE_USERS)) || []; }
    catch(e){ return []; }
  }
  function writeUsers(users){ localStorage.setItem(STORAGE_USERS, JSON.stringify(users)); }
  function getSession(){ try { return JSON.parse(localStorage.getItem(STORAGE_SESSION)); } catch(e){ return null; } }
  function setSession(sessionObj){ localStorage.setItem(STORAGE_SESSION, JSON.stringify(sessionObj)); }
  function clearSession(){ localStorage.removeItem(STORAGE_SESSION); }

  // ===== Util =====
  function byId(id){ return document.getElementById(id); }
  function qs(sel, root){ return (root||document).querySelector(sel); }
  function on(el, ev, fn){ if(el){ el.addEventListener(ev, fn); } }
  function isEmail(s){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }

  // ===== Registro =====
  function handleRegister(root){
    const nameI = qs('input[type="text"]', root);
    const emailI = qs('input[type="email"]', root);
    const passI = qs('input[type="password"]', root);
    const btn = qs('button, .btn, .btn-pill', root);

    on(btn, 'click', function(e){
      e.preventDefault();
      const name = (nameI?.value || "").trim();
      const email = (emailI?.value || "").trim().toLowerCase();
      const pass = (passI?.value || "").trim();

      if(!name || !email || !pass){ return alert("Completa nombre, correo y contraseña."); }
      if(!isEmail(email)){ return alert("Correo inválido."); }
      if(pass.length < 6){ return alert("La contraseña debe tener al menos 6 caracteres."); }

      const users = readUsers();
      if(users.some(u => u.email === email)){
        return alert("El correo ya está registrado. Inicia sesión.");
      }
      users.push({ name, email, pass });
      writeUsers(users);

      // Auto-login
      setSession({ name, email });
      alert("Cuenta creada. ¡Bienvenido!");
      window.location.href = DASHBOARD_URL;
    });
  }

  // ===== Login =====
  function handleLogin(root){
    const emailI = qs('input[type="email"]', root);
    const passI = qs('input[type="password"]', root);
    const btn = qs('button, .btn, .btn-pill', root);

    on(btn, 'click', function(e){
      e.preventDefault();
      const email = (emailI?.value || "").trim().toLowerCase();
      const pass = (passI?.value || "").trim();

      if(!email || !pass){ return alert("Ingresa correo y contraseña."); }
      if(!isEmail(email)){ return alert("Correo inválido."); }

      const users = readUsers();
      const user = users.find(u => u.email === email && u.pass === pass);
      if(!user){ return alert("Credenciales incorrectas."); }

      setSession({ name: user.name, email: user.email });
      alert("Acceso concedido.");
      window.location.href = DASHBOARD_URL;
    });
  }

  // ===== Logout =====
  function wireLogout(){
    // Botones de logout marcados con id o data-attr
    const btnById = byId("btnLogout");
    const btnsData = document.querySelectorAll('[data-action="logout"]');
    const all = [...(btnById ? [btnById] : []), ...btnsData];

    all.forEach(btn => on(btn, 'click', function(e){
      e.preventDefault();
      clearSession();
      alert("Sesión cerrada.");
      window.location.href = HOME_URL;
    }));
  }

  // ===== Guard de página protegida (opcional) =====
  function guardProtected(){
    const needAuth = document.documentElement.hasAttribute('data-protected');
    if(!needAuth){ return; }
    const session = getSession();
    if(!session){
      alert("Primero inicia sesión.");
      window.location.href = HOME_URL;
      return;
    }
    // Rellenar nombre si hay placeholders
    const elName = document.querySelectorAll('[data-session="name"]');
    elName.forEach(el => el.textContent = session.name || "Usuario");
  }

  // ===== Auto-wire en DOM ready =====
  document.addEventListener('DOMContentLoaded', function(){

    // Offcanvas: login / registro (INDEX.html, SERVICIOS.html, CONTACTO.html)
    const loginForm = byId("loginForm");
    const registerForm = byId("registerForm");

    if(loginForm){ handleLogin(loginForm); }
    if(registerForm){ handleRegister(registerForm); }

    wireLogout();
    guardProtected();
  });
})();
