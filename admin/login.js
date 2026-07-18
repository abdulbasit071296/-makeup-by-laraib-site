(function () {
  const loginForm = document.getElementById("login-form");
  const loginPassword = document.getElementById("login-password");
  const loginError = document.getElementById("login-error");

  // Already logged in (e.g. came back via browser history) — skip straight to the panel.
  fetch("/api/session")
    .then((r) => r.json())
    .then((data) => {
      if (data.authed) location.href = "admin-panel.html";
    });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: loginPassword.value }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      location.href = "admin-panel.html";
    } else {
      loginError.textContent = data.error || "Incorrect password";
      loginError.hidden = false;
    }
  });
})();
