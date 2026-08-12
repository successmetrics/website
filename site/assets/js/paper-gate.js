(function () {
  var CONTACT_API = "/api/contact";
  var locked = document.querySelector(".paper-locked");
  if (!locked) return;

  var form = locked.querySelector(".paper-gate-form");
  var submitButton = locked.querySelector(".paper-gate-submit");
  var statusEl = locked.querySelector(".paper-gate-status");
  var gateCard = locked.querySelector(".paper-gate-card");
  if (!form || !submitButton || !statusEl) return;

  var paperTitle =
    locked.getAttribute("data-paper-title") || document.title || "White paper";
  var interest =
    locked.getAttribute("data-paper-interest") ||
    "White Paper Request — " + paperTitle;

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    submitButton.disabled = true;
    submitButton.textContent = "Sending…";
    statusEl.textContent = "Sending request to success@successmetrics.io…";
    statusEl.classList.remove("is-error", "is-success");

    var data = new FormData(form);
    var email = String(data.get("email") || "").trim();
    var affiliation = String(
      data.get("company") || data.get("affiliation") || "",
    ).trim();
    var name = String(data.get("name") || "").trim() || affiliation || email;

    data.set("name", name);
    data.set("company", affiliation);
    if (!data.get("interest")) data.set("interest", interest);
    data.set(
      "message",
      [
        "White paper full-document request",
        "",
        "Document: " + paperTitle,
        "Requester email: " + email,
        "Affiliation: " + affiliation,
        "Page: " + window.location.pathname,
      ].join("\n"),
    );

    try {
      var response = await fetch(CONTACT_API, {
        method: "POST",
        body: data,
      });
      var payload = await response.json().catch(function () {
        return {};
      });

      if (!response.ok || !payload.ok) {
        throw new Error(
          payload.error ||
            "Could not send request. Email success@successmetrics.io directly.",
        );
      }

      locked.classList.add("paper-requested");
      if (gateCard) {
        gateCard.innerHTML =
          "<h3>Request received</h3>" +
          "<p>Thanks — we&rsquo;ll send the full document to <strong>" +
          escapeHtml(email) +
          "</strong>. Our team was notified at <strong>success@successmetrics.io</strong>.</p>";
      }
      statusEl.textContent = "";
      statusEl.classList.add("is-success");
    } catch (error) {
      statusEl.textContent =
        error instanceof Error
          ? error.message
          : "Something went wrong. Email success@successmetrics.io.";
      statusEl.classList.add("is-error");
      submitButton.disabled = false;
      submitButton.textContent = "Request full document →";
    }
  });

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
})();
