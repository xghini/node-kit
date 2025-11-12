import kit from "@ghini/kit/dev";
kit.cs(66);
let res;
const app = await kit.hs(888);
app.addr("/stream", "*", "*", hd_stream, undefined, {})

function hd_stream(gold) {
  gold.respond({
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
  });
  let count = 3;
  gold.write(`data: ${count}\n\n`);
  const interval = setInterval(() => {
    count--;
    if (count > 0) {
      gold.write(`data: ${count}\n\n`);
    } else {
      gold.write(`data: ${count}\n\n`);
      gold.write("data: Countdown complete!\n\n");
      clearInterval(interval);
      gold.end();
    }
  }, 1000);
}