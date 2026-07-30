import { afterEach, describe, expect, it } from "vitest";
import {
  hasGoogleDriveConfig,
  uploadResumeToDrive,
} from "../../netlify/functions/shared/google-drive.mjs";
import { createTestResumeFile } from "../helpers/test-resume";

describe("google drive resume helper", () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it("reports missing config when Drive env vars are unset", () => {
    delete process.env.GOOGLE_DRIVE_FOLDER_ID;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

    expect(hasGoogleDriveConfig()).toBe(false);
  });

  it("skips upload when Drive is not configured", async () => {
    delete process.env.GOOGLE_DRIVE_FOLDER_ID;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

    const result = await uploadResumeToDrive({
      name: "Test Applicant",
      position: "General Application",
      resumeFile: createTestResumeFile(),
    });

    expect(result).toEqual({ uploaded: false, reason: "missing_drive_config" });
  });
});
