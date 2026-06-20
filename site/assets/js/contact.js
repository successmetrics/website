(function () {
  const CONTACT_API = "/api/contact";

  const form = document.querySelector('form[name="contact"]');
  const formStatus = document.getElementById("form-status");
  const submitButton = form ? form.querySelector('button[type="submit"]') : null;

  if (!form) return;

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    clearFormStatus();

    if (!submitButton) return;

    submitButton.disabled = true;
    submitButton.textContent = "Sending…";

    try {
      const response = await fetch(CONTACT_API, {
        method: "POST",
        body: new FormData(form),
      });
      const payload = await response.json().catch(function () {
        return {};
      });

      if (!response.ok || !payload.ok) {
        throw new Error(
          payload.error ||
            "Submission failed. Please email support@successmetrics.io directly.",
        );
      }

      form.reset();
      showFormStatus(
        "success",
        "Thank you — your message was received. We respond within one business day.",
      );
    } catch (error) {
      showFormStatus(
        "error",
        error instanceof Error
          ? error.message
          : "Something went wrong. Email support@successmetrics.io and we'll get back to you.",
      );
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Send Message →";
    }
  });

  function showFormStatus(type, message) {
    if (!formStatus) return;
    formStatus.hidden = false;
    formStatus.className = "form-status form-status--" + type;
    formStatus.textContent = message;
    formStatus.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function clearFormStatus() {
    if (!formStatus) return;
    formStatus.hidden = true;
    formStatus.textContent = "";
    formStatus.className = "form-status";
  }
})();
