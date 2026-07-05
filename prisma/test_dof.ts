import dns from "dns";

async function main() {
  console.log("--- 1. Resolving DNS ---");
  dns.lookup("www.dof.gob.mx", { all: true }, (err, addresses) => {
    if (err) {
      console.error("DNS Error:", err);
    } else {
      console.log("DNS Resolved:", addresses);
    }
  });

  console.log("--- 2. Performing Node Fetch ---");
  try {
    const res = await fetch("https://www.dof.gob.mx", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      }
    });
    console.log("Fetch Status:", res.status);
    console.log("Fetch URL:", res.url);
    console.log("Content-Type:", res.headers.get("content-type"));
  } catch (err: any) {
    console.error("Fetch failed!");
    console.error("Name:", err.name);
    console.error("Message:", err.message);
    console.error("Cause:", err.cause);
  }
}

main();
