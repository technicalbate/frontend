import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import khojoMark from "./assets/khojo-mark.svg";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8081";
const roles = [
  { value: "USER", label: "User", description: "Discover and shop" },
  { value: "OWNER", label: "Owner", description: "Manage a storefront" },
  { value: "ADMIN", label: "Admin", description: "Manage the platform" },
];

async function request(path, body) {
  const response = await fetch(`${API_BASE_URL}/api/auth${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (response.status === 204) return null;

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const fallbackMessage =
      path === "/email/send-code" && response.status === 502
        ? "The email verification service is unavailable. Please try again later or contact support."
        : "Something went wrong. Please try again.";
    const error = new Error(result.detail || result.message || fallbackMessage);
    error.status = response.status;
    throw error;
  }
  return result;
}

function App({ googleEnabled }) {
  const [mode, setMode] = useState("login");
  const [method, setMethod] = useState("email");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [signupCodeSent, setSignupCodeSent] = useState(false);
  const [signupCode, setSignupCode] = useState("");
  const [recoveringPassword, setRecoveringPassword] = useState(false);
  const [recoveryCodeSent, setRecoveryCodeSent] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [role, setRole] = useState("USER");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [signedInUser, setSignedInUser] = useState(null);
  const [duplicateAccount, setDuplicateAccount] = useState("");

  const isSignup = mode === "signup";

  function isDuplicateError(error) {
    return error.status === 409 || /already\s*(exists|registered|in use|taken)|account.*exists|duplicate|email.*exist|phone.*exist/i.test(error.message);
  }

  async function completeSignIn(result) {
    sessionStorage.setItem("khojo-token", result.token);
    setSignedInUser(result.user);
    setNotice({ type: "success", text: `You’re signed in as ${result.user.name}.` });
  }

  async function perform(action) {
    setBusy(true);
    setNotice(null);
    try {
      const result = await action();
      if (result) await completeSignIn(result);
      return result;
    } catch (error) {
      if (isSignup && isDuplicateError(error)) {
        setDuplicateAccount(method === "phone" ? "mobile number" : "email address");
      } else {
        setNotice({ type: "error", text: error.message });
      }
      return null;
    } finally {
      setBusy(false);
    }
  }

  function submitEmail(event) {
    event.preventDefault();
    if (recoveringPassword) return resetPassword(event);
    if (isSignup && !signupCodeSent) return sendSignupCode();
    return perform(() =>
      request(isSignup ? "/register" : "/login", {
        ...(isSignup ? { name, role, adminCode, code: signupCode } : {}),
        email,
        password,
      }),
    );
  }

  function sendSignupCode() {
    return perform(async () => {
      await request("/email/send-code", { email });
      setSignupCodeSent(true);
      setSignupCode("");
      setNotice({ type: "info", text: `A verification code was sent to ${email}. Check your inbox and enter the code to finish creating your account.` });
      return null;
    });
  }

  function sendCode() {
    return perform(async () => {
      await request("/phone/send-code", { phone });
      setCodeSent(true);
      setNotice({ type: "success", text: "Verification code sent. It expires in 5 minutes." });
      return null;
    });
  }

  function verifyCode(event) {
    event.preventDefault();
    if (recoveringPassword) return resetPassword(event);
    return perform(() => request("/phone/verify-code", { phone, code, name, role, adminCode, signup: isSignup }));
  }

  function switchMethod(nextMethod) {
    setMethod(nextMethod);
    if (recoveringPassword) {
      setRecoveryCodeSent(false);
      setRecoveryCode("");
    }
    setNotice(null);
  }

  function sendRecoveryCode() {
    const identifier = method === "email" ? email : phone;
    const channel = method === "email" ? "EMAIL" : "PHONE";
    return perform(async () => {
      await request("/password/send-code", { channel, identifier });
      setRecoveryCodeSent(true);
      setNotice({
        type: "success",
        text: `If an account exists for that ${method === "email" ? "email" : "mobile number"}, a reset code is on its way.`,
      });
      return null;
    });
  }

  function resetPassword(event) {
    event.preventDefault();
    const identifier = method === "email" ? email : phone;
    const channel = method === "email" ? "EMAIL" : "PHONE";
    return perform(async () => {
      await request("/password/reset", { channel, identifier, code: recoveryCode, password: newPassword });
      setRecoveringPassword(false);
      setRecoveryCodeSent(false);
      setRecoveryCode("");
      setPassword("");
      setNewPassword("");
      setNotice({ type: "success", text: "Your password has been updated. You can now sign in." });
      return null;
    });
  }

  function googleSignIn(response) {
    if (!response.credential) {
      setNotice({ type: "error", text: "Google did not return a sign-in credential." });
      return;
    }
    return perform(() => request("/google", { credential: response.credential, role, adminCode }));
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setRecoveringPassword(false);
    setRecoveryCodeSent(false);
    setNotice(null);
    setDuplicateAccount("");
    setCodeSent(false);
    setCode("");
    setSignupCodeSent(false);
    setSignupCode("");
  }

  return (
    <main className="page-shell">
      <section className="auth-layout" aria-label="Khojo account access">
        <aside className="welcome-panel">
          <a className="brand" href="/" aria-label="Khojo home">
            <img alt="" className="brand-icon" src={khojoMark} />
            <span className="brand-copy"><strong>KHOJO</strong><small>HAR DUKAAN, AAPKE PHONE PAR</small></span>
          </a>
          <div className="welcome-copy">
            <span className="eyebrow">A better way to find</span>
            <h1>Good things<br />are closer than<br /><em>you think.</em></h1>
            <p>Your local marketplace for the things you love and the people behind them.</p>
          </div>
          <div className="marketplace-preview" aria-label="Shop local favorites">
            <div className="preview-heading">
              <span>THE NEIGHBORHOOD EDIT</span>
              <span aria-hidden="true">✳</span>
            </div>
            <div className="preview-products">
              <div className="preview-product produce"><span aria-hidden="true">🍋</span><small>Fresh picks</small></div>
              <div className="preview-product homeware"><span aria-hidden="true">🪴</span><small>Home & living</small></div>
              <div className="preview-product treats"><span aria-hidden="true">🥐</span><small>Local treats</small></div>
            </div>
            <p>Little finds. Lovely makers. Just around the corner.</p>
          </div>
          <div className="welcome-footer">
            <span className="status-dot" />
            <span>Made for your neighborhood</span>
            <span className="footer-sparkle">✳</span>
          </div>
          <span className="decor decor-one" />
          <span className="decor decor-two" />
        </aside>

        <section className="form-panel">
          <div className="form-wrap">
            <div className="mobile-brand">
              <img alt="" className="brand-icon" src={khojoMark} />
              <span className="brand-copy"><strong>KHOJO</strong><small>HAR DUKAAN, AAPKE PHONE PAR</small></span>
            </div>
            <div className="form-heading">
              <span className="eyebrow">{recoveringPassword ? "ACCOUNT RECOVERY" : isSignup ? "YOUR NEXT CHAPTER STARTS HERE" : "WELCOME BACK"}</span>
              <h2>{recoveringPassword ? "Reset your password" : isSignup ? "Create your account" : "Sign in to Khojo"}</h2>
              <p>{recoveringPassword ? "We’ll send a secure code to your email or mobile." : isSignup ? "It only takes a moment to get started." : "Pick up right where you left off."}</p>
            </div>

            {!recoveringPassword && <div className="mode-switch" role="tablist" aria-label="Account action">
              <button className={mode === "login" ? "selected" : ""} onClick={() => switchMode("login")} role="tab" aria-selected={mode === "login"} type="button">Sign in</button>
              <button className={mode === "signup" ? "selected" : ""} onClick={() => switchMode("signup")} role="tab" aria-selected={mode === "signup"} type="button">Create account</button>
            </div>}

            {!isSignup && <div className="method-switch" aria-label={recoveringPassword ? "Choose a recovery method" : "Choose a sign-in method"}>
              <button className={method === "email" ? "selected" : ""} onClick={() => switchMethod("email")} type="button">Email</button>
              <button className={method === "phone" ? "selected" : ""} onClick={() => switchMethod("phone")} type="button">Mobile number</button>
            </div>}

            {recoveringPassword ? (
              <form className="auth-form" onSubmit={recoveryCodeSent ? resetPassword : (event) => { event.preventDefault(); sendRecoveryCode(); }}>
                <label className="field-label" htmlFor={method === "email" ? "recovery-email" : "recovery-phone"}>{method === "email" ? "Email address" : "Mobile number"}</label>
                <input
                  autoComplete={method === "email" ? "email" : "tel"}
                  id={method === "email" ? "recovery-email" : "recovery-phone"}
                  onChange={(event) => {
                    if (recoveryCodeSent) {
                      setRecoveryCodeSent(false);
                      setRecoveryCode("");
                    }
                    if (method === "email") setEmail(event.target.value);
                    else setPhone(event.target.value);
                  }}
                  placeholder={method === "email" ? "you@example.com" : "+919876543210"}
                  required
                  type={method === "email" ? "email" : "tel"}
                  value={method === "email" ? email : phone}
                />
                {method === "phone" && <p className="field-hint">Include your country code, for example +91.</p>}
                {recoveryCodeSent && <>
                  <label className="field-label" htmlFor="recovery-code">Reset code</label>
                  <input autoComplete="one-time-code" id="recovery-code" inputMode="numeric" maxLength="6" onChange={(event) => setRecoveryCode(event.target.value.replace(/\D/g, ""))} placeholder="6-digit code" required value={recoveryCode} />
                  <label className="field-label" htmlFor="new-password">New password</label>
                  <input autoComplete="new-password" id="new-password" minLength="8" onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 8 characters" required type="password" value={newPassword} />
                </>}
                <button className="primary-button" disabled={busy || !(method === "email" ? email : phone)} type="submit">
                  {busy ? "Please wait…" : recoveryCodeSent ? "Update password" : "Send reset code"}<span aria-hidden="true">↗</span>
                </button>
                {recoveryCodeSent && <button className="text-button" disabled={busy} onClick={sendRecoveryCode} type="button">Resend code</button>}
                <button className="text-button" onClick={() => { setRecoveringPassword(false); setRecoveryCodeSent(false); setRecoveryCode(""); setNotice(null); }} type="button">Back to sign in</button>
              </form>
            ) : method === "email" ? (
              <form className="auth-form" onSubmit={submitEmail}>
                {isSignup && (
                  <>
                    <label className="field-label" htmlFor="name">Your name</label>
                    <input id="name" autoComplete="name" maxLength="120" onChange={(event) => setName(event.target.value)} placeholder="How should we call you?" required value={name} />
                  </>
                )}
                <label className="field-label" htmlFor="email">Email address</label>
                <input id="email" autoComplete="email" onChange={(event) => {
                  if (isSignup && signupCodeSent) {
                    setSignupCodeSent(false);
                    setSignupCode("");
                    setNotice(null);
                  }
                  setEmail(event.target.value);
                }} placeholder="you@example.com" required type="email" value={email} />
                <label className="field-label" htmlFor="password">Password</label>
                <input id="password" autoComplete={isSignup ? "new-password" : "current-password"} minLength={isSignup ? 8 : undefined} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" required type="password" value={password} />
                {!isSignup && <button className="forgot-link" onClick={() => { setRecoveringPassword(true); setRecoveryCodeSent(false); setNotice(null); }} type="button">Forgot password?</button>}
                {isSignup && <RolePicker role={role} onChange={setRole} />}
                {isSignup && role === "ADMIN" && <AdminCodeField onChange={setAdminCode} value={adminCode} />}
                {isSignup && signupCodeSent && <>
                  <label className="field-label" htmlFor="signup-code">Email verification code</label>
                  <input autoComplete="one-time-code" id="signup-code" inputMode="numeric" maxLength="6" onChange={(event) => setSignupCode(event.target.value.replace(/\D/g, ""))} placeholder="6-digit code" required value={signupCode} />
                  <p className="field-hint">The code expires in 5 minutes. Check your spam folder if you don’t see the email.</p>
                  <button className="text-button" disabled={busy} onClick={sendSignupCode} type="button">Resend code</button>
                </>}
                <button className="primary-button" disabled={busy} type="submit">
                  {busy ? "Please wait…" : isSignup ? signupCodeSent ? "Verify code & create account" : "Send verification code" : "Sign in"}
                  {!busy && <span aria-hidden="true">↗</span>}
                </button>
              </form>
            ) : (
              <form className="auth-form" onSubmit={verifyCode}>
                {isSignup && (
                  <>
                    <label className="field-label" htmlFor="phone-name">Your name</label>
                    <input id="phone-name" autoComplete="name" maxLength="120" onChange={(event) => setName(event.target.value)} placeholder="How should we call you?" required value={name} />
                  </>
                )}
                <label className="field-label" htmlFor="phone">Mobile number</label>
                <input id="phone" autoComplete="tel" onChange={(event) => { setPhone(event.target.value); setCodeSent(false); }} placeholder="+919876543210" required type="tel" value={phone} />
                <p className="field-hint">Include your country code, for example +91.</p>
                {!isSignup && <button className="forgot-link" onClick={() => { setRecoveringPassword(true); setRecoveryCodeSent(false); setNotice(null); }} type="button">Forgot password?</button>}
                {isSignup && <RolePicker role={role} onChange={setRole} />}
                {isSignup && role === "ADMIN" && <AdminCodeField onChange={setAdminCode} value={adminCode} />}
                {codeSent && (
                  <>
                    <label className="field-label" htmlFor="code">Verification code</label>
                    <input id="code" autoComplete="one-time-code" inputMode="numeric" maxLength="6" onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="6-digit code" required value={code} />
                  </>
                )}
                {codeSent ? (
                  <button className="primary-button" disabled={busy} type="submit">{busy ? "Verifying…" : "Verify & continue"}<span aria-hidden="true">↗</span></button>
                ) : (
                  <button className="primary-button" disabled={busy || !phone} onClick={sendCode} type="button">{busy ? "Sending code…" : "Send verification code"}<span aria-hidden="true">↗</span></button>
                )}
              </form>
            )}

            {!recoveringPassword && <div className="divider"><span>or continue with</span></div>}
            {!recoveringPassword && googleEnabled ? (
              <div className="google-button">
                <GoogleLogin
                  onError={() => setNotice({ type: "error", text: "Google sign-in could not be started. Please try again." })}
                  onSuccess={googleSignIn}
                  shape="rectangular"
                  size="large"
                  text="continue_with"
                  theme="outline"
                  width="400"
                />
              </div>
            ) : !recoveringPassword ? (
              <p className="provider-hint">Google sign-in needs a Google OAuth client ID. Configure it in the frontend environment.</p>
            ) : null}
            {notice && <p className={`notice ${notice.type}`} role="status">{notice.text}</p>}
            {signedInUser && (
              <div className="account-card" aria-live="polite">
                <span className="account-check">✓</span>
                <span><strong>{signedInUser.name}</strong><small>{signedInUser.role} account · signed in</small></span>
              </div>
            )}
            <p className="terms">By continuing, you agree to Khojo’s <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.</p>
          </div>
        </section>
      </section>
      {duplicateAccount && (
        <div className="dialog-backdrop" onClick={() => setDuplicateAccount("")}>
          <section aria-labelledby="duplicate-title" aria-modal="true" className="duplicate-dialog" onClick={(event) => event.stopPropagation()} role="dialog">
            <span className="dialog-icon" aria-hidden="true">✓</span>
            <h2 id="duplicate-title">You’re already on Khojo</h2>
            <p>An account with this {duplicateAccount} already exists. Sign in to continue shopping.</p>
            <button className="primary-button" onClick={() => switchMode("login")} type="button">Sign in instead<span aria-hidden="true">↗</span></button>
            <button className="dialog-dismiss" onClick={() => setDuplicateAccount("")} type="button">Try another {duplicateAccount}</button>
          </section>
        </div>
      )}
    </main>
  );
}

function RolePicker({ role, onChange }) {
  return (
    <fieldset className="role-picker">
      <legend>Choose your account type</legend>
      <div className="role-options">
        {roles.map((option) => (
          <button
            aria-pressed={role === option.value}
            className={`role-option ${role === option.value ? "active" : ""}`}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            <span>{option.label}</span>
            <small>{option.description}</small>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function AdminCodeField({ onChange, value }) {
  return (
    <>
      <label className="field-label" htmlFor="admin-code">Administrator invitation code</label>
      <input id="admin-code" autoComplete="off" onChange={(event) => onChange(event.target.value)} placeholder="Enter your invitation code" required type="password" value={value} />
      <p className="field-hint">Admin accounts require a code set by the platform administrator.</p>
    </>
  );
}

export default App;
