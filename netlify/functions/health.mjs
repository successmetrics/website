const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

export default async function handler() {
  return new Response(
    JSON.stringify({
      ok: true,
      env: {
        RESEND_API_KEY: Boolean(process.env.RESEND_API_KEY?.trim()),
        NOTION_TOKEN: Boolean(process.env.NOTION_TOKEN?.trim()),
        NOTION_JOBS_DATABASE_ID: Boolean(process.env.NOTION_JOBS_DATABASE_ID?.trim()),
        NOTION_APPLICATIONS_DATABASE_ID: Boolean(
          process.env.NOTION_APPLICATIONS_DATABASE_ID?.trim(),
        ),
      },
    }),
    { status: 200, headers },
  );
}
