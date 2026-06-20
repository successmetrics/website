export const TEST_RESUME_BYTES = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Size 3/Root 1 0 R>>\n%%EOF\n",
);

export function createTestResumeFile() {
  return {
    name: "ci-test-resume.pdf",
    type: "application/pdf",
    size: TEST_RESUME_BYTES.length,
    arrayBuffer: async () =>
      TEST_RESUME_BYTES.buffer.slice(
        TEST_RESUME_BYTES.byteOffset,
        TEST_RESUME_BYTES.byteOffset + TEST_RESUME_BYTES.byteLength,
      ),
  };
}
