// Public trust anchor URL is defined by the official Supabase Studio source:
// https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json
const { X509Certificate } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const source =
  "https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt";
async function prepareCertificate() {
  const response = await fetch(source, {
    signal: AbortSignal.timeout(20000),
    redirect: "error",
  });
  if (!response.ok)
    throw Error("Official CA download failed: HTTP " + response.status);
  const pem = await response.text();
  const cert = new X509Certificate(pem);
  const now = Date.now();
  if (
    !cert.ca ||
    !/supabase/i.test(cert.subject) ||
    now < Date.parse(cert.validFrom) ||
    now >= Date.parse(cert.validTo)
  )
    throw Error("Official CA validation failed");
  const folder = path.join(__dirname, "../certs");
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(folder, "supabase-prod-ca-2021.crt"), pem);
  console.log("Verified official Supabase CA (SHA-256):", cert.fingerprint256);
}
if (require.main === module)
  prepareCertificate().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
module.exports = { prepareCertificate };
