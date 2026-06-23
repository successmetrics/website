(function () {
  const JOBS_API = "/api/jobs";
  const APPLY_API = "/api/job-application";
  const FALLBACK_URL = "/data/careers-fallback.json";
  const JOB_INDEX_URL = "/data/careers-job-index.json";

  const jobsContainer = document.getElementById("job-list");
  const roleSelect = document.getElementById("role");
  const form = document.getElementById("job-application-form");
  const formStatus = document.getElementById("form-status");
  const submitButton = form ? form.querySelector('button[type="submit"]') : null;
  const preselectedRole = document.body.dataset.preselectedRole || "";

  if (!roleSelect || !form) return;

  init();

  async function init() {
    if (jobsContainer) {
      setJobsLoading(true);
    }

    const [jobs, jobIndex] = await Promise.all([loadJobs(), loadJobIndex()]);
    const enrichedJobs = enrichJobs(jobs, jobIndex);

    if (jobsContainer) {
      renderJobs(enrichedJobs);
      setJobsLoading(false);
    }

    renderRoleOptions(enrichedJobs);

    if (preselectedRole) {
      selectRole(preselectedRole);
    }

    bindForm();
  }

  async function loadJobIndex() {
    try {
      const response = await fetch(JOB_INDEX_URL, {
        headers: { Accept: "application/json" },
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (_error) {
      /* no index available */
    }
    return {};
  }

  async function loadJobs() {
    try {
      const response = await fetch(JOBS_API, { headers: { Accept: "application/json" } });
      if (response.ok) {
        const payload = await response.json();
        if (Array.isArray(payload.jobs) && payload.jobs.length > 0) {
          return payload.jobs;
        }
      }
    } catch (_error) {
      /* fall through to static fallback */
    }

    try {
      const response = await fetch(FALLBACK_URL, { headers: { Accept: "application/json" } });
      if (response.ok) {
        const jobs = await response.json();
        return normalizeJobs(jobs);
      }
    } catch (_error) {
      /* no fallback available */
    }

    return [];
  }

  function normalizeJobs(jobs) {
    return jobs.map(function (job) {
      return {
        id: job.id,
        title: job.title,
        location: job.location,
        type: job.type,
        label: job.label || job.title + " (" + job.id + ")",
        slug: job.slug || null,
        detailUrl: job.detailUrl || null,
      };
    });
  }

  function enrichJobs(jobs, jobIndex) {
    return jobs
      .filter(function (job) {
        return job.id !== "JD-0083" && !/accessibility specialist/i.test(job.title || "");
      })
      .map(function (job) {
        const extra = jobIndex[job.id] || {};
        return {
          id: job.id,
          title: job.title,
          location: job.location,
          type: job.type,
          label: job.label || job.title + " (" + job.id + ")",
          slug: job.slug || extra.slug || null,
          detailUrl: job.detailUrl || extra.detailUrl || null,
        };
      });
  }

  function setJobsLoading(isLoading) {
    if (!jobsContainer) return;
    jobsContainer.dataset.state = isLoading ? "loading" : "ready";
    if (isLoading) {
      jobsContainer.innerHTML =
        '<p class="jobs-status">Loading current openings…</p>';
    }
  }

  function renderJobs(jobs) {
    if (!jobsContainer) return;

    if (!jobs.length) {
      jobsContainer.innerHTML =
        '<p class="jobs-status">No open positions right now. Submit a general application below — we are always looking for exceptional Salesforce talent.</p>';
      return;
    }

    jobsContainer.innerHTML = jobs
      .map(function (job) {
        const actions = [];

        if (job.detailUrl) {
          actions.push(
            '<a class="btn btn-ghost" href="' +
              escapeHtml(job.detailUrl) +
              '">More info</a>',
          );
        }

        actions.push(
          '<button type="button" class="btn btn-primary apply-btn" data-role="' +
            escapeHtml(job.label) +
            '">Apply Now</button>',
        );

        return (
          '<div class="job-row">' +
          '<div class="info">' +
          "<h3>" +
          escapeHtml(job.title) +
          "</h3>" +
          '<div class="meta"><span>' +
          escapeHtml(job.id) +
          "</span><span>📍 " +
          escapeHtml(job.location) +
          "</span><span>" +
          escapeHtml(job.type) +
          '</span></div></div>' +
          '<div class="job-row-actions">' +
          actions.join("") +
          "</div>" +
          "</div>"
        );
      })
      .join("");

    jobsContainer.querySelectorAll(".apply-btn").forEach(function (button) {
      button.addEventListener("click", function () {
        selectRole(button.getAttribute("data-role"));
        document.getElementById("apply").scrollIntoView({ behavior: "smooth" });
      });
    });
  }

  function renderRoleOptions(jobs) {
    const options = ['<option value="">Select a role…</option>'];
    jobs.forEach(function (job) {
      options.push(
        '<option value="' +
          escapeHtml(job.label) +
          '">' +
          escapeHtml(job.label) +
          "</option>",
      );
    });
    if (!preselectedRole) {
      options.push('<option value="General Application">General Application</option>');
    }
    roleSelect.innerHTML = options.join("");
  }

  function bindForm() {
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      clearFormStatus();

      if (!submitButton) return;

      submitButton.disabled = true;
      submitButton.textContent = "Submitting…";

      try {
        const response = await fetch(APPLY_API, {
          method: "POST",
          body: new FormData(form),
        });
        const payload = await response.json().catch(function () {
          return {};
        });

        if (!response.ok || !payload.ok) {
          throw new Error(
            payload.error ||
              payload.errorMessage ||
              "Submission failed. Please try again.",
          );
        }

        form.reset();
        if (preselectedRole) {
          selectRole(preselectedRole);
        }
        showFormStatus(
          "success",
          "Thank you — your application was received. We review every submission personally and respond within 5 business days.",
        );
      } catch (error) {
        showFormStatus(
          "error",
          error instanceof Error
            ? error.message
            : "Something went wrong. Email careers@successmetrics.io with your resume.",
        );
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Submit Application →";
      }
    });
  }

  function selectRole(role) {
    for (var i = 0; i < roleSelect.options.length; i++) {
      if (roleSelect.options[i].value === role) {
        roleSelect.selectedIndex = i;
        break;
      }
    }
  }

  window.selectRole = selectRole;

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

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
})();
