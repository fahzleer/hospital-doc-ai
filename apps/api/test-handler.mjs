import handler from "./api/index.ts";

async function test(path) {
  try {
    const response = await handler(new Request(`http://localhost${path}`));
    console.log(`${path} -> status:`, response.status);
    console.log(`${path} -> body:`, await response.text());
  } catch (err) {
    console.error(`${path} -> Handler crashed:`, err);
    process.exit(1);
  }
}

async function main() {
  await test("/health");
  await test("/documents");
}

main();
